from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.assets.models import Location, LocationMap
from apps.audit.services import record_audit

from .models import Incident


class IncidentSerializer(serializers.ModelSerializer):
    requesterId = serializers.CharField(source="requester.account_profile.id", read_only=True)
    requesterName = serializers.SerializerMethodField()
    requesterEmail = serializers.EmailField(source="requester.email", read_only=True)
    locationId = serializers.SerializerMethodField()
    zone = serializers.SerializerMethodField()
    building = serializers.SerializerMethodField()
    area = serializers.SerializerMethodField()
    room = serializers.SerializerMethodField()
    locationMapId = serializers.SerializerMethodField()
    locationMarkerX = serializers.SerializerMethodField()
    locationMarkerY = serializers.SerializerMethodField()
    requestType = serializers.CharField(source="request_type")
    requesterPriority = serializers.CharField(source="requester_priority")
    rejectionReason = serializers.CharField(
        source="rejection_reason", required=False, allow_blank=True
    )
    workOrderId = serializers.SerializerMethodField()
    reportedAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    assetId = serializers.UUIDField(source="asset_id", required=False, allow_null=True)
    assetCode = serializers.SerializerMethodField()
    assetDisplayCode = serializers.SerializerMethodField()
    status = serializers.CharField(required=False)

    class Meta:
        model = Incident
        fields = (
            "id",
            "code",
            "assetId",
            "assetCode",
            "assetDisplayCode",
            "requesterId",
            "requesterName",
            "requesterEmail",
            "locationId",
            "zone",
            "building",
            "area",
            "room",
            "locationMapId",
            "locationMarkerX",
            "locationMarkerY",
            "requestType",
            "description",
            "requesterPriority",
            "project",
            "evidence",
            "status",
            "rejectionReason",
            "workOrderId",
            "reportedAt",
            "updatedAt",
        )
        read_only_fields = ("id", "code", "requesterId", "requesterName", "requesterEmail")

    def get_requesterName(self, obj) -> str:
        return obj.requester.get_full_name() or obj.requester.username

    def get_assetCode(self, obj) -> str | None:
        return obj.asset.code if obj.asset else None

    def get_assetDisplayCode(self, obj) -> str | None:
        return (obj.asset.fm_code or obj.asset.code) if obj.asset else None

    def _location(self, obj, key):
        return obj.location_snapshot.get(key, "")

    def get_locationId(self, obj) -> str:
        return self._location(obj, "locationId")

    def get_zone(self, obj) -> str:
        return self._location(obj, "zone")

    def get_building(self, obj) -> str:
        return self._location(obj, "building")

    def get_area(self, obj) -> str:
        return self._location(obj, "area")

    def get_room(self, obj) -> str:
        return self._location(obj, "room")

    def get_locationMapId(self, obj) -> str | None:
        return self._location(obj, "locationMapId") or None

    def get_locationMarkerX(self, obj) -> float | None:
        value = self._location(obj, "locationMarkerX")
        return float(value) if value is not None else None

    def get_locationMarkerY(self, obj) -> float | None:
        value = self._location(obj, "locationMarkerY")
        return float(value) if value is not None else None

    def get_workOrderId(self, obj) -> str | None:
        return str(obj.work_order.id) if hasattr(obj, "work_order") else None

    def validate_status(self, value):
        aliases = {
            "PENDIENTE": Incident.Status.RECEIVED,
            "EN_EVALUACION": Incident.Status.REVIEW,
            "CONVERTIDA_EN_OT": Incident.Status.IN_PROGRESS,
        }
        normalized = aliases.get(value, value)
        if normalized not in Incident.Status.values:
            raise serializers.ValidationError("Estado de solicitud no válido.")
        return normalized

    def validate(self, attrs):
        if self.instance is not None:
            return attrs
        request = self.context["request"]
        location_id = request.data.get("locationId")
        try:
            location = Location.objects.get(pk=location_id, active=True)
        except (Location.DoesNotExist, TypeError, ValueError):
            raise serializers.ValidationError({"locationId": "Selecciona una ubicación oficial activa."})

        map_id = request.data.get("locationMapId") or None
        location_map = None
        if map_id:
            try:
                location_map = LocationMap.objects.get(pk=map_id, location=location, active=True)
            except (LocationMap.DoesNotExist, TypeError, ValueError):
                raise serializers.ValidationError({"locationMapId": "La imagen referencial no corresponde al ambiente seleccionado."})

        marker_x = request.data.get("locationMarkerX")
        marker_y = request.data.get("locationMarkerY")
        if (marker_x is None) != (marker_y is None):
            raise serializers.ValidationError({"locationMarkerX": "Las dos coordenadas del marcador deben enviarse juntas."})
        if marker_x is not None:
            try:
                marker_x, marker_y = float(marker_x), float(marker_y)
            except (TypeError, ValueError):
                raise serializers.ValidationError({"locationMarkerX": "Las coordenadas del marcador no son válidas."})
            if not location_map or not (0 <= marker_x <= 1 and 0 <= marker_y <= 1):
                raise serializers.ValidationError({"locationMarkerX": "El marcador debe pertenecer a la imagen seleccionada."})

        self._resolved_location = location
        self._resolved_location_map = location_map
        self._resolved_marker = (marker_x, marker_y)
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        aliases = {
            Incident.Status.RECEIVED: "PENDIENTE",
            Incident.Status.REVIEW: "EN_EVALUACION",
            Incident.Status.ATTENDED: "APROBADA",
            Incident.Status.REJECTED: "RECHAZADA",
            Incident.Status.IN_PROGRESS: "CONVERTIDA_EN_OT",
            Incident.Status.CLOSED: "CONVERTIDA_EN_OT",
        }
        data["status"] = aliases.get(instance.status, instance.status)
        return data

    @transaction.atomic
    def create(self, validated_data):
        request = self.context["request"]
        selected_location = self._resolved_location
        location_map = self._resolved_location_map
        marker_x, marker_y = self._resolved_marker
        location = {
            "locationId": str(selected_location.id),
            "zone": selected_location.zone,
            "building": selected_location.building,
            "area": selected_location.area,
            "room": selected_location.room,
            "locationMapId": str(location_map.id) if location_map else None,
            "locationMarkerX": marker_x,
            "locationMarkerY": marker_y,
        }
        sequence = Incident.objects.select_for_update().count() + 1
        incident = Incident.objects.create(
            code=f"SOL-{timezone.localdate().year}-{sequence:04d}",
            requester=request.user,
            location_snapshot=location,
            **validated_data,
        )
        record_audit(
            request=request,
            action="INCIDENT_CREATED",
            entity="Incident",
            entity_id=incident.id,
            after={"code": incident.code, "status": incident.status},
        )
        return incident

    @transaction.atomic
    def update(self, instance, validated_data):
        request = self.context["request"]
        before = {"status": instance.status, "rejection_reason": instance.rejection_reason}
        instance = super().update(instance, validated_data)
        record_audit(
            request=request,
            action="INCIDENT_UPDATED",
            entity="Incident",
            entity_id=instance.id,
            before=before,
            after={"status": instance.status, "rejection_reason": instance.rejection_reason},
        )
        return instance
