from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import AccountProfile
from apps.audit.services import record_audit

from .models import Incident


class IncidentSerializer(serializers.ModelSerializer):
    requesterId = serializers.CharField(source="requester.account_profile.id", read_only=True)
    requesterName = serializers.SerializerMethodField()
    requesterEmail = serializers.SerializerMethodField()
    requesterPhone = serializers.SerializerMethodField()
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
    requesterContact = serializers.JSONField(source="requester_contact", required=False)
    impactAssessment = serializers.JSONField(source="impact_assessment", required=False)

    class Meta:
        model = Incident
        fields = (
            "id",
            "code",
            "assetId",
            "requesterId",
            "requesterName",
            "requesterEmail",
            "requesterPhone",
            "requesterContact",
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
            "impactAssessment",
            "status",
            "rejectionReason",
            "workOrderId",
            "reportedAt",
            "updatedAt",
        )
        read_only_fields = ("id", "code", "requesterId", "requesterName", "requesterEmail")

    def get_requesterName(self, obj):
        return obj.requester_contact.get("name") or obj.requester.get_full_name() or obj.requester.username

    def get_requesterEmail(self, obj):
        return obj.requester_contact.get("email") or obj.requester.email

    def get_requesterPhone(self, obj):
        return obj.requester_contact.get("phone", "")

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


class PublicIncidentSerializer(serializers.Serializer):
    requesterName = serializers.CharField(max_length=160)
    requesterEmail = serializers.EmailField()
    requesterPhone = serializers.CharField(max_length=40, required=False, allow_blank=True)
    zone = serializers.CharField(max_length=120)
    building = serializers.CharField(max_length=160)
    area = serializers.CharField(max_length=160)
    room = serializers.CharField(max_length=160)
    description = serializers.CharField(min_length=10, max_length=1000)
    evidence = serializers.ListField(required=False, default=list)
    noPhotoReason = serializers.CharField(required=False, allow_blank=True, max_length=300)
    suggestedPriority = serializers.ChoiceField(choices=("NORMAL", "URGENTE", "EMERGENCIA"))
    priorityReasons = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    impactAnswers = serializers.DictField(required=True)

    def _public_requester(self):
        user_model = get_user_model()
        user, created = user_model.objects.get_or_create(
            username="solicitante.publico",
            defaults={
                "first_name": "Solicitante",
                "last_name": "Publico",
                "email": "solicitante.publico@incalpaca.test",
                "is_active": True,
            },
        )
        if created:
            user.set_unusable_password()
            user.save(update_fields=("password",))
        AccountProfile.objects.get_or_create(
            user=user,
            defaults={
                "worker_code": "solicitante-publico",
                "role": AccountProfile.Role.REQUESTER,
                "must_change_password": False,
                "active": True,
            },
        )
        return user

    @transaction.atomic
    def create(self, validated_data):
        requester = self._public_requester()
        sequence = Incident.objects.select_for_update().count() + 1
        location = {
            "locationId": "-".join(
                [
                    validated_data["zone"],
                    validated_data["building"],
                    validated_data["area"],
                    validated_data["room"],
                ]
            ),
            "zone": validated_data["zone"],
            "building": validated_data["building"],
            "area": validated_data["area"],
            "room": validated_data["room"],
        }
        incident = Incident.objects.create(
            code=f"SOL-{timezone.localdate().year}-{sequence:04d}",
            requester=requester,
            requester_contact={
                "name": validated_data["requesterName"],
                "email": validated_data["requesterEmail"],
                "phone": validated_data.get("requesterPhone", ""),
            },
            location_snapshot=location,
            request_type="OTRO",
            description=validated_data["description"],
            requester_priority=validated_data["suggestedPriority"],
            project=False,
            evidence=validated_data.get("evidence", []),
            impact_assessment={
                "suggestedPriority": validated_data["suggestedPriority"],
                "priorityReasons": validated_data.get("priorityReasons", []),
                "answers": validated_data["impactAnswers"],
                "noPhotoReason": validated_data.get("noPhotoReason", ""),
            },
            status="RECIBIDA",
        )
        return incident
