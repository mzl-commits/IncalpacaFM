
# Create your views here.
from rest_framework import generics, permissions

from apps.accounts.permissions import IsAuthenticatedReadAdministratorWrite

from .models import Asset
from .serializers import AssetDetailSerializer, AssetSerializer, PublicAssetSerializer


class AssetListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticatedReadAdministratorWrite]
    serializer_class = AssetSerializer
    queryset = Asset.objects.select_related('registered_by', 'taxonomy', 'location').order_by('-created_at')


class PublicAssetView(generics.RetrieveAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = PublicAssetSerializer
    lookup_field = 'public_token'
    lookup_url_kwarg = 'token'
    queryset = Asset.objects.select_related('taxonomy', 'location')


class AssetDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticatedReadAdministratorWrite]
    serializer_class = AssetDetailSerializer
    queryset = Asset.objects.select_related(
        'registered_by', 'taxonomy', 'location',
    ).prefetch_related('assignments__responsible', 'repair_records')
