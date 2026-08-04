"""Export and import application data without copying Django internal tables.

The command intentionally uses Django's model serializers instead of database-level
table copies.  PostgreSQL builds its own schema and internal rows through ``migrate``;
only users, groups and models owned by this project cross the database boundary.
"""

from __future__ import annotations

import hashlib
import json
import os
import tempfile
from collections import Counter
from collections.abc import Iterable
from pathlib import Path
from typing import Any

from django.apps import apps
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.core import serializers
from django.core.management.base import BaseCommand, CommandError
from django.core.management.color import no_style
from django.db import connections, transaction
from django.db.migrations.executor import MigrationExecutor
from django.utils import timezone

BUNDLE_FORMAT = "sgtb-portable-data"
BUNDLE_VERSION = 1
INTEGRITY_ALGORITHM = "sha256"
INTERNAL_MODEL_LABELS = {
    "admin.logentry",
    "auth.permission",
    "contenttypes.contenttype",
    "sessions.session",
    "token_blacklist.blacklistedtoken",
    "token_blacklist.outstandingtoken",
}
RUNTIME_METADATA_FIELDS = {
    "accounts.accountprofile": frozenset({"last_access"}),
}


def _canonical_json(value: Any) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")


def _digest(value: Any) -> str:
    return hashlib.sha256(_canonical_json(value)).hexdigest()


def _without_runtime_metadata(objects: Iterable[dict]) -> list[dict]:
    """Return serialized rows without fields changed by ordinary authentication."""

    normalized: list[dict] = []
    for row in objects:
        fields_to_remove = RUNTIME_METADATA_FIELDS.get(row.get("model"), ())
        if not fields_to_remove:
            normalized.append(row)
            continue
        normalized.append(
            {
                **row,
                "fields": {
                    key: value
                    for key, value in row.get("fields", {}).items()
                    if key not in fields_to_remove
                },
            }
        )
    return normalized


def _project_models() -> list[type]:
    """Return portable models in foreign-key dependency order."""

    selected: list[type] = [Group, get_user_model()]
    for app_config in apps.get_app_configs():
        if not app_config.name.startswith("apps."):
            continue
        selected.extend(
            model
            for model in app_config.get_models()
            if model._meta.managed
            and not model._meta.proxy
            and not model._meta.auto_created
        )

    unique = {model._meta.label_lower: model for model in selected}
    dependencies: dict[str, set[str]] = {label: set() for label in unique}
    for label, model in unique.items():
        for field in model._meta.get_fields():
            if field.auto_created and not field.concrete:
                continue
            related_model = getattr(field, "related_model", None)
            if related_model is None:
                continue
            related_label = related_model._meta.label_lower
            if related_label in unique and related_label != label:
                dependencies[label].add(related_label)

    ordered: list[type] = []
    remaining = dict(dependencies)
    while remaining:
        ready = sorted(label for label, deps in remaining.items() if not deps)
        if not ready:
            cycle = ", ".join(sorted(remaining))
            raise CommandError(
                "No se pudo ordenar el modelo portable por dependencias: " + cycle
            )
        for label in ready:
            ordered.append(unique[label])
            remaining.pop(label)
        for deps in remaining.values():
            deps.difference_update(ready)
    return ordered


def _serialize_models(
    models: Iterable[type], database: str
) -> tuple[list[dict], dict[str, int]]:
    objects: list[dict] = []
    counts: dict[str, int] = {}
    for model in models:
        label = model._meta.label_lower
        queryset = model._default_manager.using(database).order_by(model._meta.pk.name)
        serialized = serializers.serialize(
            "json",
            queryset.iterator(chunk_size=500),
            use_natural_foreign_keys=True,
            use_natural_primary_keys=True,
        )
        rows = json.loads(serialized)
        rows.sort(key=_canonical_json)
        counts[label] = len(rows)
        objects.extend(rows)
    return objects, counts


def _applied_migrations(database: str) -> list[list[str]]:
    executor = MigrationExecutor(connections[database])
    return [list(item) for item in sorted(executor.loader.applied_migrations)]


def _assert_schema_is_current(database: str) -> None:
    connection = connections[database]
    executor = MigrationExecutor(connection)
    plan = executor.migration_plan(executor.loader.graph.leaf_nodes())
    if plan:
        pending = ", ".join(
            f"{migration.app_label}.{migration.name}" for migration, _ in plan
        )
        raise CommandError(
            "Hay migraciones de esquema pendientes. Ejecute `manage.py migrate` primero: "
            + pending
        )


