
from django.db import transaction
from django.db.models import Count, Q
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics, response, serializers, status, views

from apps.accounts.permissions import (
    IsAdministrator,
    IsAuthenticatedReadAdministratorWrite,
)
from apps.assets.models import Asset, AssetAssignment, AssignableResponsible, Location

from .serializers import (
    AssignmentOperationSerializer,
    AssignmentSerializer,
    CatalogSerializer,
    DeliveryCreateSerializer,
)


class AssignmentListView(generics.ListAPIView):
    permission_classes = [IsAuthenticatedReadAdministratorWrite]
    serializer_class = AssignmentSerializer
    queryset = AssetAssignment.objects.select_related(
        'asset', 'asset__location_map', 'responsible', 'location', 'delivery_act').order_by('-start_date')


class AssignmentDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticatedReadAdministratorWrite]
    serializer_class = AssignmentSerializer
    queryset = AssetAssignment.objects.select_related(
        'asset', 'asset__location_map', 'responsible', 'location', 'delivery_act').prefetch_related(
        'delivery_act__evidence', 'delivery_act__signatures',
        'asset__assignments__responsible', 'asset__assignments__location',
        'asset__repair_records')

    def patch(self, request, *args, **kwargs):
        assignment = self.get_object()
        allowed_statuses = {'ACTIVA', 'FINALIZADA', 'ANULADA'}
        assignment_status = request.data.get('status')
        asset_status = request.data.get('asset_status')
        with transaction.atomic():
            if 'change_reason' in request.data:
                assignment.change_reason = str(request.data.get('change_reason') or '').strip()
            if assignment_status:
                if assignment_status not in allowed_statuses:
                    return response.Response({'status': 'Estado de asignación no válido.'}, status=status.HTTP_400_BAD_REQUEST)
                assignment.status = assignment_status
            assignment.save(update_fields=('change_reason', 'status'))
            if asset_status is not None:
                assignment.asset.assignment_status = str(asset_status).strip()[:30]
                assignment.asset.save(update_fields=('assignment_status',))
        assignment = self.get_queryset().get(pk=assignment.pk)
        return response.Response(self.get_serializer(assignment).data)


class AssignmentCatalogView(views.APIView):
    permission_classes = [IsAuthenticatedReadAdministratorWrite]

    @extend_schema(responses={200: CatalogSerializer})
    def get(self, request):
        responsibles = AssignableResponsible.objects.filter(active=True).values(
            'id', 'external_reference', 'type', 'display_name', 'area_name')
        locations = Location.objects.filter(active=True).annotate(
            current_users=Count(
                'assetassignment__responsible',
                filter=Q(assetassignment__status='ACTIVA', assetassignment__responsible__type='PERSONA'),
                distinct=True
            )
        ).values(
            'id', 'zone', 'building', 'area', 'room', 'specific_location', 'headcount', 'current_users'
        )
        asset_rows = Asset.objects.exclude(administrative_status='Baja').values(
            'id', 'code', 'fm_code', 'name', 'brand', 'model', 'condition', 'assignment_status')
        assets = []
        for row in asset_rows:
            fm_code = row.pop('fm_code')
            assets.append({**row, 'display_code': fm_code or row['code']})
        return response.Response({
            'responsibles': list(responsibles), 'locations': list(locations), 'assets': assets})


class DeliveryCreateView(views.APIView):
    permission_classes = [IsAdministrator]

    @extend_schema(
        request=DeliveryCreateSerializer,
        responses={201: AssignmentSerializer},
    )
    def post(self, request):
        serializer = DeliveryCreateSerializer(
            data=request.data, context={
                'request': request,
                'request_id': request.headers.get('Idempotency-Key', ''),
            })
        serializer.is_valid(raise_exception=True)
        assignment = serializer.save()
        return response.Response(
            AssignmentSerializer(assignment, context={'request': request}).data,
            status=status.HTTP_201_CREATED)


class AssignmentOperationView(views.APIView):
    permission_classes = [IsAdministrator]

    @extend_schema(
        request=AssignmentOperationSerializer,
        responses={
            200: inline_serializer(
                name="AssignmentOperationResponse",
                fields={"detail": serializers.CharField()},
            )
        },
    )
    def post(self, request, pk):
        serializer = AssignmentOperationSerializer(data=request.data, context={'assignment_id': pk})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return response.Response({'detail': 'Operación registrada correctamente.'})
