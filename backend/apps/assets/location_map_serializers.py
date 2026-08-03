import hashlib
from pathlib import Path

from django.db import transaction
from django.db.models import Max
from django.urls import reverse
from PIL import Image, UnidentifiedImageError
from rest_framework import serializers

from apps.audit.services import record_audit

from .models import Location, LocationMap

ALLOWED_IMAGE_FORMATS = {
    "JPEG": "jpg",
    "PNG": "png",
    "WEBP": "webp",
}
MAX_IMAGE_BYTES = 10 * 1024 * 1024
MAX_IMAGE_PIXELS = 25_000_000
MIN_IMAGE_EDGE = 320


def protected_location_map_url(obj: LocationMap, request=None) -> str:
    path = reverse("location-map-image", kwargs={"pk": obj.pk})
    return request.build_absolute_uri(path) if request else path


class LocationMapSummarySerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = LocationMap
        fields = (
            "id",
            "version",
            "original_filename",
            "image_sha256",
            "width",
            "height",
            "description",
            "active",
            "created_at",
            "image_url",
        )
        read_only_fields = fields

    def get_image_url(self, obj: LocationMap) -> str:
        return protected_location_map_url(obj, self.context.get("request"))


class LocationSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(source="__str__", read_only=True)
    active_map = serializers.SerializerMethodField()

    class Meta:
        model = Location
        fields = (
            "id",
            "location_code",
            "source_company",
            "source_version",
            "requires_review",
            "review_notes",
            "zone",
            "building",
            "area",
            "room",
            "specific_location",
            "common_space",
            "active",
            "display_name",
            "active_map",
        )
        read_only_fields = fields

    def get_active_map(self, obj: Location) -> dict | None:
        active_maps = getattr(obj, "active_maps", None)
        location_map = active_maps[0] if active_maps else None
        if location_map is None:
            return None
        return LocationMapSummarySerializer(
            location_map,
            context=self.context,
        ).data


class LocationMapUploadSerializer(serializers.Serializer):
    location_id = serializers.PrimaryKeyRelatedField(
        source="location",
        queryset=Location.objects.filter(active=True),
    )
    image = serializers.FileField()
    description = serializers.CharField(
        required=False,
        allow_blank=True,
        max_length=240,
    )

    def validate_image(self, image):
        if image.size > MAX_IMAGE_BYTES:
            raise serializers.ValidationError("La imagen no puede superar 10 MB.")
        try:
            with Image.open(image) as parsed:
                image_format = parsed.format
                width, height = parsed.size
                parsed.verify()
        except (OSError, UnidentifiedImageError, ValueError) as exc:
            raise serializers.ValidationError(
                "Carga una imagen JPG, PNG o WEBP válida."
            ) from exc
        finally:
            image.seek(0)

        if image_format not in ALLOWED_IMAGE_FORMATS:
            raise serializers.ValidationError("Usa únicamente JPG, PNG o WEBP.")
        if width < MIN_IMAGE_EDGE or height < MIN_IMAGE_EDGE:
            raise serializers.ValidationError(
                "La imagen debe medir al menos 320 × 320 píxeles."
            )
        if width * height > MAX_IMAGE_PIXELS:
            raise serializers.ValidationError(
                "La imagen no puede superar 25 millones de píxeles."
            )
        image._location_map_width = width
        image._location_map_height = height
        image._location_map_extension = ALLOWED_IMAGE_FORMATS[image_format]
        return image

    def create(self, validated_data):
        request = self.context["request"]
        location = validated_data["location"]
        image = validated_data["image"]
        description = validated_data.get("description", "").strip()
        original_filename = Path(image.name).name[:255]

        digest = hashlib.sha256()
        for chunk in image.chunks():
            digest.update(chunk)
        image.seek(0)

        created_map = None
        try:
            with transaction.atomic():
                locked_location = Location.objects.select_for_update().get(pk=location.pk)
                LocationMap.objects.filter(
                    location=locked_location,
                    active=True,
                ).update(active=False)
                next_version = (
                    LocationMap.objects.filter(location=locked_location).aggregate(
                        latest=Max("version")
                    )["latest"]
                    or 0
                ) + 1
                storage_name = (
                    f"{locked_location.id}-v{next_version}-{digest.hexdigest()[:12]}."
                    f"{image._location_map_extension}"
                )
                image.name = storage_name
                created_map = LocationMap.objects.create(
                    location=locked_location,
                    version=next_version,
                    image=image,
                    original_filename=original_filename,
                    image_sha256=digest.hexdigest(),
                    width=image._location_map_width,
                    height=image._location_map_height,
                    description=description,
                    active=True,
                    uploaded_by=request.user,
                )
                record_audit(
                    request=request,
                    action="LOCATION_MAP_UPLOADED",
                    entity="LocationMap",
                    entity_id=created_map.id,
                    after={
                        "location_id": str(locked_location.id),
                        "version": next_version,
                        "image_sha256": created_map.image_sha256,
                    },
                )
        except Exception:
            if created_map and created_map.image:
                created_map.image.delete(save=False)
            raise
        return created_map
