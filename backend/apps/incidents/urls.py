from django.urls import path

from .views import IncidentDetailView, IncidentListCreateView

urlpatterns = [
    path("incidents/", IncidentListCreateView.as_view(), name="incident-list-create"),
    path("incidents/<uuid:pk>/", IncidentDetailView.as_view(), name="incident-detail"),
]