def _load_and_validate_bundle(path: Path) -> dict:
    try:
        bundle = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise CommandError(f"No existe el bundle: {path}") from exc
    except (OSError, json.JSONDecodeError) as exc:
        raise CommandError(f"No se pudo leer el bundle: {exc}") from exc

    if bundle.get("format") != BUNDLE_FORMAT or bundle.get("version") != BUNDLE_VERSION:
        raise CommandError("El archivo no es un bundle portable SGTB compatible.")

    integrity = bundle.get("integrity") or {}
    if integrity.get("algorithm") != INTEGRITY_ALGORITHM:
        raise CommandError("El bundle no declara una integridad SHA-256 compatible.")
    unsigned = dict(bundle)
    unsigned.pop("integrity", None)
    expected = _digest(unsigned)
    if integrity.get("digest") != expected:
        raise CommandError(
            "La firma SHA-256 del bundle no coincide; el archivo fue alterado."
        )

    models = _project_models()
    expected_labels = [model._meta.label_lower for model in models]
    if bundle.get("models") != expected_labels:
        raise CommandError(
            "El conjunto u orden de modelos no coincide con esta versión de la aplicación."
        )
    object_labels = [row.get("model") for row in bundle.get("objects", [])]
    unsafe = sorted(set(object_labels) & INTERNAL_MODEL_LABELS)
    unknown = sorted(set(object_labels) - set(expected_labels))
    if unsafe or unknown:
        details = ", ".join(unsafe + unknown)
        raise CommandError("El bundle contiene modelos no permitidos: " + details)

    actual_counts = Counter(object_labels)
    declared_counts = bundle.get("counts") or {}
    if any(
        actual_counts[label] != declared_counts.get(label) for label in expected_labels
    ):
        raise CommandError(
            "Los conteos declarados no coinciden con los objetos del bundle."
        )
    if bundle.get("data_digest") != _digest(bundle.get("objects", [])):
        raise CommandError("La huella de los datos del bundle no coincide.")
    return bundle


