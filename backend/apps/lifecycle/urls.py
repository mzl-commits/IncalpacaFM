from django.urls import path

from .views import (
    DiagnosisDetailView,
    DiagnosisListCreateView,
    RetirementDetailView,
    RetirementListCreateView,
)

urlpatterns = [
    path("lifecycle/diagnoses/", DiagnosisListCreateView.as_view()),
    path("lifecycle/diagnoses/<uuid:pk>/", DiagnosisDetailView.as_view()),
    path("lifecycle/retirement-requests/", RetirementListCreateView.as_view()),
    path("lifecycle/retirement-requests/<uuid:pk>/", RetirementDetailView.as_view()),
]
