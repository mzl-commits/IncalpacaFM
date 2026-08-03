from uuid import UUID

from django.shortcuts import get_object_or_404
from rest_framework import generics, response, status
from rest_framework.permissions import AllowAny

from apps.accounts.models import AccountProfile
from apps.accounts.permissions import IsAuthenticatedReadAdministratorWrite, user_role

from .models import Incident
from .serializers import IncidentSerializer, PublicIncidentSerializer, PublicIncidentTrackingSerializer
from .services import build_tracking_url, send_public_request_confirmation


class IncidentListCreateView(generics.ListCreateAPIView):
    serializer_class = IncidentSerializer

    def get_queryset(self):
        queryset = Incident.objects.select_related("requester", "asset")
        if user_role(self.request.user) == AccountProfile.Role.REQUESTER:
            queryset = queryset.filter(requester=self.request.user)
        return queryset


class IncidentDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticatedReadAdministratorWrite]
    serializer_class = IncidentSerializer
    queryset = Incident.objects.select_related("requester", "asset")


class PublicIncidentCreateView(generics.CreateAPIView):
    permission_classes = [AllowAny]
    serializer_class = PublicIncidentSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        incident = serializer.save()
        email_sent = False
        try:
            email_sent = send_public_request_confirmation(incident)
        except Exception:
            email_sent = False
        data = IncidentSerializer(incident).data
        data["trackingUrl"] = build_tracking_url(incident)
        data["emailSent"] = email_sent
        return response.Response(data, status=status.HTTP_201_CREATED)


class PublicIncidentTrackingView(generics.RetrieveAPIView):
    permission_classes = [AllowAny]
    serializer_class = PublicIncidentTrackingSerializer
    lookup_url_kwarg = "token"

    def get_object(self):
        token = self.kwargs[self.lookup_url_kwarg]
        queryset = Incident.objects.select_related(
            "requester",
            "asset",
            "work_order",
            "work_order__technician",
        )
        try:
            UUID(token)
            return queryset.get(pk=token)
        except (ValueError, Incident.DoesNotExist):
            return queryset.get(code__iexact=token)