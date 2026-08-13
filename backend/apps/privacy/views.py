from rest_framework import generics, permissions
from rest_framework.throttling import ScopedRateThrottle

from apps.accounts.permissions import IsAdministrator
from apps.audit.services import record_audit

from .models import (
    DataSubjectRequest,
    PersonalDataIncident,
    PrivacyNotice,
    ProcessingInventory,
)
from .serializers import (
    DataSubjectRequestAdminSerializer,
    DataSubjectRequestSerializer,
    PersonalDataIncidentSerializer,
    PrivacyAcknowledgementSerializer,
    PrivacyNoticeSerializer,
    ProcessingInventorySerializer,
)


class ActivePrivacyNoticeView(generics.ListAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = PrivacyNoticeSerializer

    def get_queryset(self):
        context = self.request.query_params.get("context")
        queryset = PrivacyNotice.objects.filter(active=True)
        return queryset.filter(contexts__contains=[context]) if context else queryset


class PrivacyAcknowledgementCreateView(generics.CreateAPIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_privacy"
    serializer_class = PrivacyAcknowledgementSerializer

    def perform_create(self, serializer):
        acknowledgement = serializer.save()
        record_audit(request=self.request, action="PRIVACY_NOTICE_ACKNOWLEDGED", entity="PrivacyAcknowledgement", entity_id=acknowledgement.id, after={"notice": acknowledgement.notice.version, "context": acknowledgement.context})


class ArcoRequestCreateView(generics.CreateAPIView):
    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "public_privacy"
    serializer_class = DataSubjectRequestSerializer

    def perform_create(self, serializer):
        request_item = serializer.save()
        record_audit(request=self.request, action="ARCO_REQUEST_CREATED", entity="DataSubjectRequest", entity_id=request_item.id, after={"code": request_item.code, "type": request_item.request_type})


class AdminPrivacyNoticeListView(generics.ListCreateAPIView):
    permission_classes = [IsAdministrator]
    serializer_class = PrivacyNoticeSerializer
    queryset = PrivacyNotice.objects.all()


class AdminPrivacyNoticeDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAdministrator]
    serializer_class = PrivacyNoticeSerializer
    queryset = PrivacyNotice.objects.all()


class AdminArcoRequestListView(generics.ListAPIView):
    permission_classes = [IsAdministrator]
    serializer_class = DataSubjectRequestAdminSerializer
    queryset = DataSubjectRequest.objects.select_related("handled_by")


class AdminArcoRequestDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAdministrator]
    serializer_class = DataSubjectRequestAdminSerializer
    queryset = DataSubjectRequest.objects.select_related("handled_by")


class ProcessingInventoryListView(generics.ListCreateAPIView):
    permission_classes = [IsAdministrator]
    serializer_class = ProcessingInventorySerializer
    queryset = ProcessingInventory.objects.all()


class ProcessingInventoryDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAdministrator]
    serializer_class = ProcessingInventorySerializer
    queryset = ProcessingInventory.objects.all()


class PersonalDataIncidentListView(generics.ListCreateAPIView):
    permission_classes = [IsAdministrator]
    serializer_class = PersonalDataIncidentSerializer
    queryset = PersonalDataIncident.objects.all()


class PersonalDataIncidentDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAdministrator]
    serializer_class = PersonalDataIncidentSerializer
    queryset = PersonalDataIncident.objects.all()
