from uuid import UUID

from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import AccountProfile
from apps.accounts.permissions import IsAuthenticatedReadAdministratorWrite, user_role
from apps.assets.models import Asset
from apps.audit.services import record_audit

from .models import Incident
from .serializers import (
    IncidentSerializer,
    PublicAssetIncidentSerializer,
    PublicIncidentTrackingSerializer,
    PublicWorkRequestSerializer,
)
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


class PublicWorkRequestCreateView(generics.CreateAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = PublicWorkRequestSerializer

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
        return Response(data, status=status.HTTP_201_CREATED)


class PublicAssetIncidentCreateView(APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "public_report"

    @extend_schema(responses={200: OpenApiTypes.OBJECT})
    def get(self, request, token):
        asset = get_object_or_404(
            Asset.objects.select_related("location"), public_token=token
        )
        return Response({
            "displayCode": asset.fm_code or asset.code,
            "name": asset.name,
            "photoUrl": request.build_absolute_uri(
                f"/api/v1/public/assets/{asset.public_token}/photo/"
            ) if asset.photo else None,
            "generalLocation": (
                f"{asset.location.building} / {asset.location.area}"
                if asset.location else "Por confirmar"
            ),
        })

    @extend_schema(request=PublicAssetIncidentSerializer, responses={201: OpenApiTypes.OBJECT})
    def post(self, request, token):
        asset = get_object_or_404(Asset, public_token=token)
        serializer = PublicAssetIncidentSerializer(
            data=request.data, context={"asset": asset, "request": request}
        )
        serializer.is_valid(raise_exception=True)
        incident = serializer.save()
        email_sent = False
        try:
            email_sent = send_public_request_confirmation(incident)
        except Exception:
            email_sent = False
        record_audit(
            request=request,
            action="PUBLIC_INCIDENT_CREATED",
            entity="Incident",
            entity_id=incident.id,
            after={
                "code": incident.code,
                "asset_id": str(asset.id),
                "status": incident.status,
            },
        )
        return Response(
            {
                "id": str(incident.id),
                "code": incident.code,
                "status": "RECIBIDA",
                "trackingUrl": build_tracking_url(incident),
                "emailSent": email_sent,
            },
            status=status.HTTP_201_CREATED,
        )


class PublicIncidentTrackingView(generics.RetrieveAPIView):
    permission_classes = [permissions.AllowAny]
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
            return get_object_or_404(queryset, pk=token)
        except ValueError:
            return get_object_or_404(queryset, code__iexact=token)