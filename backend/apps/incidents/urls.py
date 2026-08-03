from django.urls import path

from .views import IncidentDetailView, IncidentListCreateView, PublicIncidentCreateView

urlpatterns = [
    path("incidents/", IncidentListCreateView.as_view(), name="incident-list-create"),
    path("incidents/<uuid:pk>/", IncidentDetailView.as_view(), name="incident-detail"),
    path(
        "public/assets/<str:token>/report/",
        PublicIncidentCreateView.as_view(),
        name="public-incident-create",
    ),
]
