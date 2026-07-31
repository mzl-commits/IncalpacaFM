from __future__ import annotations

import hashlib
import json
import re
import xml.etree.ElementTree as ET
from collections.abc import Iterator
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation
from pathlib import Path
from typing import Any

from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.assets.models import Asset, FacilityPlan, FacilityPlanMarker, Taxonomy

FM_CODE_PATTERN = re.compile(
    r"(?<![A-Z0-9])(?P<prefix>[A-Z][A-Z0-9]{0,15})-"
    r"(?P<suffix>\d+|XXXX)(?![A-Z0-9])",
    re.IGNORECASE,
)
DWG_HEADER_PATTERN = re.compile(rb"^AC\d{4}")
DECIMAL_SIX = Decimal("0.000001")
DECIMAL_EIGHT = Decimal("0.00000001")
MAX_INPUT_SIZE = 100 * 1024 * 1024
TEXT_TYPES = {"TEXT", "MTEXT", "ACDBTEXT", "ACDBMTEXT"}
TYPE_KEYS = ("object", "entity", "entity_type", "dxf_type", "dxfname", "type")
TEXT_KEYS = ("text_value", "text", "plain_text", "contents", "string")
POINT_KEYS = (
    "insertion_pt",
    "insertion_point",
    "ins_pt",
    "insert",
    "position",
    "location",
)


@dataclass(frozen=True)
class Bounds:
    min_x: Decimal
    min_y: Decimal
    max_x: Decimal
    max_y: Decimal

    def validate(self) -> None:
        if self.max_x <= self.min_x or self.max_y <= self.min_y:
            raise CommandError("Los límites requieren max_x > min_x y max_y > min_y.")

    def normalize(self, x: Decimal, y: Decimal) -> tuple[Decimal, Decimal]:
        if not (self.min_x <= x <= self.max_x and self.min_y <= y <= self.max_y):
            raise CommandError(f"La coordenada ({x}, {y}) está fuera de los límites del plano.")
        normalized_x = (x - self.min_x) / (self.max_x - self.min_x)
        normalized_y = Decimal("1") - ((y - self.min_y) / (self.max_y - self.min_y))
        return (
            normalized_x.quantize(DECIMAL_EIGHT, rounding=ROUND_HALF_UP),
            normalized_y.quantize(DECIMAL_EIGHT, rounding=ROUND_HALF_UP),
        )


@dataclass(frozen=True)
class TextCandidate:
    source_index: int
    raw_code: str
    prefix: str
    label: str
    layer: str
    source_x: Decimal
    source_y: Decimal


def _read_file(path: Path, label: str) -> bytes:
    try:
        resolved = path.expanduser().resolve(strict=True)
        if not resolved.is_file():
            raise CommandError(f"{label} no es un archivo: {resolved}")
        size = resolved.stat().st_size
        if size <= 0:
            raise CommandError(f"{label} está vacío: {resolved}")
        if size > MAX_INPUT_SIZE:
            raise CommandError(f"{label} supera el límite de {MAX_INPUT_SIZE // (1024 * 1024)} MB.")
        return resolved.read_bytes()
    except OSError as exc:
        raise CommandError(f"No se pudo leer {label}: {exc}") from exc


def _sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _validate_dwg(path: Path, content: bytes, expected_sha256: str | None) -> str:
    if path.suffix.lower() != ".dwg":
        raise CommandError("El archivo fuente debe tener extensión .dwg.")
    if not DWG_HEADER_PATTERN.match(content[:6]):
        raise CommandError("El archivo DWG no tiene una cabecera AC10xx válida.")
    digest = _sha256(content)
    if expected_sha256:
        normalized = expected_sha256.strip().lower()
        if not re.fullmatch(r"[0-9a-f]{64}", normalized):
            raise CommandError("--dwg-sha256 debe contener 64 caracteres hexadecimales.")
        if digest != normalized:
            raise CommandError(
                f"SHA-256 del DWG no coincide: esperado {normalized}, obtenido {digest}."
            )
    return digest


def _validate_svg(content: bytes) -> None:
    try:
        root = ET.fromstring(content)
    except ET.ParseError as exc:
        raise CommandError(f"El SVG no es XML válido: {exc}") from exc
    if root.tag.rsplit("}", 1)[-1].lower() != "svg":
        raise CommandError("El archivo SVG no tiene un elemento raíz <svg>.")
    blocked_tags = {"script", "foreignobject", "iframe", "object", "embed"}
    for element in root.iter():
        tag = element.tag.rsplit("}", 1)[-1].lower()
        if tag in blocked_tags:
            raise CommandError(f"El SVG contiene el elemento no permitido <{tag}>.")
        for attribute, value in element.attrib.items():
            attribute_name = attribute.rsplit("}", 1)[-1].lower()
            normalized_value = value.strip().lower()
            if attribute_name.startswith("on"):
                raise CommandError("El SVG contiene un manejador de eventos no permitido.")
            if normalized_value.startswith(("javascript:", "http://", "https://", "//")):
                raise CommandError("El SVG contiene una referencia externa no permitida.")


