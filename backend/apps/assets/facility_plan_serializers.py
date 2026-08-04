from django.db.models import Count, Q
from django.urls import reverse
from rest_framework import serializers

from .models import Asset, FacilityPlan, FacilityPlanMarker, Taxonomy

SUMMARY_STATUSES = (
    FacilityPlanMarker.Status.MATCHED,
    FacilityPlanMarker.Status.TAXONOMY_ONLY,
    FacilityPlanMarker.Status.PLACEHOLDER,
    FacilityPlanMarker.Status.UNKNOWN,
)


def facility_plan_summary(plan: FacilityPlan) -> dict[str, int]:
    annotated = all(
        hasattr(plan, attribute)
        for attribute in (
            "marker_total",
            "marker_matched",
            "marker_taxonomy_only",
            "marker_placeholder",
            "marker_unknown",
        )
    )
    if annotated:
        return {
            "total": plan.marker_total,
            "matched": plan.marker_matched,
            "taxonomy_only": plan.marker_taxonomy_only,
            "placeholder": plan.marker_placeholder,
            "unknown": plan.marker_unknown,
        }
    counts = plan.markers.aggregate(
        total=Count("id"),
        matched=Count("id", filter=Q(status=FacilityPlanMarker.Status.MATCHED)),
        taxonomy_only=Count("id", filter=Q(status=FacilityPlanMarker.Status.TAXONOMY_ONLY)),
        placeholder=Count("id", filter=Q(status=FacilityPlanMarker.Status.PLACEHOLDER)),
        unknown=Count("id", filter=Q(status=FacilityPlanMarker.Status.UNKNOWN)),
    )
    return {key: int(value or 0) for key, value in counts.items()}


class FacilityPlanSummarySerializer(serializers.Serializer):
    total = serializers.IntegerField()
    matched = serializers.IntegerField()
    taxonomy_only = serializers.IntegerField()
    placeholder = serializers.IntegerField()
    unknown = serializers.IntegerField()


class FacilityPlanSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField()
    bounds = serializers.SerializerMethodField()
    summary = serializers.SerializerMethodField()

    class Meta:
        model = FacilityPlan
        fields = (
            "id",
            "code",
            "name",
            "version",
            "level_name",
            "source_filename",
            "source_sha256",
            "image_url",
            "bounds",
            "active",
            "metadata",
            "summary",
            "created_at",
            "updated_at",
        )
        read_only_fields = fields

    def get_image_url(self, obj: FacilityPlan) -> str | None:
        if not obj.image:
            return None
        url = reverse("facility-plan-image", kwargs={"pk": obj.pk})
        request = self.context.get("request")
        return request.build_absolute_uri(url) if request else url

    def get_bounds(self, obj: FacilityPlan) -> dict[str, str]:
        return {
            "min_x": str(obj.min_x),
            "min_y": str(obj.min_y),
            "max_x": str(obj.max_x),
            "max_y": str(obj.max_y),
        }

    def get_summary(self, obj: FacilityPlan) -> dict[str, int]:
        return facility_plan_summary(obj)


class FacilityMarkerTaxonomySerializer(serializers.ModelSerializer):
    class Meta:
        model = Taxonomy
        fields = ("id", "prefix", "name", "category", "subcategory")
        read_only_fields = fields


class FacilityMarkerAssetSerializer(serializers.ModelSerializer):
    display_code = serializers.SerializerMethodField()

    class Meta:
        model = Asset
        fields = ("id", "code", "fm_code", "display_code", "name")
        read_only_fields = fields

    def get_display_code(self, obj: Asset) -> str:
        return obj.fm_code or obj.code


class FacilityPlanMarkerSerializer(serializers.ModelSerializer):
    source = serializers.SerializerMethodField()
    normalized = serializers.SerializerMethodField()
    taxonomy = FacilityMarkerTaxonomySerializer(read_only=True)
    asset = FacilityMarkerAssetSerializer(read_only=True)

    class Meta:
        model = FacilityPlanMarker
        fields = (
            "id",
            "source_index",
            "raw_code",
            "label",
            "layer",
            "source",
            "normalized",
            "taxonomy",
            "asset",
            "status",
        )
        read_only_fields = fields

    def get_source(self, obj: FacilityPlanMarker) -> dict[str, str]:
        return {"x": str(obj.source_x), "y": str(obj.source_y)}

    def get_normalized(self, obj: FacilityPlanMarker) -> dict[str, str]:
        return {"x": str(obj.normalized_x), "y": str(obj.normalized_y)}


class FacilityPlanDetailSerializer(FacilityPlanSerializer):
    markers = serializers.SerializerMethodField()

    class Meta(FacilityPlanSerializer.Meta):
        fields = FacilityPlanSerializer.Meta.fields + ("markers",)

    def get_markers(self, obj: FacilityPlan) -> list[dict]:
        markers = getattr(obj, "filtered_markers", None)
        if markers is None:
            markers = obj.markers.select_related("taxonomy", "asset").order_by("source_index")
        return FacilityPlanMarkerSerializer(
            markers,
            many=True,
            context=self.context,
        ).data


class FacilityPlanReconcileResponseSerializer(serializers.Serializer):
    plan_id = serializers.UUIDField()
    updated = serializers.IntegerField()
    summary = FacilityPlanSummarySerializer()
