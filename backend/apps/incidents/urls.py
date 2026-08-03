from django.urls import path

from .views import (
    IncidentDetailView,
    IncidentListCreateView,
    PublicAssetIncidentCreateView,
    PublicIncidentTrackingView,
    PublicWorkRequestCreateView,
)

urlpatterns = [
    path("incidents/", IncidentListCreateView.as_view(), name="incident-list-create"),
    path("incidents/public/", PublicWorkRequestCreateView.as_view(), name="incident-public-create"),
    path("incidents/public/tracking/<str:token>/", PublicIncidentTrackingView.as_view(), name="incident-public-tracking"),
    path("incidents/<uuid:pk>/", IncidentDetailView.as_view(), name="incident-detail"),
    path(
        "public/assets/<str:token>/report/",
        PublicAssetIncidentCreateView.as_view(),
        name="public-incident-create",
    ),
]