def _validate_image(path: Path, content: bytes) -> str:
    suffix = path.suffix.lower()
    if suffix == ".svg":
        _validate_svg(content)
    elif suffix == ".png":
        if not content.startswith(b"\x89PNG\r\n\x1a\n"):
            raise CommandError("La imagen .png no tiene una firma PNG válida.")
    elif suffix in {".jpg", ".jpeg"}:
        if not (content.startswith(b"\xff\xd8\xff") and content.endswith(b"\xff\xd9")):
            raise CommandError("La imagen JPEG no tiene una firma válida.")
    elif suffix == ".webp":
        if not (content.startswith(b"RIFF") and content[8:12] == b"WEBP"):
            raise CommandError("La imagen .webp no tiene una firma WEBP válida.")
    else:
        raise CommandError("La imagen debe ser SVG, PNG, JPEG o WEBP.")
    return suffix


def _load_json(path: Path, content: bytes) -> Any:
    if path.suffix.lower() != ".json":
        raise CommandError("La salida de LibreDWG debe tener extensión .json.")
    try:
        return json.loads(content.decode("utf-8-sig"))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise CommandError(f"El JSON de LibreDWG no es válido: {exc}") from exc


def _normalized_entity_type(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    return re.sub(r"[^A-Z]", "", value.upper())


def _walk_text_entities(node: Any) -> Iterator[dict]:
    if isinstance(node, dict):
        entity_type = next(
            (
                _normalized_entity_type(node[key])
                for key in TYPE_KEYS
                if key in node and _normalized_entity_type(node[key]) in TEXT_TYPES
            ),
            "",
        )
        if entity_type:
            yield node
            return
        for value in node.values():
            yield from _walk_text_entities(value)
    elif isinstance(node, list):
        for value in node:
            yield from _walk_text_entities(value)


def _walk_dicts(node: Any) -> Iterator[dict]:
    if isinstance(node, dict):
        yield node
        for value in node.values():
            yield from _walk_dicts(value)
    elif isinstance(node, list):
        for value in node:
            yield from _walk_dicts(value)


def _handle_key(value: Any) -> str | None:
    if isinstance(value, (list, tuple)) and value:
        return str(value[-1])
    if isinstance(value, (str, int)):
        return str(value)
    return None


def _layer_lookup(document: Any) -> dict[str, str]:
    lookup: dict[str, str] = {}
    for item in _walk_dicts(document):
        if _normalized_entity_type(item.get("object")) != "LAYER":
            continue
        name = item.get("name")
        handle = _handle_key(item.get("handle"))
        if handle and isinstance(name, str) and name.strip():
            lookup[handle] = name.strip()
    return lookup


def _find_key(node: Any, key: str) -> Any:
    if isinstance(node, dict):
        if key in node:
            return node[key]
        for value in node.values():
            found = _find_key(value, key)
            if found is not None:
                return found
    elif isinstance(node, list):
        for value in node:
            found = _find_key(value, key)
            if found is not None:
                return found
    return None


def _first_value(node: dict, keys: tuple[str, ...]) -> Any:
    for key in keys:
        value = _find_key(node, key)
        if value is not None:
            return value
    return None


def _as_decimal(value: Any, label: str) -> Decimal:
    try:
        decimal_value = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise CommandError(f"{label} no es una coordenada decimal válida: {value!r}") from exc
    if not decimal_value.is_finite():
        raise CommandError(f"{label} debe ser un número finito.")
    return decimal_value


def _point_from_value(value: Any) -> tuple[Decimal, Decimal] | None:
    if isinstance(value, dict):
        x = value.get("x", value.get("X"))
        y = value.get("y", value.get("Y"))
        if x is not None and y is not None:
            return _as_decimal(x, "X"), _as_decimal(y, "Y")
    if isinstance(value, (list, tuple)) and len(value) >= 2:
        return _as_decimal(value[0], "X"), _as_decimal(value[1], "Y")
    return None


def _extract_point(entity: dict) -> tuple[Decimal, Decimal] | None:
    for key in POINT_KEYS:
        point = _point_from_value(_find_key(entity, key))
        if point:
            return point
    direct = _point_from_value(entity)
    if direct:
        return direct
    return None


def _source_index(entity: dict, fallback: int) -> int:
    raw_value = _first_value(entity, ("source_index", "index", "object_index"))
    if raw_value is None:
        return fallback
    if isinstance(raw_value, bool):
        raise CommandError("El índice de entidad LibreDWG no puede ser booleano.")
    try:
        value = int(raw_value)
    except (TypeError, ValueError) as exc:
        raise CommandError(f"Índice de entidad LibreDWG inválido: {raw_value!r}") from exc
    if value < 0:
        raise CommandError("El índice de entidad LibreDWG no puede ser negativo.")
    return value


def _clean_label(value: str) -> str:
    cleaned = value.replace("\\P", " ").replace("\r", " ").replace("\n", " ")
    return re.sub(r"\s+", " ", cleaned).strip()[:255]


def extract_candidates(document: Any) -> tuple[list[TextCandidate], int]:
    candidates: list[TextCandidate] = []
    text_entity_count = 0
    layers = _layer_lookup(document)
    for fallback_index, entity in enumerate(_walk_text_entities(document)):
        text_entity_count += 1
        text_value = _first_value(entity, TEXT_KEYS)
        if not isinstance(text_value, str):
            continue
        match = FM_CODE_PATTERN.search(text_value)
        if not match:
            continue
        point = _extract_point(entity)
        if point is None:
            raise CommandError(
                f"La entidad de texto #{fallback_index} contiene un código FM pero no coordenadas."
            )
        raw_code = f"{match.group('prefix').upper()}-{match.group('suffix').upper()}"
        layer_value = _first_value(entity, ("layer", "layer_name"))
        layer_handle = _handle_key(layer_value)
        if layer_handle and layer_handle in layers:
            layer = layers[layer_handle]
        elif isinstance(layer_value, (list, tuple)):
            layer = f"handle:{'/'.join(str(value) for value in layer_value)}"
        else:
            layer = str(layer_value or "")
        candidates.append(
            TextCandidate(
                source_index=_source_index(entity, fallback_index),
                raw_code=raw_code,
                prefix=match.group("prefix").upper(),
                label=_clean_label(text_value),
                layer=layer[:120],
                source_x=point[0],
                source_y=point[1],
            )
        )
    return candidates, text_entity_count


class Command(BaseCommand):
    help = "Importa marcadores FM desde JSON LibreDWG y una representación visual."

    def add_arguments(self, parser):
        parser.add_argument("--json", dest="json_path", type=Path, required=True)
        parser.add_argument("--image", type=Path, required=True)
        parser.add_argument("--dwg", type=Path, required=True)
        parser.add_argument("--dwg-sha256")
        parser.add_argument("--code", required=True)
        parser.add_argument("--name", required=True)
        parser.add_argument("--plan-version", dest="plan_version", required=True)
        parser.add_argument("--level", dest="level_name", required=True)
        for coordinate in ("min-x", "min-y", "max-x", "max-y"):
            parser.add_argument(f"--{coordinate}", type=Decimal, required=True)
        parser.add_argument(
            "--replace",
            action="store_true",
            help="Actualiza el plano existente y reemplaza sus marcadores atómicamente.",
        )

    def handle(self, *args, **options):
        json_path = options["json_path"]
        image_path = options["image"]
        dwg_path = options["dwg"]
        json_content = _read_file(json_path, "El JSON LibreDWG")
        image_content = _read_file(image_path, "La imagen del plano")
        dwg_content = _read_file(dwg_path, "El DWG original")
        image_suffix = _validate_image(image_path, image_content)
        dwg_sha256 = _validate_dwg(dwg_path, dwg_content, options.get("dwg_sha256"))
        document = _load_json(json_path, json_content)
        candidates, text_entity_count = extract_candidates(document)
        bounds = Bounds(
            min_x=options["min_x"],
            min_y=options["min_y"],
            max_x=options["max_x"],
            max_y=options["max_y"],
        )
        bounds.validate()

        code = options["code"].strip().upper()
        name = options["name"].strip()
        version = options["plan_version"].strip()
        level_name = options["level_name"].strip()
        if not code or not name or not version or not level_name:
            raise CommandError("Código, nombre, versión y nivel no pueden estar vacíos.")
        if len(code) > 40 or len(name) > 160 or len(version) > 40 or len(level_name) > 100:
            raise CommandError("Los metadatos del plano exceden la longitud permitida.")

        new_image_name: str | None = None
        old_image_name: str | None = None
        image_storage = FacilityPlan._meta.get_field("image").storage
        try:
            with transaction.atomic():
                existing = FacilityPlan.objects.select_for_update().filter(code=code).first()
                if existing and not options["replace"]:
                    raise CommandError(
                        f"Ya existe el plano {code}; usa --replace para actualizarlo."
                    )

                taxonomy_map = {
                    taxonomy.prefix.upper(): taxonomy
                    for taxonomy in Taxonomy.objects.filter(
                        prefix__in={item.prefix for item in candidates}
                    )
                    if taxonomy.prefix
                }
                recognized = [item for item in candidates if item.prefix in taxonomy_map]
                source_indexes = [item.source_index for item in recognized]
                if len(source_indexes) != len(set(source_indexes)):
                    raise CommandError(
                        "Dos marcadores reconocidos comparten el mismo source_index."
                    )
                exact_codes = {
                    item.raw_code for item in recognized if not item.raw_code.endswith("-XXXX")
                }
                assets_by_code = {
                    asset.fm_code: asset
                    for asset in Asset.objects.select_related("taxonomy").filter(
                        fm_code__in=exact_codes
                    )
                }

                plan = existing or FacilityPlan(code=code)
                created = existing is None
                old_image_name = plan.image.name if plan.image else None
                image_hash = _sha256(image_content)
                safe_code = re.sub(r"[^A-Z0-9_-]+", "-", code).strip("-")
                safe_version = re.sub(r"[^A-Za-z0-9_-]+", "-", version).strip("-")
                storage_filename = f"{safe_code}-{safe_version}-{image_hash[:12]}{image_suffix}"
                plan.name = name
                plan.version = version
                plan.level_name = level_name
                plan.source_filename = dwg_path.name
                plan.source_sha256 = dwg_sha256
                plan.min_x = bounds.min_x.quantize(DECIMAL_SIX)
                plan.min_y = bounds.min_y.quantize(DECIMAL_SIX)
                plan.max_x = bounds.max_x.quantize(DECIMAL_SIX)
                plan.max_y = bounds.max_y.quantize(DECIMAL_SIX)
                plan.active = True
                plan.metadata = {
                    "format": "LibreDWG JSON",
                    "json_filename": json_path.name,
                    "image_filename": image_path.name,
                    "image_sha256": image_hash,
                    "dwg_header": dwg_content[:6].decode("ascii"),
                    "text_entities": text_entity_count,
                    "code_candidates": len(candidates),
                    "recognized_markers": len(recognized),
                    "skipped_unknown_prefixes": sorted(
                        {item.prefix for item in candidates} - set(taxonomy_map)
                    ),
                    "imported_at": timezone.now().isoformat(),
                }
                plan.image.save(
                    storage_filename,
                    ContentFile(image_content),
                    save=False,
                )
                new_image_name = plan.image.name
                plan.full_clean(exclude=("image",))
                plan.save()

                if existing:
                    plan.markers.all().delete()
                markers = []
                for item in recognized:
                    normalized_x, normalized_y = bounds.normalize(item.source_x, item.source_y)
                    asset = assets_by_code.get(item.raw_code)
                    if item.raw_code.endswith("-XXXX"):
                        status_value = FacilityPlanMarker.Status.PLACEHOLDER
                        asset = None
                    elif asset:
                        status_value = FacilityPlanMarker.Status.MATCHED
                    else:
                        status_value = FacilityPlanMarker.Status.TAXONOMY_ONLY
                    marker = FacilityPlanMarker(
                        plan=plan,
                        source_index=item.source_index,
                        raw_code=item.raw_code,
                        label=item.label,
                        layer=item.layer,
                        source_x=item.source_x.quantize(DECIMAL_SIX, rounding=ROUND_HALF_UP),
                        source_y=item.source_y.quantize(DECIMAL_SIX, rounding=ROUND_HALF_UP),
                        normalized_x=normalized_x,
                        normalized_y=normalized_y,
                        taxonomy=taxonomy_map[item.prefix],
                        asset=asset,
                        status=status_value,
                    )
                    marker.full_clean()
                    markers.append(marker)
                FacilityPlanMarker.objects.bulk_create(markers)

                summary = {
                    "total": len(markers),
                    "matched": sum(
                        item.status == FacilityPlanMarker.Status.MATCHED for item in markers
                    ),
                    "taxonomy_only": sum(
                        item.status == FacilityPlanMarker.Status.TAXONOMY_ONLY for item in markers
                    ),
                    "placeholder": sum(
                        item.status == FacilityPlanMarker.Status.PLACEHOLDER for item in markers
                    ),
                    "unknown": sum(
                        item.status == FacilityPlanMarker.Status.UNKNOWN for item in markers
                    ),
                }
        except Exception:
            if new_image_name and new_image_name != old_image_name:
                image_storage.delete(new_image_name)
            raise

        if old_image_name and old_image_name != new_image_name:
            try:
                image_storage.delete(old_image_name)
            except OSError as exc:
                self.stderr.write(
                    self.style.WARNING(
                        f"El plano se importó, pero no se pudo retirar la imagen anterior: {exc}"
                    )
                )
        self.stdout.write(
            json.dumps(
                {
                    "plan_id": str(plan.id),
                    "code": plan.code,
                    "created": created,
                    "source_sha256": plan.source_sha256,
                    "summary": summary,
                },
                ensure_ascii=False,
                sort_keys=True,
            )
        )
