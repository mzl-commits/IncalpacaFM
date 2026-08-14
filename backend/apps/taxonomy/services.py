import re

from django.db import IntegrityError, transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.assets.models import (
    Asset,
    AssetInternalSequence,
    Taxonomy,
    TaxonomySequence,
)

from .catalog import load_catalog, load_catalog_rows

INTERNAL_CODE_PATTERN = re.compile(r"^INC-BIEN-(?P<year>\d{4})-(?P<sequence>\d+)$")


def _existing_internal_max(year):
    maximum = 0
    for code in Asset.objects.filter(code__startswith=f"INC-BIEN-{year}-").values_list(
        "code",
        flat=True,
    ):
        match = INTERNAL_CODE_PATTERN.fullmatch(code)
        if match:
            maximum = max(maximum, int(match.group("sequence")))
    return maximum


def _get_or_create_internal_counter(year):
    try:
        with transaction.atomic():
            AssetInternalSequence.objects.create(
                year=year,
                last_value=_existing_internal_max(year),
            )
    except IntegrityError:
        pass
    return AssetInternalSequence.objects.select_for_update().get(year=year)


@transaction.atomic
def allocate_internal_code(year=None):
    year = year or timezone.localdate().year
    try:
        counter = AssetInternalSequence.objects.select_for_update().get(year=year)
    except AssetInternalSequence.DoesNotExist:
        counter = _get_or_create_internal_counter(year)
    counter.last_value += 1
    counter.save(update_fields=("last_value", "updated_at"))
    return f"INC-BIEN-{year}-{counter.last_value:06d}"


@transaction.atomic
def allocate_fm_identifier(taxonomy):
    taxonomy = Taxonomy.objects.select_for_update().get(pk=taxonomy.pk)
    if not taxonomy.active:
        raise ValidationError(
            {"taxonomy_id": "La taxonomía seleccionada está inactiva."}
        )
    if not taxonomy.issuance_enabled:
        raise ValidationError(
            {"taxonomy_id": "La taxonomía no permite emitir nuevos códigos."}
        )
    if taxonomy.review_status != Taxonomy.ReviewStatus.VALIDATED:
        raise ValidationError(
            {"taxonomy_id": "La taxonomía debe validarse antes de emitir códigos."}
        )
    if not taxonomy.prefix:
        raise ValidationError(
            {"taxonomy_id": "La taxonomía no tiene un prefijo operativo."}
        )

    sequence, _ = TaxonomySequence.objects.get_or_create(
        taxonomy=taxonomy,
        defaults={"last_value": 0},
    )
    sequence = TaxonomySequence.objects.select_for_update().get(pk=sequence.pk)
    next_value = sequence.last_value + 1
    sequence.last_value = next_value
    sequence.save(update_fields=("last_value", "updated_at"))
    return f"{taxonomy.prefix}-{next_value:0{taxonomy.sequence_digits}d}", next_value


@transaction.atomic
def assign_fm_identifier(asset, taxonomy):
    asset = Asset.objects.select_for_update().get(pk=asset.pk)
    if asset.fm_code:
        if asset.taxonomy_id != taxonomy.pk:
            raise ValidationError(
                {"taxonomy_id": "El bien ya tiene un código FM de otra taxonomía."}
            )
        return asset
    fm_code, sequence_value = allocate_fm_identifier(taxonomy)
    payload = dict(asset.entry_payload or {})
    payload.update(
        {
            "classificationPending": False,
            "taxonomyId": str(taxonomy.id),
            "taxonomyPrefix": taxonomy.prefix,
            "assetType": taxonomy.asset_type,
            "category": taxonomy.category,
            "subcategory": taxonomy.subcategory,
            "technicalSpecialty": taxonomy.specialty,
        }
    )
    asset.taxonomy = taxonomy
    asset.fm_code = fm_code
    asset.fm_sequence_value = sequence_value
    asset.entry_payload = payload
    asset.save(
        update_fields=(
            "taxonomy",
            "fm_code",
            "fm_sequence_value",
            "entry_payload",
            "updated_at",
        )
    )
    return asset


@transaction.atomic
def sync_taxonomy_catalog():
    catalog = load_catalog()
    seeded = []
    for row in load_catalog_rows():
        prefix = row["prefix"].strip().upper()
        defaults = {
            "name": row["name"],
            "asset_type": row["asset_type"],
            "category": row["category"],
            "subcategory": row["subcategory"],
            "specialty": row["specialty"],
            "sequence_digits": row["sequence_digits"],
            "default_criticality": row.get("default_criticality", "Media"),
            "useful_life_years": row.get("useful_life_years"),
            "preventive_frequency_months": row.get("preventive_frequency_months"),
            "requires_maintenance": row.get("requires_maintenance", False),
            "requires_certification": row.get("requires_certification", False),
            "issuance_enabled": True,
            "review_status": Taxonomy.ReviewStatus.VALIDATED,
            "aliases": row.get("aliases", []),
            "canonical_prefix": prefix,
            "source_version": catalog["version"],
            "notes": row.get("notes", ""),
            "active": True,
        }
        taxonomy, _ = Taxonomy.objects.update_or_create(
            prefix=prefix, defaults=defaults
        )
        sequence, _ = TaxonomySequence.objects.get_or_create(taxonomy=taxonomy)
        historical_max = row["last_sequence"]
        if sequence.last_value < historical_max:
            sequence.last_value = historical_max
            sequence.save(update_fields=("last_value", "updated_at"))
        seeded.append(taxonomy)

    Taxonomy.objects.filter(prefix__isnull=True).update(
        active=False,
        issuance_enabled=False,
        review_status=Taxonomy.ReviewStatus.REVIEW,
    )
    return seeded
