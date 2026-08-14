from django.db.models import Count
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import (
    OpenApiParameter,
    OpenApiTypes,
    extend_schema,
    extend_schema_view,
    inline_serializer,
)
from rest_framework import generics, serializers
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdministrator
from apps.audit.services import record_audit

from .models import FacilitySite, SpaceNode
from .selectors import active_flag, available_node_types, build_tree, list_nodes, list_sites
from .serializers import FacilitySiteSerializer, SpaceNodeSerializer
from .services import (
    SpatialValidationError,
    archive_site,
    archive_space_node,
    calculate_node_impact,
    node_snapshot,
    restore_site,
    restore_space_node,
    site_snapshot,
)

ACTIVE_PARAMETER = OpenApiParameter(
    name="active",
    type=OpenApiTypes.STR,
    location=OpenApiParameter.QUERY,
    required=False,
    enum=["true", "false", "all"],
    description="Filtra registros activos, archivados o ambos.",
)
SITE_PARAMETER = OpenApiParameter(
    name="site_id",
    type=OpenApiTypes.UUID,
    location=OpenApiParameter.QUERY,
    required=False,
)
PARENT_PARAMETER = OpenApiParameter(
    name="parent_id",
    type=OpenApiTypes.UUID,
    location=OpenApiParameter.QUERY,
    required=False,
)
QUERY_PARAMETER = OpenApiParameter(
    name="q",
    type=OpenApiTypes.STR,
    location=OpenApiParameter.QUERY,
    required=False,
)
NODE_TYPE_PARAMETER = OpenApiParameter(
    name="node_type",
    type=OpenApiTypes.STR,
    location=OpenApiParameter.QUERY,
    required=False,
    enum=[choice[0] for choice in SpaceNode.Type.choices],
)
TREE_RESPONSE = inline_serializer(
    name="SpaceTreeResponse",
    fields={"results": FacilitySiteSerializer(many=True)},
)
OPTIONS_RESPONSE = inline_serializer(
    name="SpaceOptionsResponse",
    fields={
        "sites": FacilitySiteSerializer(many=True),
        "parent": SpaceNodeSerializer(allow_null=True),
        "allowed_node_types": serializers.ListField(child=serializers.DictField()),
        "nodes": SpaceNodeSerializer(many=True),
    },
)
SEARCH_RESPONSE = inline_serializer(
    name="SpaceSearchResponse",
    fields={"results": SpaceNodeSerializer(many=True)},
)
IMPACT_RESPONSE = inline_serializer(
    name="SpaceImpactResponse",
    fields={
        "node_id": serializers.UUIDField(),
        "active_children": serializers.IntegerField(),
        "descendant_count": serializers.IntegerField(),
        "environment_count": serializers.IntegerField(),
        "legacy_location_count": serializers.IntegerField(),
        "asset_count": serializers.IntegerField(),
        "assignment_count": serializers.IntegerField(),
        "user_count": serializers.IntegerField(),
        "active_map_count": serializers.IntegerField(),
        "can_archive": serializers.BooleanField(),
    },
)


class SpatialAdminAPIView(APIView):
    permission_classes = [IsAuthenticated, IsAdministrator]


@extend_schema_view(
    get=extend_schema(summary="Lista sedes configuradas"),
    post=extend_schema(summary="Crea una sede o complejo"),
)
class FacilitySiteListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsAdministrator]
    serializer_class = FacilitySiteSerializer
    pagination_class = None

    def get_queryset(self):
        requested_active = active_flag(self.request.query_params.get("active"), default=True)
        return list_sites(active=requested_active).annotate(space_count=Count("space_nodes"))

    def perform_create(self, serializer):
        site = serializer.save()
        record_audit(
            request=self.request,
            action="FACILITY_SITE_CREATED",
            entity="FacilitySite",
            entity_id=site.id,
            after=site_snapshot(site),
        )


