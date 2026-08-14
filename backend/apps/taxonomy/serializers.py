import re

from django.db import transaction
from rest_framework import serializers

from apps.assets.models import Asset, Taxonomy, TaxonomySequence, TaxonomyFamily, TaxonomyPart, TaxonomyPiece

PREFIX_PATTERN = re.compile(r"^[A-Z][A-Z0-9]{0,15}$")


class TaxonomyFamilySerializer(serializers.ModelSerializer):
    class Meta:
        model = TaxonomyFamily
        fields = ("id", "code", "name", "active", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_code(self, value):
        normalized = value.strip().upper()
        if TaxonomyFamily.objects.filter(code=normalized).exclude(pk=getattr(self.instance, 'pk', None)).exists():
            raise serializers.ValidationError("Ya existe una familia con este código.")
        return normalized


class TaxonomyPieceSerializer(serializers.ModelSerializer):
    class Meta:
        model = TaxonomyPiece
        fields = ("id", "part", "piece_code", "name", "active", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")

    def validate_piece_code(self, value):
        normalized = value.strip().upper()
        return normalized

    def validate(self, attrs):
        part = attrs.get('part', getattr(self.instance, 'part', None))
        piece_code = attrs.get('piece_code', getattr(self.instance, 'piece_code', None))
        if part and piece_code:
            qs = TaxonomyPiece.objects.filter(part=part, piece_code=piece_code)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({"piece_code": "Ya existe una pieza con este código en la parte seleccionada."})
        return attrs


class TaxonomyPartSerializer(serializers.ModelSerializer):
    pieces = TaxonomyPieceSerializer(many=True, read_only=True)

    class Meta:
        model = TaxonomyPart
        fields = ("id", "taxonomy", "part_code", "name", "active", "created_at", "updated_at", "pieces")
        read_only_fields = ("id", "created_at", "updated_at", "pieces")

    def validate_part_code(self, value):
        normalized = value.strip().upper()
        return normalized

    def validate(self, attrs):
        taxonomy = attrs.get('taxonomy', getattr(self.instance, 'taxonomy', None))
        part_code = attrs.get('part_code', getattr(self.instance, 'part_code', None))
        if taxonomy and part_code:
            qs = TaxonomyPart.objects.filter(taxonomy=taxonomy, part_code=part_code)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({"part_code": "Ya existe una parte con este código en la taxonomía seleccionada."})
        return attrs


class TaxonomySerializer(serializers.ModelSerializer):
    family_id = serializers.PrimaryKeyRelatedField(
        queryset=TaxonomyFamily.objects.all(), source='family', required=True, write_only=True
    )
    family_detail = TaxonomyFamilySerializer(source='family', read_only=True)
    type_code = serializers.CharField(required=True, allow_blank=False, max_length=10)
    prefix = serializers.CharField(read_only=True)
    asset_count = serializers.SerializerMethodField()
    last_sequence = serializers.SerializerMethodField()
    next_code_preview = serializers.SerializerMethodField()

    class Meta:
        model = Taxonomy
        fields = (
            "id",
            "family_id",
            "family_detail",
            "type_code",
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

    def validate_type_code(self, value):
        normalized = value.strip().upper()
        if not re.fullmatch(r"^[A-Z0-9]+$", normalized):
            raise serializers.ValidationError(
                "Debe contener solo A-Z y números."
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
        if not 2 <= value <= 8:
            raise serializers.ValidationError("Debe estar entre 2 y 8 dígitos.")
        return value

    def validate(self, attrs):
        instance = self.instance
        family = attrs.get("family", instance.family if instance else None)
        type_code = attrs.get("type_code", instance.type_code if instance else None)
        prefix = f"{family.code}-{type_code}" if family and type_code else (instance.prefix if instance else None)

        if family and type_code:
            queryset = Taxonomy.objects.filter(family=family, type_code=type_code)
            if instance:
                queryset = queryset.exclude(pk=instance.pk)
            if queryset.exists():
                raise serializers.ValidationError(
                    {"type_code": "Ya existe una taxonomía con este tipo en la familia seleccionada."}
                )

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
        family = validated_data.get('family')
        type_code = validated_data.get('type_code')
        if family and type_code:
            validated_data["canonical_prefix"] = f"{family.code}-{type_code}"
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
            "full_assignment_code",
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
