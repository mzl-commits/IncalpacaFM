from rest_framework import generics

from apps.accounts.permissions import IsAdministrator, IsTechnicianOrAdministrator

from .models import RetirementRequest, TechnicalDiagnosis
from .serializers import RetirementRequestSerializer, TechnicalDiagnosisSerializer


class DiagnosisListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsTechnicianOrAdministrator]
    serializer_class = TechnicalDiagnosisSerializer
    queryset = TechnicalDiagnosis.objects.select_related("asset")


class DiagnosisDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsTechnicianOrAdministrator]
    serializer_class = TechnicalDiagnosisSerializer
    queryset = TechnicalDiagnosis.objects.select_related("asset")


class RetirementListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAdministrator]
    serializer_class = RetirementRequestSerializer
    queryset = RetirementRequest.objects.select_related("asset", "diagnosis")


class RetirementDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAdministrator]
    serializer_class = RetirementRequestSerializer
    queryset = RetirementRequest.objects.select_related("asset", "diagnosis")