@extend_schema_view(
    get=extend_schema(summary="Consulta una sede"),
    patch=extend_schema(summary="Edita datos administrativos de una sede"),
)
class FacilitySiteDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated, IsAdministrator]
    serializer_class = FacilitySiteSerializer
    queryset = FacilitySite.objects.all()
    http_method_names = ["get", "patch", "put", "options", "head"]

    def perform_update(self, serializer):
        before = site_snapshot(serializer.instance)
        site = serializer.save()
        record_audit(
            request=self.request,
            action="FACILITY_SITE_UPDATED",
            entity="FacilitySite",
            entity_id=site.id,
            before=before,
            after=site_snapshot(site),
        )


class FacilitySiteArchiveView(SpatialAdminAPIView):
    serializer_class = FacilitySiteSerializer

    @extend_schema(summary="Archiva una sede vacía", responses=FacilitySiteSerializer)
    def post(self, request, pk):
        site = get_object_or_404(FacilitySite, pk=pk)
        before = site_snapshot(site)
        try:
            site = archive_site(site)
        except SpatialValidationError as exc:
            raise ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages) from exc
        record_audit(
            request=request,
            action="FACILITY_SITE_ARCHIVED",
            entity="FacilitySite",
            entity_id=site.id,
            before=before,
            after=site_snapshot(site),
        )
        return Response(FacilitySiteSerializer(site).data)


class FacilitySiteRestoreView(SpatialAdminAPIView):
    serializer_class = FacilitySiteSerializer

    @extend_schema(summary="Restaura una sede archivada", responses=FacilitySiteSerializer)
    def post(self, request, pk):
        site = get_object_or_404(FacilitySite, pk=pk)
        before = site_snapshot(site)
        try:
            site = restore_site(site)
        except SpatialValidationError as exc:
            raise ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages) from exc
        record_audit(
            request=request,
            action="FACILITY_SITE_RESTORED",
            entity="FacilitySite",
            entity_id=site.id,
            before=before,
            after=site_snapshot(site),
        )
        return Response(FacilitySiteSerializer(site).data)


@extend_schema_view(
    get=extend_schema(summary="Lista o busca espacios"),
    post=extend_schema(summary="Crea un nodo espacial"),
)
class SpaceNodeListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsAdministrator]
    serializer_class = SpaceNodeSerializer
    pagination_class = None

    def get_queryset(self):
        parent_id = self.request.query_params.get("parent_id")
        return list_nodes(
            site_id=self.request.query_params.get("site_id"),
            parent_id=parent_id,
            node_type=self.request.query_params.get("node_type"),
            active=active_flag(self.request.query_params.get("active"), default=True),
            query=self.request.query_params.get("q"),
        )

    def perform_create(self, serializer):
        node = serializer.save()
        record_audit(
            request=self.request,
            action="SPACE_NODE_CREATED",
            entity="SpaceNode",
            entity_id=node.id,
            after=node_snapshot(node),
        )


@extend_schema_view(
    get=extend_schema(summary="Consulta un espacio"),
    patch=extend_schema(summary="Edita la jerarquía o atributos de un espacio"),
)
class SpaceNodeDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated, IsAdministrator]
    serializer_class = SpaceNodeSerializer
    queryset = SpaceNode.objects.select_related("site", "parent")
    http_method_names = ["get", "patch", "put", "options", "head"]

    def perform_update(self, serializer):
        before = node_snapshot(serializer.instance)
        node = serializer.save()
        record_audit(
            request=self.request,
            action="SPACE_NODE_UPDATED",
            entity="SpaceNode",
            entity_id=node.id,
            before=before,
            after=node_snapshot(node),
        )


class SpaceNodeArchiveView(SpatialAdminAPIView):
    serializer_class = SpaceNodeSerializer

    @extend_schema(summary="Archiva un espacio sin borrarlo", responses=SpaceNodeSerializer)
    def post(self, request, pk):
        node = get_object_or_404(SpaceNode.objects.select_related("site"), pk=pk)
        before = node_snapshot(node)
        try:
            node = archive_space_node(node)
        except SpatialValidationError as exc:
            raise ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages) from exc
        record_audit(
            request=request,
            action="SPACE_NODE_ARCHIVED",
            entity="SpaceNode",
            entity_id=node.id,
            before=before,
            after=node_snapshot(node),
        )
        return Response(SpaceNodeSerializer(node).data)


