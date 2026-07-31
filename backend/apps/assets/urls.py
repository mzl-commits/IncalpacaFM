from django.urls import path

from .facility_plan_views import (
    FacilityPlanDetailView,
    FacilityPlanImageView,
    FacilityPlanListView,
    FacilityPlanReconcileView,
)
from .location_map_views import (
    LocationMapDeactivateView,
    LocationListView,
    LocationMapImageView,
    LocationMapListCreateView,
)
from .views import (
    AssetClassificationView,
    AssetDetailView,
    AssetListCreateView,
    PublicAssetView,
)

urlpatterns = [
    path('locations/', LocationListView.as_view(), name='location-list'),
    path(
        'location-maps/',
        LocationMapListCreateView.as_view(),
        name='location-map-list-create',
    ),
    path(
        'location-maps/<uuid:pk>/',
        LocationMapDeactivateView.as_view(),
        name='location-map-deactivate',
    ),
    path(
        'location-maps/<uuid:pk>/image/',
        LocationMapImageView.as_view(),
        name='location-map-image',
    ),
    path(
        'facility-plans/',
        FacilityPlanListView.as_view(),
        name='facility-plan-list',
    ),
    path(
        'facility-plans/<uuid:pk>/',
        FacilityPlanDetailView.as_view(),
        name='facility-plan-detail',
    ),
    path(
        'facility-plans/<uuid:pk>/reconcile/',
        FacilityPlanReconcileView.as_view(),
        name='facility-plan-reconcile',
    ),
    path(
        'facility-plans/<uuid:pk>/image/',
        FacilityPlanImageView.as_view(),
        name='facility-plan-image',
    ),
    path('assets/', AssetListCreateView.as_view(), name='asset-list-create'),
    path('assets/<uuid:pk>/', AssetDetailView.as_view(), name='asset-detail'),
    path(
        'assets/<uuid:pk>/classify/',
        AssetClassificationView.as_view(),
        name='asset-classify',
    ),
    path('public/assets/<str:token>/', PublicAssetView.as_view(), name='public-asset'),
]
