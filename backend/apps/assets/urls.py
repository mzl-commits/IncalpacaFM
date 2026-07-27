from django.urls import path

from .views import AssetDetailView, AssetListCreateView, PublicAssetView

urlpatterns = [
    path('assets/', AssetListCreateView.as_view(), name='asset-list-create'),
    path('assets/<uuid:pk>/', AssetDetailView.as_view(), name='asset-detail'),
    path('public/assets/<str:token>/', PublicAssetView.as_view(), name='public-asset'),
]