class SpaceNodeRestoreView(SpatialAdminAPIView):
    serializer_class = SpaceNodeSerializer

    @extend_schema(summary="Restaura un espacio archivado", responses=SpaceNodeSerializer)
    def post(self, request, pk):
        node = get_object_or_404(SpaceNode.objects.select_related("site", "parent"), pk=pk)
        before = node_snapshot(node)
        try:
            node = restore_space_node(node)
        except SpatialValidationError as exc:
            raise ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages) from exc
        record_audit(
            request=request,
            action="SPACE_NODE_RESTORED",
            entity="SpaceNode",
            entity_id=node.id,
            before=before,
            after=node_snapshot(node),
        )
        return Response(SpaceNodeSerializer(node).data)


class SpaceTreeView(SpatialAdminAPIView):
    serializer_class = FacilitySiteSerializer

    @extend_schema(
        summary="Devuelve el árbol de infraestructura por sedes",
        parameters=[SITE_PARAMETER, ACTIVE_PARAMETER],
        responses=TREE_RESPONSE,
    )
    def get(self, request):
        requested_active = active_flag(request.query_params.get("active"), default=True)
        return Response(
            {
                "results": build_tree(
                    site_id=request.query_params.get("site_id"),
                    active=requested_active,
                )
            }
        )


class SpaceSearchView(SpatialAdminAPIView):
    """Búsqueda explícita para selectores remotos y operaciones de conciliación."""

    serializer_class = SpaceNodeSerializer

    @extend_schema(
        summary="Busca espacios por ruta, código, nombre o sede",
        parameters=[QUERY_PARAMETER, SITE_PARAMETER, ACTIVE_PARAMETER, NODE_TYPE_PARAMETER],
        responses=SEARCH_RESPONSE,
    )
    def get(self, request):
        query = (request.query_params.get("q") or "").strip()
        if not query:
            raise ValidationError({"q": "Ingresa un término de búsqueda."})
        nodes = list_nodes(
            site_id=request.query_params.get("site_id"),
            node_type=request.query_params.get("node_type"),
            active=active_flag(request.query_params.get("active"), default=True),
            query=query,
        )[:100]
        return Response({"results": SpaceNodeSerializer(nodes, many=True).data})


class SpaceOptionsView(SpatialAdminAPIView):
    """Opciones para selectores de la UI, sin exponer un contrato plano incierto."""

    serializer_class = SpaceNodeSerializer

    @extend_schema(
        summary="Opciones de padres y tipos de nodos válidos",
        parameters=[SITE_PARAMETER, PARENT_PARAMETER],
        responses=OPTIONS_RESPONSE,
    )
    def get(self, request):
        site_id = request.query_params.get("site_id")
        parent_id = request.query_params.get("parent_id")
        parent = None
        if site_id:
            site = get_object_or_404(FacilitySite, pk=site_id)
            if not site.active:
                raise ValidationError(
                    {"site_id": "Primero restaura la sede antes de administrar sus espacios."}
                )
        if parent_id:
            parent = get_object_or_404(SpaceNode.objects.select_related("site"), pk=parent_id, active=True)
            if site_id and str(parent.site_id) != site_id:
                raise ValidationError({"site_id": "La sede no coincide con el padre seleccionado."})
            if not parent.site.active:
                raise ValidationError(
                    {"parent_id": "Primero restaura la sede antes de administrar sus espacios."}
                )
            site_id = parent.site_id
        sites = list_sites(active=True)
        nodes = list_nodes(site_id=site_id, active=True) if site_id else SpaceNode.objects.none()
        return Response(
            {
                "sites": FacilitySiteSerializer(sites, many=True).data,
                "parent": SpaceNodeSerializer(parent).data if parent else None,
                "allowed_node_types": available_node_types(parent=parent),
                "nodes": SpaceNodeSerializer(nodes, many=True).data,
            }
        )


class SpaceImpactView(SpatialAdminAPIView):
    serializer_class = SpaceNodeSerializer

    @extend_schema(
        summary="Muestra el impacto operativo de un espacio",
        responses=IMPACT_RESPONSE,
    )
    def get(self, request, pk):
        node = get_object_or_404(SpaceNode.objects.select_related("site"), pk=pk)
        return Response(calculate_node_impact(node))