class Command(BaseCommand):
    help = (
        "Migra datos de negocio de SQLite a PostgreSQL mediante un bundle portable; "
        "no copia tablas internas de Django."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "action", choices=("export", "validate", "import", "verify")
        )
        parser.add_argument("--database", default="default")
        parser.add_argument("--output", type=Path)
        parser.add_argument("--input", type=Path)
        parser.add_argument(
            "--replace-bootstrap-taxonomy",
            action="store_true",
            help=(
                "Permite reemplazar exclusivamente los datos bootstrap intactos que crean "
                "las migraciones en un PostgreSQL nuevo."
            ),
        )
        parser.add_argument(
            "--allow-runtime-metadata",
            action="store_true",
            help=(
                "En verify, permite diferencias exclusivamente en metadatos operativos "
                "volátiles, como la fecha del último acceso."
            ),
        )

    def handle(self, *args, **options):
        action = options["action"]
        database = options["database"]
        if database not in connections:
            raise CommandError(f"La conexión de base de datos `{database}` no existe.")
        if action == "export":
            self._export(database, options["output"])
            return

        input_path = options["input"]
        if input_path is None:
            raise CommandError(f"La acción `{action}` requiere --input.")
        bundle = _load_and_validate_bundle(input_path.resolve())
        if action == "validate":
            self.stdout.write(
                self.style.SUCCESS(
                    f"Bundle válido: {sum(bundle['counts'].values())} objetos, "
                    f"SHA-256 {bundle['integrity']['digest']}."
                )
            )
        elif action == "import":
            self._import(
                database,
                bundle,
                replace_bootstrap=options["replace_bootstrap_taxonomy"],
            )
        else:
            self._verify(
                database,
                bundle,
                allow_runtime_metadata=options["allow_runtime_metadata"],
            )

    def _export(self, database: str, output_path: Path | None) -> None:
        if output_path is None:
            raise CommandError("La acción `export` requiere --output.")
        connection = connections[database]
        if connection.vendor != "sqlite":
            raise CommandError(
                "La exportación de transición debe ejecutarse contra SQLite."
            )
        with transaction.atomic(using=database):
            _assert_schema_is_current(database)
            models = _project_models()
            objects, counts = _serialize_models(models, database)
            unsigned = {
                "format": BUNDLE_FORMAT,
                "version": BUNDLE_VERSION,
                "created_at": timezone.now().isoformat(),
                "source": {
                    "vendor": connection.vendor,
                    "database": Path(str(connection.settings_dict["NAME"])).name,
                },
                "migrations": _applied_migrations(database),
                "models": [model._meta.label_lower for model in models],
                "counts": counts,
                "data_digest": _digest(objects),
                "objects": objects,
            }
        bundle = dict(unsigned)
        bundle["integrity"] = {
            "algorithm": INTEGRITY_ALGORITHM,
            "digest": _digest(unsigned),
        }

        destination = output_path.resolve()
        if destination.exists():
            raise CommandError(
                f"El archivo ya existe y no será sobrescrito: {destination}"
            )
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary_name: str | None = None
        try:
            with tempfile.NamedTemporaryFile(
                "w",
                encoding="utf-8",
                newline="\n",
                dir=destination.parent,
                prefix=f".{destination.name}.",
                suffix=".tmp",
                delete=False,
            ) as temporary:
                json.dump(
                    bundle, temporary, ensure_ascii=False, indent=2, sort_keys=True
                )
                temporary.write("\n")
                temporary.flush()
                os.fsync(temporary.fileno())
                temporary_name = temporary.name
            os.replace(temporary_name, destination)
        finally:
            if temporary_name and Path(temporary_name).exists():
                Path(temporary_name).unlink()

        self.stdout.write(
            self.style.SUCCESS(
                f"Bundle exportado en {destination}: {len(objects)} objetos; "
                "sin tablas internas de Django."
            )
        )

    def _import(self, database: str, bundle: dict, *, replace_bootstrap: bool) -> None:
        connection = connections[database]
        if connection.vendor != "postgresql":
            raise CommandError("La importación solo se permite sobre PostgreSQL.")
        _assert_schema_is_current(database)
        if bundle["migrations"] != _applied_migrations(database):
            raise CommandError(
                "El esquema PostgreSQL no tiene exactamente las mismas migraciones que el origen."
            )

        models = _project_models()
        with transaction.atomic(using=database):
            self._prepare_empty_target(database, models, replace_bootstrap)
            serialized = json.dumps(bundle["objects"], ensure_ascii=False)
            try:
                with connection.constraint_checks_disabled():
                    for item in serializers.deserialize(
                        "json", serialized, using=database
                    ):
                        item.save(using=database)
                connection.check_constraints()
                self._reset_sequences(connection, models)
                self._assert_data_matches(database, bundle, models)
            except Exception as exc:
                raise CommandError(
                    f"La importación fue revertida por completo: {exc}"
                ) from exc

        self.stdout.write(
            self.style.SUCCESS(
                f"Importación completada y verificada: {sum(bundle['counts'].values())} objetos."
            )
        )

    def _verify(
        self,
        database: str,
        bundle: dict,
        *,
        allow_runtime_metadata: bool = False,
    ) -> None:
        connection = connections[database]
        if connection.vendor != "postgresql":
            raise CommandError(
                "La verificación de destino solo se permite sobre PostgreSQL."
            )
        _assert_schema_is_current(database)
        if bundle["migrations"] != _applied_migrations(database):
            raise CommandError(
                "Las migraciones del destino no coinciden con el bundle."
            )
        self._assert_data_matches(
            database,
            bundle,
            _project_models(),
            allow_runtime_metadata=allow_runtime_metadata,
        )
        suffix = (
            " salvo metadatos operativos permitidos"
            if allow_runtime_metadata
            else " íntegramente"
        )
        self.stdout.write(
            self.style.SUCCESS(f"PostgreSQL coincide con el bundle{suffix}.")
        )

    def _prepare_empty_target(
        self,
        database: str,
        models: list[type],
        replace_bootstrap: bool,
    ) -> None:
        taxonomy = apps.get_model("assets", "Taxonomy")
        taxonomy_sequence = apps.get_model("assets", "TaxonomySequence")
        location = apps.get_model("assets", "Location")
        privacy_notice = apps.get_model("privacy", "PrivacyNotice")
        processing_inventory = apps.get_model("privacy", "ProcessingInventory")
        user_model = get_user_model()
        allowed_bootstrap = {taxonomy, taxonomy_sequence, location, user_model, privacy_notice, processing_inventory}
        occupied = {
            model._meta.label_lower: model._default_manager.using(database).count()
            for model in models
            if model._default_manager.using(database).exists()
        }
        non_bootstrap = {
            label: count
            for label, count in occupied.items()
            if apps.get_model(label) not in allowed_bootstrap
        }
        if non_bootstrap:
            details = ", ".join(
                f"{label}={count}" for label, count in non_bootstrap.items()
            )
            raise CommandError(
                "El PostgreSQL de destino contiene datos de aplicación; no se modificó nada: "
                + details
            )

        if not occupied:
            return
        if not replace_bootstrap:
            raise CommandError(
                "El destino contiene la taxonomía bootstrap creada por migrate. Revise el "
                "destino y repita con --replace-bootstrap-taxonomy."
            )
        if not self._is_pristine_bootstrap_taxonomy(
            database, taxonomy, taxonomy_sequence
        ) or not self._is_pristine_bootstrap_locations(database, location) or not self._is_pristine_bootstrap_user(database, user_model) or privacy_notice._default_manager.using(database).count() != 1 or processing_inventory._default_manager.using(database).count() != 3:
            raise CommandError(
                "Los datos del destino no coinciden exactamente con el bootstrap; "
                "no se modificó nada."
            )
        location._default_manager.using(database).all().delete()
        taxonomy_sequence._default_manager.using(database).all().delete()
        taxonomy._default_manager.using(database).all().delete()
        processing_inventory._default_manager.using(database).all().delete()
        privacy_notice._default_manager.using(database).all().delete()
        user_model._default_manager.using(database).all().delete()

    @staticmethod
    def _is_pristine_bootstrap_user(database: str, user_model: type) -> bool:
        users = list(user_model._default_manager.using(database).all())
        if not users:
            return True
        if len(users) != 1:
            return False
        user = users[0]
        return (
            user.username == "facility.demo"
            and user.password == ""
            and user.first_name == ""
            and user.last_name == ""
            and user.email == ""
            and user.last_login is None
            and not user.is_staff
            and not user.is_superuser
            and user.is_active
            and not user.groups.exists()
            and not user.user_permissions.exists()
        )

    def _is_pristine_bootstrap_taxonomy(
        self, database: str, taxonomy: type, taxonomy_sequence: type
    ) -> bool:
        catalog_path = (
            Path(settings.BASE_DIR) / "apps" / "taxonomy" / "data" / "catalog_v1.json"
        )
        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
        expected: dict[str, dict[str, Any]] = {}
        for row in catalog["taxonomies"]:
            prefix = row["prefix"].strip().upper()
            expected[prefix] = {
                "name": row["name"],
                "asset_type": row["asset_type"],
                "category": row["category"],
                "subcategory": row["subcategory"],
                "specialty": row["specialty"],
                "sequence_digits": row["sequence_digits"],
                "default_criticality": row.get("default_criticality", "Media"),
                "useful_life_years": row.get("useful_life_years"),
                "preventive_frequency_months": row.get("preventive_frequency_months"),
                "requires_maintenance": row.get("requires_maintenance", False),
                "requires_certification": row.get("requires_certification", False),
                "issuance_enabled": True,
                "review_status": "VALIDATED",
                "aliases": row.get("aliases", []),
                "canonical_prefix": prefix,
                "source_version": catalog["version"],
                "notes": row.get("notes", ""),
                "active": True,
                "last_sequence": row["last_sequence"],
            }
        rows = list(taxonomy._default_manager.using(database).all())
        if len(rows) != len(expected):
            return False
        for item in rows:
            reference = expected.get(item.prefix)
            if reference is None:
                return False
            sequence = (
                taxonomy_sequence._default_manager.using(database)
                .filter(taxonomy_id=item.pk)
                .first()
            )
            if sequence is None or sequence.last_value != reference["last_sequence"]:
                return False
            if any(
                getattr(item, field) != value
                for field, value in reference.items()
                if field != "last_sequence"
            ):
                return False
        return taxonomy_sequence._default_manager.using(database).count() == len(
            expected
        )

    @staticmethod
    def _is_pristine_bootstrap_locations(database: str, location: type) -> bool:
        catalog_path = Path(settings.BASE_DIR) / "apps" / "assets" / "data" / "taxonomy_locations_2026.json"
        expected_rows = json.loads(catalog_path.read_text(encoding="utf-8"))
        fields = (
            "zone", "building", "area", "room", "location_code", "source_company",
            "source_row", "source_version", "common_space", "requires_review",
            "review_notes", "active",
        )
        expected = {
            (row["zone"], row["building"], row["area"], row["room"], row["location_code"]): {
                **{field: row[field] for field in fields if field in row},
                "active": True,
            }
            for row in expected_rows
        }
        rows = list(location._default_manager.using(database).all())
        if len(rows) != len(expected):
            return False
        for item in rows:
            key = (item.zone, item.building, item.area, item.room, item.location_code)
            reference = expected.get(key)
            if reference is None or any(getattr(item, field) != value for field, value in reference.items()):
                return False
        return True

    def _assert_data_matches(
        self,
        database: str,
        bundle: dict,
        models: list[type],
        *,
        allow_runtime_metadata: bool = False,
    ) -> None:
        objects, counts = _serialize_models(models, database)
        if counts != bundle["counts"]:
            raise CommandError(
                f"Los conteos del destino difieren. Esperado {bundle['counts']}; obtenido {counts}."
            )
        expected_objects = bundle["objects"]
        if allow_runtime_metadata:
            objects = _without_runtime_metadata(objects)
            expected_objects = _without_runtime_metadata(expected_objects)
        if _digest(objects) != _digest(expected_objects):
            raise CommandError(
                "La huella de datos del destino no coincide con el origen."
            )

    @staticmethod
    def _reset_sequences(connection, models: list[type]) -> None:
        statements = connection.ops.sequence_reset_sql(no_style(), models)
        if not statements:
            return
        with connection.cursor() as cursor:
            for statement in statements:
                cursor.execute(statement)
