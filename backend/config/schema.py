"""Reusable OpenAPI serializers for APIViews with dictionary responses."""

from rest_framework import serializers


class DetailResponseSerializer(serializers.Serializer):
    detail = serializers.CharField()


class HealthResponseSerializer(serializers.Serializer):
    status = serializers.CharField()


class HealthReadyResponseSerializer(serializers.Serializer):
    status = serializers.CharField()
    components = serializers.DictField(child=serializers.DictField())


class CeleryHealthResponseSerializer(serializers.Serializer):
    status = serializers.CharField()
    component = serializers.CharField()


class PublicLocationResponseSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    code = serializers.CharField(allow_blank=True)
    zone = serializers.CharField(allow_blank=True)
    building = serializers.CharField(allow_blank=True)
    area = serializers.CharField(allow_blank=True)
    room = serializers.CharField(allow_blank=True)
    specificLocation = serializers.CharField(allow_blank=True)
    displayName = serializers.CharField()


class PublicAssetContextSerializer(serializers.Serializer):
    displayCode = serializers.CharField()
    name = serializers.CharField()
    photoUrl = serializers.URLField(allow_null=True)
    generalLocation = serializers.CharField()
    locationId = serializers.CharField(allow_blank=True)
    zone = serializers.CharField(allow_blank=True)
    building = serializers.CharField(allow_blank=True)
    area = serializers.CharField(allow_blank=True)
    room = serializers.CharField(allow_blank=True)


class IncidentCreatedResponseSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    code = serializers.CharField()
    status = serializers.CharField()
    trackingUrl = serializers.URLField()
    emailSent = serializers.BooleanField()


class WorkOrderReportResponseSerializer(serializers.Serializer):
    id = serializers.UUIDField()
    createdAt = serializers.DateTimeField()
    downloadPath = serializers.CharField()


class ImportResultSerializer(serializers.Serializer):
    created = serializers.IntegerField()
    updated = serializers.IntegerField()
    errors = serializers.ListField(child=serializers.DictField())


class UserDashboardResponseSerializer(serializers.Serializer):
    profile = serializers.DictField()
    assigned_assets = serializers.ListField(child=serializers.DictField())
