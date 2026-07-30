from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

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
    requestType = serializers.CharField(source="request_type")
    requesterPriority = serializers.CharField(source="requester_priority")
    rejectionReason = serializers.CharField(
        source="rejection_reason", required=False, allow_blank=True
    )
    workOrderId = serializers.SerializerMethodField()
    reportedAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    assetId = serializers.UUIDField(source="asset_id", required=False, allow_null=True)

    class Meta:
        model = Incident
        fields = (
            "id",
            "code",
            "assetId",
            "requesterId",
            "requesterName",
            "requesterEmail",
            "locationId",
            "zone",
            "building",
            "area",
            "room",
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

    def get_requesterName(self, obj):
        return obj.requester.get_full_name() or obj.requester.username

    def _location(self, obj, key):
        return obj.location_snapshot.get(key, "")

    def get_locationId(self, obj):
        return self._location(obj, "locationId")

    def get_zone(self, obj):
        return self._location(obj, "zone")

    def get_building(self, obj):
        return self._location(obj, "building")

    def get_area(self, obj):
        return self._location(obj, "area")

    def get_room(self, obj):
        return self._location(obj, "room")

    def get_workOrderId(self, obj):
        return str(obj.work_order.id) if hasattr(obj, "work_order") else None

    @transaction.atomic
    def create(self, validated_data):
        request = self.context["request"]
        location = {
            key: request.data.get(key, "")
            for key in ("locationId", "zone", "building", "area", "room")
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
