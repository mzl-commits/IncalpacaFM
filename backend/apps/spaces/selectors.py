"""Consultas de lectura del dominio espacial."""

from __future__ import annotations

from collections import defaultdict

from django.db.models import Q

from .models import FacilitySite, SpaceNode


def active_flag(value: str | None, *, default: bool | None = True) -> bool | None:
    if value is None:
        return default
    if value.lower() in {"1", "true", "si", "sí"}:
        return True
    if value.lower() in {"0", "false", "no"}:
        return False
    if value.lower() in {"all", "todos"}:
        return None
    return default


def list_sites(*, active: bool | None = True):
    queryset = FacilitySite.objects.all()
    if active is not None:
        queryset = queryset.filter(active=active)
    return queryset.order_by("code", "name")


def list_nodes(*, site_id=None, parent_id=None, node_type=None, active: bool | None = True, query=None):
    queryset = SpaceNode.objects.select_related("site", "parent")
    if site_id:
        queryset = queryset.filter(site_id=site_id)
    if parent_id == "root":
        queryset = queryset.filter(parent__isnull=True)
    elif parent_id:
        queryset = queryset.filter(parent_id=parent_id)
    if node_type:
        queryset = queryset.filter(node_type=node_type)
    if active is not None:
        queryset = queryset.filter(active=active)
    if query:
        queryset = queryset.filter(
            Q(path_code__icontains=query)
            | Q(code_segment__icontains=query)
            | Q(name__icontains=query)
            | Q(site__code__icontains=query)
            | Q(site__name__icontains=query)
        )
    return queryset.order_by("path_code", "name")


def build_tree(*, site_id=None, active: bool | None = True) -> list[dict]:
    if active is False:
        # Un ambiente archivado debe seguir visible bajo su sede activa cuando
        # se consulta el árbol histórico.
        sites_queryset = FacilitySite.objects.filter(
            Q(active=False) | Q(space_nodes__active=False)
        ).distinct()
    else:
        sites_queryset = list_sites(active=active)
    sites = list(sites_queryset.filter(pk=site_id) if site_id else sites_queryset)
    all_nodes = list(
        SpaceNode.objects.select_related("site", "parent")
        .filter(site__in=sites)
        .order_by("path_code", "name")
    )
    if active is False:
        # La vista de archivados conserva los ancestros como contexto para que
        # un ambiente pueda ubicarse y restaurarse desde su ruta completa.
        by_id = {node.id: node for node in all_nodes}
        included_ids = {node.id for node in all_nodes if not node.active}
        for node_id in tuple(included_ids):
            current = by_id[node_id]
            while current.parent_id:
                included_ids.add(current.parent_id)
                current = by_id[current.parent_id]
        nodes = [node for node in all_nodes if node.id in included_ids]
    elif active is None:
        nodes = all_nodes
    else:
        nodes = [node for node in all_nodes if node.active]
    children_by_parent: dict[object, list[SpaceNode]] = defaultdict(list)
    for node in nodes:
        children_by_parent[node.parent_id].append(node)

    def serialize_node(node: SpaceNode) -> dict:
        return {
            "id": str(node.id),
            "site_id": str(node.site_id),
            "parent_id": str(node.parent_id) if node.parent_id else None,
            "node_type": node.node_type,
            "node_type_label": node.get_node_type_display(),
            "kind": node.node_type,
            "code_segment": node.code_segment,
            "code": node.code_segment,
            "path_code": node.path_code,
            "name": node.name,
            "square_meters": str(node.square_meters) if node.square_meters is not None else None,
            "headcount": node.headcount,
            "common_space": node.common_space,
            "active": node.active,
            "children": [serialize_node(child) for child in children_by_parent.get(node.id, [])],
        }

    result = []
    for site in sites:
        root_children = [
            serialize_node(node)
            for node in children_by_parent.get(None, [])
            if node.site_id == site.id
        ]
        result.append(
            {
            "id": str(site.id),
            "site_id": str(site.id),
            "parent_id": None,
            "kind": "SITE",
            "node_type": "SITE",
            "code": site.code,
            "path_code": site.code,
            "name": site.name,
            "active": site.active,
            # children es la representación canónica de raíz virtual. nodes
            # queda como alias temporal de lectura para consumidores previos.
            "children": root_children,
            "nodes": root_children,
            }
        )
    return result


def available_node_types(*, parent: SpaceNode | None) -> list[dict]:
    from .services import ALLOWED_CHILD_TYPES, ROOT_TYPES

    candidates = ROOT_TYPES if parent is None else ALLOWED_CHILD_TYPES.get(parent.node_type, set())
    labels = dict(SpaceNode.Type.choices)
    return [
        {"value": value, "label": labels[value]}
        for value in SpaceNode.Type.values
        if value in candidates
    ]
