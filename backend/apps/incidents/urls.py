from django.urls import path

from .views import IncidentDetailView, IncidentListCreateView, PublicIncidentCreateView

urlpatterns = [
    path("incidents/", IncidentListCreateView.as_view(), name="incident-list-create"),
    path("incidents/public/", PublicIncidentCreateView.as_view(), name="incident-public-create"),
    path("incidents/<uuid:pk>/", IncidentDetailView.as_view(), name="incident-detail"),
]
