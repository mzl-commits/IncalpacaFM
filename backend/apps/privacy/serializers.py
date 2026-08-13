from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from .models import (
    DataSubjectRequest,
    PersonalDataIncident,
    PrivacyAcknowledgement,
    PrivacyNotice,
    ProcessingInventory,
)


class PrivacyNoticeSerializer(serializers.ModelSerializer):
    class Meta:
        model = PrivacyNotice
        fields = "__all__"


class PrivacyAcknowledgementSerializer(serializers.ModelSerializer):
    noticeVersion = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = PrivacyAcknowledgement
        fields = ("id", "notice", "noticeVersion", "context", "subject_reference", "accepted", "created_at")
        read_only_fields = ("id", "notice", "created_at")

    def create(self, validated_data):
        version = validated_data.pop("noticeVersion", "")
        context = validated_data["context"]
        notices = PrivacyNotice.objects.filter(active=True).order_by("-effective_from")
        notice = next((n for n in notices if context in (n.contexts or [])), None)
        if version:
            notice = PrivacyNotice.objects.filter(version=version, active=True).first()
        if not notice:
            raise serializers.ValidationError({"noticeVersion": "No existe un aviso de privacidad activo para este contexto."})
        request = self.context["request"]
        forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
        validated_data.update({
            "notice": notice,
            "user": request.user if request.user.is_authenticated else None,
            "ip_address": (forwarded.split(",")[0].strip() if forwarded else request.META.get("REMOTE_ADDR")) or None,
            "user_agent": request.META.get("HTTP_USER_AGENT", "")[:500],
        })
        return super().create(validated_data)


class DataSubjectRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = DataSubjectRequest
        fields = "__all__"
        read_only_fields = ("id", "code", "status", "due_date", "response", "handled_by", "created_at", "resolved_at")

    def create(self, validated_data):
        sequence = DataSubjectRequest.objects.count() + 1
        validated_data["code"] = f"ARCO-{timezone.localdate().year}-{sequence:04d}"
        validated_data["due_date"] = timezone.localdate() + timedelta(days=20)
        return super().create(validated_data)


class DataSubjectRequestAdminSerializer(serializers.ModelSerializer):
    class Meta:
        model = DataSubjectRequest
        fields = "__all__"
        read_only_fields = ("id", "code", "created_at")


class ProcessingInventorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProcessingInventory
        fields = "__all__"
        read_only_fields = ("id", "updated_at")


class PersonalDataIncidentSerializer(serializers.ModelSerializer):
    class Meta:
        model = PersonalDataIncident
        fields = "__all__"
        read_only_fields = ("id", "code", "created_at", "created_by")

    def create(self, validated_data):
        sequence = PersonalDataIncident.objects.count() + 1
        validated_data["code"] = f"DP-INC-{timezone.localdate().year}-{sequence:04d}"
        validated_data["created_by"] = self.context["request"].user
        return super().create(validated_data)
