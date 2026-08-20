from django.core.exceptions import ObjectDoesNotExist
from django.core.exceptions import ValidationError as DjangoValidationError
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from .models import FacilitySite, SpaceNode
from .services import (
    SpatialValidationError,
    create_space_node,
    update_facility_site,
    update_space_node,
)


class FacilitySiteSerializer(serializers.ModelSerializer):
    # Alias de lectura para consumidores que representan la sede como un nodo
    # virtual del árbol. La escritura sigue usando el contrato explícito Site.
    kind = serializers.SerializerMethodField(read_only=True)
    class Meta:
        model = FacilitySite
        fields = (
            "id",
            "code",
            "name",
            "address_line",
            "district",
            "province",
            "department",
            "country",
            "active",
            "created_at",
            "updated_at",
            "kind",
        )
        read_only_fields = ("id", "active", "created_at", "updated_at")

    def validate_code(self, value):
        normalized = value.strip().upper()
        qs = FacilitySite.objects.filter(code__iexact=normalized)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Ya existe otra sede registrada con este código.")
        return normalized

    def to_internal_value(self, data):
        normalized = data.copy()
        if normalized.get("code") is not None:
            normalized["code"] = str(normalized["code"]).strip().upper()
        return super().to_internal_value(normalized)

    def validate_name(self, value):
        value = " ".join(value.split())
        if not value:
            raise serializers.ValidationError("Ingresa el nombre de la sede.")
        qs = FacilitySite.objects.filter(normalized_name=value.casefold())
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("Ya existe otra sede registrada con este nombre.")
        return value

    @extend_schema_field(OpenApiTypes.STR)
    def get_kind(self, obj) -> str:
        return "SITE"

    def update(self, instance, validated_data):
        try:
            return update_facility_site(instance=instance, data=validated_data)
        except (SpatialValidationError, DjangoValidationError) as exc:
            raise serializers.ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages) from exc


class LegacyLocationSummarySerializer(serializers.Serializer):
    id = serializers.UUIDField(read_only=True)
    location_code = serializers.CharField(read_only=True)
    display_name = serializers.CharField(source="__str__", read_only=True)
    active = serializers.BooleanField(read_only=True)


class SpaceNodeSerializer(serializers.ModelSerializer):
    site_id = serializers.PrimaryKeyRelatedField(source="site", queryset=FacilitySite.objects.all())
    parent_id = serializers.PrimaryKeyRelatedField(
        source="parent",
        queryset=SpaceNode.objects.all(),
        allow_null=True,
        required=False,
        default=None,
    )
    node_type_label = serializers.CharField(source="get_node_type_display", read_only=True)
    kind = serializers.CharField(source="node_type", read_only=True)
    code = serializers.CharField(source="code_segment", read_only=True)
    legacy_location = serializers.SerializerMethodField()
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = SpaceNode
        fields = (
            "id",
            "site_id",
            "parent_id",
            "node_type",
            "node_type_label",
            "kind",
            "code_segment",
            "code",
            "path_code",
            "name",
            "square_meters",
            "headcount",
            "common_space",
            "photo",
            "photo_url",
            "active",
            "legacy_location",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "path_code",
            "legacy_location",
            "active",
            "created_at",
            "updated_at",
        )

    @extend_schema_field(LegacyLocationSummarySerializer(allow_null=True))
    def get_legacy_location(self, obj) -> dict | None:
        try:
            location = obj.legacy_location
        except ObjectDoesNotExist:
            return None
        return LegacyLocationSummarySerializer(location).data

    def get_photo_url(self, obj):
        if obj.photo:
            request = self.context.get("request")
            return request.build_absolute_uri(obj.photo.url) if request else obj.photo.url
        return None

    def validate_code_segment(self, value):
        return value.strip().upper()

    def to_internal_value(self, data):
        normalized = data.copy()
        if normalized.get("code_segment") is not None:
            normalized["code_segment"] = str(normalized["code_segment"]).strip().upper()
        return super().to_internal_value(normalized)

    def create(self, validated_data):
        try:
            return create_space_node(data=validated_data)
        except (SpatialValidationError, DjangoValidationError) as exc:
            raise serializers.ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages) from exc

    def update(self, instance, validated_data):
        try:
            return update_space_node(instance=instance, data=validated_data)
        except (SpatialValidationError, DjangoValidationError) as exc:
            raise serializers.ValidationError(exc.message_dict if hasattr(exc, "message_dict") else exc.messages) from exc
