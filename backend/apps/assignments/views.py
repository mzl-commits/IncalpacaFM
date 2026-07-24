
from rest_framework import generics, permissions, response, status, views

from apps.assets.models import Asset, AssetAssignment, AssignableResponsible, Location
from .serializers import AssignmentOperationSerializer, AssignmentSerializer, DeliveryCreateSerializer


class AssignmentListView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = AssignmentSerializer
    queryset = AssetAssignment.objects.select_related(
        'asset', 'responsible', 'location', 'delivery_act').order_by('-start_date')


class AssignmentDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = AssignmentSerializer
    queryset = AssetAssignment.objects.select_related(
        'asset', 'responsible', 'location', 'delivery_act').prefetch_related(
        'delivery_act__evidence', 'delivery_act__signatures')


class AssignmentCatalogView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        responsibles = AssignableResponsible.objects.filter(active=True).values(
            'id', 'external_reference', 'type', 'display_name', 'area_name')
        locations = Location.objects.filter(active=True).values(
            'id', 'zone', 'building', 'area', 'room', 'specific_location')
        assets = Asset.objects.exclude(administrative_status='Baja').values(
            'id', 'code', 'name', 'brand', 'model', 'condition', 'assignment_status')
        return response.Response({
            'responsibles': list(responsibles), 'locations': list(locations), 'assets': list(assets)})


class DeliveryCreateView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = DeliveryCreateSerializer(
            data=request.data, context={'request_id': request.headers.get('Idempotency-Key', '')})
        serializer.is_valid(raise_exception=True)
        assignment = serializer.save()
        return response.Response(
            AssignmentSerializer(assignment, context={'request': request}).data,
            status=status.HTTP_201_CREATED)


class AssignmentOperationView(views.APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request, pk):
        serializer = AssignmentOperationSerializer(data=request.data, context={'assignment_id': pk})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return response.Response({'detail': 'Operación registrada correctamente.'})
