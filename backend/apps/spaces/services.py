"""Reglas de dominio y puente con el catálogo legado de ubicaciones."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable
from dataclasses import dataclass

from django.core.exceptions import ObjectDoesNotExist, ValidationError
from django.db import IntegrityError, transaction

from .models import FacilitySite, SpaceNode, normalize_segment_code, normalize_space_text

ROOT_TYPES = {
    SpaceNode.Type.MACRO_AREA,
    SpaceNode.Type.BUILDING,
    SpaceNode.Type.AREA,
}

# No se impone una sola secuencia porque la sede puede estar organizada por
# macroárea/sector/módulo o por edificio/nivel/área. Estas reglas impiden
# rutas sin sentido (por ejemplo, un ambiente como padre de un edificio) sin
# bloquear las dos estructuras institucionales conocidas.
ALLOWED_CHILD_TYPES = {
    SpaceNode.Type.MACRO_AREA: {
        SpaceNode.Type.SECTOR,
        SpaceNode.Type.BUILDING,
        SpaceNode.Type.LEVEL,
        SpaceNode.Type.AREA,
        SpaceNode.Type.MODULE,
        SpaceNode.Type.ENVIRONMENT,
        SpaceNode.Type.SUB_ENVIRONMENT,
    },
    SpaceNode.Type.SECTOR: {
        SpaceNode.Type.BUILDING,
        SpaceNode.Type.LEVEL,
        SpaceNode.Type.AREA,
        SpaceNode.Type.MODULE,
        SpaceNode.Type.ENVIRONMENT,
        SpaceNode.Type.SUB_ENVIRONMENT,
    },
    SpaceNode.Type.BUILDING: {
        SpaceNode.Type.LEVEL,
        SpaceNode.Type.AREA,
        SpaceNode.Type.MODULE,
        SpaceNode.Type.ENVIRONMENT,
        SpaceNode.Type.SUB_ENVIRONMENT,
    },
    SpaceNode.Type.LEVEL: {
        SpaceNode.Type.AREA,
        SpaceNode.Type.MODULE,
        SpaceNode.Type.ENVIRONMENT,
        SpaceNode.Type.SUB_ENVIRONMENT,
    },
    SpaceNode.Type.AREA: {
        SpaceNode.Type.MODULE,
        SpaceNode.Type.ENVIRONMENT,
        SpaceNode.Type.SUB_ENVIRONMENT,
        SpaceNode.Type.POINT,
    },
    SpaceNode.Type.MODULE: {
        SpaceNode.Type.ENVIRONMENT,
        SpaceNode.Type.SUB_ENVIRONMENT,
        SpaceNode.Type.POINT,
    },
    SpaceNode.Type.ENVIRONMENT: {
        SpaceNode.Type.SUB_ENVIRONMENT,
        SpaceNode.Type.POINT,
    },
    SpaceNode.Type.SUB_ENVIRONMENT: {
        SpaceNode.Type.POINT,
    },
    SpaceNode.Type.POINT: set(),
}


class SpatialValidationError(ValidationError):
    """Error de dominio que los serializers traducen a HTTP 400."""


def node_snapshot(node: SpaceNode) -> dict:
    try:
        legacy_location_id = str(node.legacy_location.id)
    except ObjectDoesNotExist:
        legacy_location_id = None
    return {
        "id": str(node.id),
        "site_id": str(node.site_id),
        "parent_id": str(node.parent_id) if node.parent_id else None,
        "node_type": node.node_type,
        "code_segment": node.code_segment,
        "path_code": node.path_code,
        "name": node.name,
        "square_meters": str(node.square_meters) if node.square_meters is not None else None,
        "headcount": node.headcount,
        "common_space": node.common_space,
        "active": node.active,
        "legacy_location_id": legacy_location_id,
    }


def site_snapshot(site: FacilitySite) -> dict:
    return {
        "id": str(site.id),
        "code": site.code,
        "name": site.name,
        "address_line": site.address_line,
        "district": site.district,
        "province": site.province,
        "department": site.department,
        "country": site.country,
        "active": site.active,
    }


def _validate_placement(*, node_type: str, site: FacilitySite, parent: SpaceNode | None, node_id=None):
    # Archivar una sede cierra su arbol: solo la restauracion explicita puede
    # volver a habilitar altas o traslados hacia ella.
    if not site.active:
        raise SpatialValidationError(
            {"site_id": "Primero restaura la sede antes de crear o trasladar espacios."}
        )
    if parent is None:
        if node_type not in ROOT_TYPES:
            raise SpatialValidationError(
                {"parent_id": "Este tipo de nodo requiere un padre dentro de la sede."}
            )
        return

    if parent.site_id != site.id:
        raise SpatialValidationError({"parent_id": "El padre debe pertenecer a la misma sede."})
    if not parent.active:
        raise SpatialValidationError({"parent_id": "No se puede crear un hijo bajo un espacio archivado."})
    if node_id and parent.id == node_id:
        raise SpatialValidationError({"parent_id": "Un espacio no puede ser su propio padre."})
    allowed = ALLOWED_CHILD_TYPES.get(parent.node_type, set())
    if node_type not in allowed:
        raise SpatialValidationError(
            {
                "parent_id": (
                    f"Un nodo de tipo {parent.get_node_type_display()} no puede contener "
                    f"un nodo de tipo {dict(SpaceNode.Type.choices).get(node_type, node_type)}."
                )
            }
        )


def _ancestor_chain(parent: SpaceNode | None) -> list[SpaceNode]:
    chain = []
    seen = set()
    current = parent
    while current is not None:
        if current.id in seen:
            raise SpatialValidationError({"parent_id": "La jerarquía contiene un ciclo."})
        seen.add(current.id)
        chain.append(current)
        current = current.parent
    return list(reversed(chain))


def _candidate_path(*, site: FacilitySite, parent: SpaceNode | None, code_segment: str) -> str:
    segments = [site.code]
    segments.extend(item.code_segment for item in _ancestor_chain(parent))
    segments.append(code_segment)
    return "-".join(segments)


def _subtree_nodes(root: SpaceNode, *, lock: bool = False) -> list[SpaceNode]:
    """Obtiene el subárbol sin asumir que la BD sea recursiva."""

    query = SpaceNode.objects
    if lock:
        query = query.select_for_update()
    nodes = [root]
    frontier = [root.id]
    seen = {root.id}
    while frontier:
        children = list(query.filter(parent_id__in=frontier).order_by("code_segment", "id"))
        frontier = []
        for child in children:
            if child.id not in seen:
                seen.add(child.id)
                nodes.append(child)
                frontier.append(child.id)
    return nodes


def _check_no_cycle(node: SpaceNode, parent: SpaceNode | None):
    if parent is None:
        return
    descendant_ids = {item.id for item in _subtree_nodes(node)}
    if parent.id in descendant_ids:
        raise SpatialValidationError({"parent_id": "No se puede mover un nodo dentro de su propio subárbol."})


def _derive_legacy_fields(node: SpaceNode) -> dict:
    """Proyección reversible hacia Location sin tratarla como fuente de verdad.

    Location continúa atendiendo los mapas, aforo y APIs existentes. El
    ambiente es la única clase espacial que materializa una ubicación plana.
    """

    chain = _ancestor_chain(node.parent) + [node]
    by_type: dict[str, list[SpaceNode]] = defaultdict(list)
    for item in chain:
        by_type[item.node_type].append(item)

    def first_name(*types: str, fallback: str = "") -> str:
        for item_type in types:
            if by_type.get(item_type):
                return by_type[item_type][-1].name
        return fallback

    site_name = node.site.name
    zone = first_name(SpaceNode.Type.MACRO_AREA, SpaceNode.Type.SECTOR, fallback="General")
    building = first_name(
        SpaceNode.Type.BUILDING,
        SpaceNode.Type.SECTOR,
        SpaceNode.Type.MACRO_AREA,
        fallback=site_name,
    )
    level = first_name(SpaceNode.Type.LEVEL)
    area = first_name(
        SpaceNode.Type.AREA,
        SpaceNode.Type.MODULE,
        SpaceNode.Type.SECTOR,
        SpaceNode.Type.MACRO_AREA,
        fallback="General",
    )
    return {
        # Location acepta solo 20 caracteres. Se conserva un identificador
        # compacto y determinista de la ruta espacial, mientras que el path
        # completo sigue disponible en SpaceNode.
        "location_code": _legacy_location_code(node),
        "site": site_name,
        "zone": zone,
        "building": building,
        "level": level,
        "area": area,
        "room": node.name,
        "square_meters": node.square_meters,
        "headcount": node.headcount,
        "common_space": node.common_space,
        "active": bool(node.active and node.site.active),
    }


def _legacy_identity(node: SpaceNode) -> dict:
    """Identidad plana que usaría un ambiente nuevo en el catálogo legado.

    No usamos esta identidad para hacer ``update_or_create``: una coincidencia
    textual puede pertenecer a una ubicación histórica con activos, mapas o
    asignaciones. El enlace es siempre explícito mediante ``space_node``.
    """

    projection = _derive_legacy_fields(node)
    return {
        field: projection[field]
        for field in ("site", "zone", "building", "level", "area", "room")
    }


def _legacy_location_code(node: SpaceNode) -> str:
    import hashlib

    digest = hashlib.sha1(node.path_code.encode("utf-8")).hexdigest()[:16].upper()
    return f"SP-{digest}"


def sync_legacy_location(node: SpaceNode):
    """Crea o actualiza la Location legada para un ambiente.

    No borra registros: el archivo solo cambia ``active`` y preserva los FK de
    activos, asignaciones y mapas históricos.
    """

    if node.node_type != SpaceNode.Type.ENVIRONMENT:
        return None
    from apps.assets.models import Location

    defaults = _derive_legacy_fields(node)
    identity = _legacy_identity(node)
    # Nunca apropiamos una Location histórica por semejanza de texto. Cuando
    # la ruta ya existe, se crea la Location propia del nodo y se marca para
    # conciliación; así no se reubican mapas, activos ni asignaciones por
    # accidente y el CRUD sigue disponible para la nueva estructura.
    conflicting_location = (
        Location.objects.select_for_update()
        .filter(space_node__isnull=True, **identity)
        .first()
    )
    if conflicting_location is not None:
        defaults.update(
            {
                "requires_review": True,
                "review_notes": (
                    "Posible duplicado de una ubicación histórica; "
                    "los activos y mapas anteriores no fueron modificados."
                ),
            }
        )
    location, created = Location.objects.select_for_update().get_or_create(
        space_node=node,
        defaults=defaults,
    )
    if not created:
        # El identificador plano ya pudo haberse impreso o enlazado en un
        # mapa. La ruta espacial sí cambia al trasladar el ambiente, pero el
        # código legado permanece estable y la auditoría conserva el cambio.
        defaults.pop("location_code", None)
    changed_fields = []
    for field, value in defaults.items():
        if getattr(location, field) != value:
            setattr(location, field, value)
            changed_fields.append(field)
    if changed_fields:
        location.save(update_fields=changed_fields)
    return location


def sync_legacy_building_area(node: SpaceNode):
    """Proyecta m² de un edificio nuevo al registro legado de superficies."""

    if node.node_type != SpaceNode.Type.BUILDING:
        return None
    from apps.assets.models import BuildingArea

    projection = _derive_legacy_fields(node)
    identity = {
        field: projection[field]
        for field in ("site", "zone", "building")
    }
    conflicting_area = (
        BuildingArea.objects.select_for_update()
        .filter(space_node__isnull=True, **identity)
        .first()
    )
    if conflicting_area is not None:
        # BuildingArea usa una identidad plana única. No se enlaza ni se
        # modifica el registro histórico por coincidencia de textos; el nodo
        # espacial conserva sus m² y queda disponible para conciliación.
        return None
    building_area, _ = BuildingArea.objects.select_for_update().get_or_create(
        space_node=node,
        defaults={**identity, "square_meters": node.square_meters},
    )
    # La identidad es derivada del árbol y se mantiene actualizada si el
    # edificio se mueve o cambia de nombre.
    identity_changed = any(
        getattr(building_area, field) != value for field, value in identity.items()
    )
    for field, value in identity.items():
        setattr(building_area, field, value)
    if building_area.square_meters != node.square_meters:
        building_area.square_meters = node.square_meters
        building_area.save(update_fields=("site", "zone", "building", "square_meters"))
    elif identity_changed:
        building_area.save(update_fields=("site", "zone", "building"))
    return building_area


def _nearest_building(node: SpaceNode) -> SpaceNode | None:
    current = node
    while current is not None:
        if current.node_type == SpaceNode.Type.BUILDING:
            return current
        current = current.parent
    return None


def sync_building_node_capacity_from_legacy_location(location):
    """Refleja la edición legada de m² de edificio en el árbol nuevo."""

    if not location.space_node_id:
        return None
    environment = SpaceNode.objects.select_related("parent").get(pk=location.space_node_id)
    building = _nearest_building(environment)
    if building is None:
        return None
    from apps.assets.models import BuildingArea

    legacy_area = BuildingArea.objects.filter(space_node=building).first()
    if legacy_area and building.square_meters != legacy_area.square_meters:
        building.square_meters = legacy_area.square_meters
        building.save(update_fields=("square_meters", "updated_at"))
    return building


def sync_node_capacity_from_legacy_location(location):
    """Mantiene m² y aforo coherentes si se usa el endpoint legado de Location."""

    if not location.space_node_id:
        return None
    node = SpaceNode.objects.select_for_update().get(pk=location.space_node_id)
    if node.node_type != SpaceNode.Type.ENVIRONMENT:
        return None
    updates = []
    for field in ("square_meters", "headcount", "common_space"):
        value = getattr(location, field)
        if getattr(node, field) != value:
            setattr(node, field, value)
            updates.append(field)
    if updates:
        node.save(update_fields=updates + ["updated_at"])
    return node


@transaction.atomic
def update_facility_site(*, instance: FacilitySite, data: dict) -> FacilitySite:
    """Edita una sede sin permitir que cambie su código fijo en uso."""

    site = FacilitySite.objects.select_for_update().get(pk=instance.pk)
    requested_code = normalize_segment_code(data.get("code", site.code))
    if requested_code != site.code and SpaceNode.objects.filter(site=site).exists():
        raise SpatialValidationError(
            {"code": "El código de una sede con espacios ya registrados es fijo."}
        )
    previous_name = site.name
    for field in (
        "code",
        "name",
        "address_line",
        "district",
        "province",
        "department",
        "country",
    ):
        if field in data:
            setattr(site, field, data[field])
    site.full_clean()
    if previous_name != site.name and SpaceNode.objects.filter(site=site, node_type=SpaceNode.Type.ENVIRONMENT).exists():
        # La proyección legada muestra el nombre de la sede; se actualiza sin
        # migrar ni tocar las ubicaciones ajenas a este nuevo dominio.
        site.save()
        for environment in SpaceNode.objects.filter(site=site, node_type=SpaceNode.Type.ENVIRONMENT):
            sync_legacy_location(environment)
        return site
    site.save()
    return site


@dataclass
class _PreparedNode:
    node: SpaceNode
    path_code: str
    site_id: object


def _prepare_subtree_paths(root: SpaceNode, *, new_site: FacilitySite, new_parent: SpaceNode | None) -> list[_PreparedNode]:
    locked_nodes = _subtree_nodes(root, lock=True)
    children_by_parent: dict[object, list[SpaceNode]] = defaultdict(list)
    for item in locked_nodes:
        if item.parent_id:
            children_by_parent[item.parent_id].append(item)

    result: list[_PreparedNode] = []

    def walk(item: SpaceNode, parent_path: str | None, site_id):
        path = f"{parent_path}-{item.code_segment}" if parent_path else f"{new_site.code}-{item.code_segment}"
        result.append(_PreparedNode(item, path, site_id))
        for child in children_by_parent.get(item.id, []):
            walk(child, path, site_id)

    # root might be moved. Parent path includes the selected parent and site.
    parent_path = None
    if new_parent is not None:
        parent_path = new_parent.path_code
    walk(root, parent_path, new_site.id)
    return result


def _assert_paths_available(prepared: Iterable[_PreparedNode], *, subtree_ids: set):
    paths = [item.path_code for item in prepared]
    if len(paths) != len(set(paths)):
        raise SpatialValidationError({"code_segment": "El traslado genera rutas duplicadas."})
    existing = SpaceNode.objects.filter(path_code__in=paths).exclude(pk__in=subtree_ids)
    if existing.exists():
        raise SpatialValidationError({"code_segment": "Ya existe un espacio con una de las rutas resultantes."})


@transaction.atomic
def create_space_node(*, data: dict) -> SpaceNode:
    site: FacilitySite = FacilitySite.objects.select_for_update().get(pk=data["site"].pk)
    parent = data.get("parent")
    if parent is not None:
        # parent es nullable; no se une aquí para que PostgreSQL pueda bloquear
        # únicamente la fila sin intentar bloquear el lado nulo del OUTER JOIN.
        parent = SpaceNode.objects.select_for_update().select_related("site").get(pk=parent.pk)
    node_type = data["node_type"]
    code_segment = normalize_segment_code(data["code_segment"])
    _validate_placement(node_type=node_type, site=site, parent=parent)
    path_code = _candidate_path(site=site, parent=parent, code_segment=code_segment)
    if SpaceNode.objects.filter(path_code=path_code).exists():
        raise SpatialValidationError({"code_segment": "Ya existe un espacio con esta ruta."})
    clean_name = normalize_space_text(data["name"])
    if parent is not None:
        if SpaceNode.objects.filter(parent=parent, normalized_name=clean_name.casefold()).exists():
            raise SpatialValidationError({"name": f"Ya existe un espacio con el nombre '{clean_name}' en este nivel."})
    else:
        if SpaceNode.objects.filter(site=site, parent__isnull=True, normalized_name=clean_name.casefold()).exists():
            raise SpatialValidationError({"name": f"Ya existe un espacio raíz con el nombre '{clean_name}' en esta sede."})
    node = SpaceNode(
        site=site,
        parent=parent,
        node_type=node_type,
        code_segment=code_segment,
        path_code=path_code,
        name=clean_name,
        square_meters=data.get("square_meters"),
        headcount=data.get("headcount"),
        common_space=data.get("common_space", False),
        active=data.get("active", True),
    )
    node.full_clean()
    try:
        node.save()
    except IntegrityError as exc:
        raise SpatialValidationError({"code_segment": "El código ya está usado en ese nivel."}) from exc
    sync_legacy_location(node)
    sync_legacy_building_area(node)
    return node


@transaction.atomic
def update_space_node(*, instance: SpaceNode, data: dict) -> SpaceNode:
    node = SpaceNode.objects.select_for_update().select_related("site").get(pk=instance.pk)
    previous_name = node.name
    previous_type = node.node_type
    requested_parent = data.pop("parent", node.parent)
    requested_site = data.pop("site", node.site)
    requested_site = FacilitySite.objects.select_for_update().get(pk=requested_site.pk)
    if requested_parent is not None:
        requested_parent = SpaceNode.objects.select_for_update().select_related("site").get(pk=requested_parent.pk)
        if requested_site.id != requested_parent.site_id:
            raise SpatialValidationError({"site_id": "La sede debe coincidir con la del padre."})
    requested_type = data.get("node_type", node.node_type)
    requested_segment = normalize_segment_code(data.get("code_segment", node.code_segment))
    _check_no_cycle(node, requested_parent)
    _validate_placement(
        node_type=requested_type,
        site=requested_site,
        parent=requested_parent,
        node_id=node.id,
    )
    if requested_type != node.node_type:
        if node.node_type == SpaceNode.Type.ENVIRONMENT and requested_type != SpaceNode.Type.ENVIRONMENT:
            try:
                legacy_location = node.legacy_location
            except ObjectDoesNotExist:
                legacy_location = None
            if legacy_location is not None:
                raise SpatialValidationError(
                    {"node_type": "Un ambiente vinculado a Location no puede cambiar de tipo."}
                )
        invalid_children = [
            child.get_node_type_display()
            for child in SpaceNode.objects.filter(parent=node)
            if child.node_type not in ALLOWED_CHILD_TYPES.get(requested_type, set())
        ]
        if invalid_children:
            raise SpatialValidationError(
                {"node_type": "El nuevo tipo no es compatible con sus espacios hijos."}
            )

    requested_name = normalize_space_text(data.get("name", node.name))
    if requested_parent is not None:
        if SpaceNode.objects.filter(parent=requested_parent, normalized_name=requested_name.casefold()).exclude(pk=node.id).exists():
            raise SpatialValidationError({"name": f"Ya existe otro espacio con el nombre '{requested_name}' en este nivel."})
    else:
        if SpaceNode.objects.filter(site=requested_site, parent__isnull=True, normalized_name=requested_name.casefold()).exclude(pk=node.id).exists():
            raise SpatialValidationError({"name": f"Ya existe otro espacio raíz con el nombre '{requested_name}' en esta sede."})

    structural_change = (
        node.site_id != requested_site.id
        or node.parent_id != (requested_parent.id if requested_parent else None)
        or node.code_segment != requested_segment
    )
    for field in ("node_type", "name", "square_meters", "headcount", "common_space"):
        if field in data:
            setattr(node, field, data[field])
    node.site = requested_site
    node.parent = requested_parent
    node.code_segment = requested_segment
    node.name = normalize_space_text(node.name)
    node.normalized_name = node.name.casefold()

    projection_change = structural_change or previous_name != node.name or previous_type != node.node_type
    if structural_change:
        prepared = _prepare_subtree_paths(node, new_site=requested_site, new_parent=requested_parent)
        _assert_paths_available(prepared, subtree_ids={entry.node.id for entry in prepared})
        # Save the root first so validation and constraints are enforced. The
        # descendant paths are persisted in topological order afterwards.
        node.path_code = prepared[0].path_code
        node.full_clean()
        node.save()
        for entry in prepared[1:]:
            child = entry.node
            child.site_id = entry.site_id
            child.path_code = entry.path_code
            child.save(update_fields=("site", "path_code", "updated_at"))
        affected_nodes = [entry.node for entry in prepared]
    else:
        node.full_clean()
        node.save()
        affected_nodes = _subtree_nodes(node) if projection_change else [node]

    for affected in affected_nodes:
        if affected.node_type == SpaceNode.Type.ENVIRONMENT:
            sync_legacy_location(affected)
        elif affected.node_type == SpaceNode.Type.BUILDING:
            sync_legacy_building_area(affected)
    return node


@transaction.atomic
def archive_space_node(node: SpaceNode) -> SpaceNode:
    node = SpaceNode.objects.select_for_update().select_related("site").get(pk=node.pk)
    if not node.active:
        return node
    if SpaceNode.objects.filter(parent=node, active=True).exists():
        raise SpatialValidationError(
            {"detail": "Archiva o traslada primero los espacios hijos activos."}
        )
    node.active = False
    node.save(update_fields=("active", "updated_at"))
    sync_legacy_location(node)
    return node


@transaction.atomic
def restore_space_node(node: SpaceNode) -> SpaceNode:
    node = SpaceNode.objects.select_for_update().select_related("site").get(pk=node.pk)
    if node.active:
        return node
    if not node.site.active:
        raise SpatialValidationError({"detail": "Primero restaura la sede del espacio."})
    if node.parent_id and not node.parent.active:
        raise SpatialValidationError({"detail": "Primero restaura el espacio padre."})
    node.active = True
    node.save(update_fields=("active", "updated_at"))
    sync_legacy_location(node)
    return node


@transaction.atomic
def archive_site(site: FacilitySite) -> FacilitySite:
    site = FacilitySite.objects.select_for_update().get(pk=site.pk)
    if not site.active:
        return site
    if SpaceNode.objects.filter(site=site, active=True).exists():
        raise SpatialValidationError({"detail": "Archiva primero todos los espacios activos de la sede."})
    site.active = False
    site.save(update_fields=("active", "updated_at"))
    return site


@transaction.atomic
def restore_site(site: FacilitySite) -> FacilitySite:
    site = FacilitySite.objects.select_for_update().get(pk=site.pk)
    if not site.active:
        site.active = True
        site.save(update_fields=("active", "updated_at"))
    return site


def calculate_node_impact(node: SpaceNode) -> dict:
    """Expone dependencias antes de archivar o reordenar un espacio."""

    descendants = _subtree_nodes(node)
    node_ids = [item.id for item in descendants]
    from apps.assets.models import Asset, AssetAssignment, Location, LocationMap

    locations = Location.objects.filter(space_node_id__in=node_ids)
    return {
        "node_id": str(node.id),
        "active_children": SpaceNode.objects.filter(parent=node, active=True).count(),
        "descendant_count": max(len(descendants) - 1, 0),
        "environment_count": sum(item.node_type == SpaceNode.Type.ENVIRONMENT for item in descendants),
        "legacy_location_count": locations.count(),
        "asset_count": Asset.objects.filter(location__in=locations).count(),
        "assignment_count": AssetAssignment.objects.filter(location__in=locations).count(),
        "active_map_count": LocationMap.objects.filter(location__in=locations, active=True).count(),
        "can_archive": not SpaceNode.objects.filter(parent=node, active=True).exists(),
    }
