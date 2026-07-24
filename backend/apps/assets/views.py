
# Create your views here.
from rest_framework import generics, permissions

from .models import Asset
from .serializers import AssetSerializer, PublicAssetSerializer


class AssetListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = AssetSerializer
    queryset = Asset.objects.select_related('registered_by', 'taxonomy', 'location').order_by('-created_at')


class PublicAssetView(generics.RetrieveAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = PublicAssetSerializer
    lookup_field = 'public_token'
    lookup_url_kwarg = 'token'
    queryset = Asset.objects.select_related('taxonomy', 'location')
