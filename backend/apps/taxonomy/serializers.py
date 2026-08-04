import re

from django.db import transaction
from rest_framework import serializers

from apps.assets.models import Asset, Taxonomy, TaxonomySequence

PREFIX_PATTERN = re.compile(r"^[A-Z][A-Z0-9]{0,15}$")


class TaxonomySerializer(serializers.ModelSerializer):
    prefix = serializers.CharField(required=True, allow_blank=False, max_length=16)
    asset_count = serializers.SerializerMethodField()
    last_sequence = serializers.SerializerMethodField()
    next_code_preview = serializers.SerializerMethodField()

    class Meta:
        model = Taxonomy
        fields = (
            "id",
            "prefix",
            "name",
            "asset_type",
            "category",
            "subcategory",
            "specialty",
            "sequence_digits",
            "default_criticality",
            "useful_life_years",
            "preventive_frequency_months",
            "requires_maintenance",
            "requires_certification",
            "issuance_enabled",
            "review_status",
            "aliases",
            "canonical_prefix",
            "active",
            "asset_count",
            "last_sequence",
            "next_code_preview",
            "source_version",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "canonical_prefix",
            "asset_count",
            "last_sequence",
            "next_code_preview",
            "source_version",
            "created_at",
            "updated_at",
        )

    def get_asset_count(self, obj) -> int:
        annotated = getattr(obj, "asset_count", None)
        return annotated if annotated is not None else obj.asset_set.count()

    def get_last_sequence(self, obj) -> int:
        if "locked_sequence_last_value" in self.context:
            return self.context["locked_sequence_last_value"]
        try:
            return obj.sequence.last_value
        except TaxonomySequence.DoesNotExist:
            return 0

    def get_next_code_preview(self, obj) -> str | None:
        if not obj.prefix:
            return None
        value = self.get_last_sequence(obj) + 1
        if value >= 10**obj.sequence_digits:
            return None
        return f"{obj.prefix}-{value:0{obj.sequence_digits}d}"

    def validate_prefix(self, value):
        normalized = value.strip().upper()
        if not PREFIX_PATTERN.fullmatch(normalized):
            raise serializers.ValidationError(
                "Debe iniciar con una letra y contener solo A-Z y números."
            )
        queryset = Taxonomy.objects.filter(prefix__iexact=normalized)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError(
                "Ya existe una taxonomía con este prefijo."
            )
        return normalized

    def validate_aliases(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError(
                "Los alias deben enviarse como una lista."
            )
        normalized = []
        seen = set()
        for alias in value:
            alias = str(alias).strip()
            if alias and alias.casefold() not in seen:
                normalized.append(alias)
                seen.add(alias.casefold())
        return normalized

    def validate_sequence_digits(self, value):
        if not 3 <= value <= 8:
            raise serializers.ValidationError("Debe estar entre 3 y 8 dígitos.")
        return value

    def validate(self, attrs):
        instance = self.instance
        prefix = attrs.get("prefix", instance.prefix if instance else None)
        active = attrs.get("active", instance.active if instance else True)
        issuance_enabled = attrs.get(
            "issuance_enabled",
            instance.issuance_enabled if instance else True,
        )
        review_status = attrs.get(
            "review_status",
            instance.review_status if instance else Taxonomy.ReviewStatus.VALIDATED,
        )
        requires_maintenance = attrs.get(
            "requires_maintenance",
            instance.requires_maintenance if instance else False,
        )
        frequency = attrs.get(
            "preventive_frequency_months",
            instance.preventive_frequency_months if instance else None,
        )
        if issuance_enabled and (not active or not prefix):
            raise serializers.ValidationError(
                {
                    "issuance_enabled": "Solo una taxonomía activa y con prefijo puede emitir códigos."
                }
            )
        if issuance_enabled and review_status != Taxonomy.ReviewStatus.VALIDATED:
            raise serializers.ValidationError(
                {
                    "issuance_enabled": "Una taxonomía en revisión no puede emitir códigos."
                }
            )
        if requires_maintenance and not frequency:
            raise serializers.ValidationError(
                {
                    "preventive_frequency_months": (
                        "Indica la frecuencia cuando el mantenimiento es obligatorio."
                    )
                }
            )
        if instance:
            sequence_changed = (
                prefix != instance.prefix
                or attrs.get("sequence_digits", instance.sequence_digits)
                != instance.sequence_digits
            )
            if "locked_sequence_last_value" in self.context:
                has_issued_codes = self.context["locked_sequence_last_value"] > 0
            else:
                try:
                    has_issued_codes = instance.sequence.last_value > 0
                except TaxonomySequence.DoesNotExist:
                    has_issued_codes = False
            if sequence_changed and has_issued_codes:
                raise serializers.ValidationError(
                    {
                        "prefix": (
                            "El prefijo y sus dígitos son inmutables después de emitir códigos."
                        )
                    }
                )
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        validated_data["canonical_prefix"] = validated_data["prefix"]
        validated_data["source_version"] = "MANUAL"
        taxonomy = super().create(validated_data)
        TaxonomySequence.objects.create(taxonomy=taxonomy)
        return taxonomy


class FMCodeAssetSerializer(serializers.ModelSerializer):
    taxonomy_detail = serializers.SerializerMethodField()

    class Meta:
        model = Asset
        fields = (
            "id",
            "code",
            "fm_code",
            "name",
            "brand",
            "model",
            "administrative_status",
            "operational_status",
            "assignment_status",
            "created_at",
            "taxonomy_detail",
        )
        read_only_fields = fields

    def get_taxonomy_detail(self, obj) -> dict | None:
        if not obj.taxonomy:
            return None
        return {
            "id": str(obj.taxonomy_id),
            "prefix": obj.taxonomy.prefix,
            "name": obj.taxonomy.name,
            "category": obj.taxonomy.category,
            "subcategory": obj.taxonomy.subcategory,
        }
