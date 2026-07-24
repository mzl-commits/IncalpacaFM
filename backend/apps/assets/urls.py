from django.urls import path

from .views import AssetListCreateView, PublicAssetView

urlpatterns = [
    path('assets/', AssetListCreateView.as_view(), name='asset-list-create'),
    path('public/assets/<str:token>/', PublicAssetView.as_view(), name='public-asset'),
]
