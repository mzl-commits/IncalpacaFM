from uuid import UUID

from django.db import transaction
from django.utils import timezone

from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import AccountProfile
from apps.accounts.permissions import IsAuthenticatedReadAdministratorWrite, user_role
from apps.assets.models import Asset, Location
from apps.audit.services import record_audit
from apps.notifications.services import queue_for_administrators, queue_incident_requester
from apps.workorders.models import TechnicianSatisfaction, WorkOrder

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



class PublicLocationListView(APIView):
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        locations = Location.objects.filter(active=True).order_by("zone", "building", "area", "room")
        return Response([
            {
                "id": str(location.id),
                "code": location.location_code,
                "zone": location.zone,
                "building": location.building,
                "area": location.area,
                "room": location.room,
                "specificLocation": location.specific_location,
                "displayName": str(location),
            }
            for location in locations
        ])

class PublicWorkRequestCreateView(generics.CreateAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = PublicWorkRequestSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        incident = serializer.save()
        queue_for_administrators(
            event="INCIDENT_CREATED",
            subject=f"Nueva solicitud {incident.code}",
            body="Se recibió una solicitud pública y está lista para ser evaluada.",
            entity=incident,
            discriminator=incident.status,
        )
        queue_incident_requester(
            event="INCIDENT_RECEIVED",
            incident=incident,
            subject=f"Recibimos tu solicitud {incident.code}",
            body="Recibimos tu solicitud. Te notificaremos cuando programemos su revisión.",
            discriminator=incident.status,
        )
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
        queue_for_administrators(
            event="INCIDENT_CREATED",
            subject=f"Nueva incidencia {incident.code}",
            body=f"Se recibió una incidencia para el bien {asset.fm_code or asset.code}.",
            entity=incident,
            discriminator=incident.status,
        )
        queue_incident_requester(
            event="INCIDENT_RECEIVED",
            incident=incident,
            subject=f"Recibimos tu reporte {incident.code}",
            body="Recibimos tu reporte. Te notificaremos cuando programemos su revisión.",
            discriminator=incident.status,
        )
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
class PublicIncidentConformityView(APIView):
    permission_classes = [permissions.AllowAny]

    @transaction.atomic
    def post(self, request, token):
        queryset = Incident.objects.select_related("work_order")
        try:
            UUID(token)
            incident = get_object_or_404(queryset, pk=token)
        except ValueError:
            incident = get_object_or_404(queryset, code__iexact=token)

        order = getattr(incident, "work_order", None)
        if not order or order.status != WorkOrder.Status.CONFORMITY:
            return Response(
                {"detail": "La solicitud aún no está lista para conformidad."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        raw_rating = request.data.get("rating")
        try:
            rating = int(raw_rating)
        except (TypeError, ValueError):
            return Response(
                {"rating": "Selecciona una calificación del 1 al 5."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if rating < 1 or rating > 5:
            return Response(
                {"rating": "Selecciona una calificación del 1 al 5."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        comment = str(request.data.get("comment") or "").strip()
        now = timezone.now()
        order.conformity = {
            "accepted": True,
            "rating": rating,
            "comment": comment,
            "at": now.isoformat(),
            "by": "Solicitante",
            "source": "public_tracking",
        }
        order.status = WorkOrder.Status.CLOSED
        order.closed_at = now
        incident.status = Incident.Status.CLOSED
        incident.save(update_fields=("status", "updated_at"))
        order.save(update_fields=("conformity", "status", "closed_at", "updated_at"))
        TechnicianSatisfaction.objects.update_or_create(
            work_order=order,
            defaults={
                "technician": order.technician,
                "accepted": True,
                "rating": rating,
                "comment": comment,
            },
        )
        queue_for_administrators(
            event='SERVICE_SATISFACTION_RECEIVED',
            subject=f'Satisfacción registrada · {incident.code}',
            body=(
                f'El solicitante calificó la atención {incident.code} '
                f'con {rating}/5.'
            ),
            entity=incident,
            discriminator='rating',
        )
        queue_incident_requester(
            event='SERVICE_SATISFACTION_THANK_YOU',
            incident=incident,
            subject=f'Gracias por tu evaluación · {incident.code}',
            body='Tu calificación fue registrada. Gracias por ayudarnos a mejorar el servicio.',
            discriminator='rating-thank-you',
        )

        return Response(PublicIncidentTrackingSerializer(incident).data)
