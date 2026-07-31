import hashlib
import json
import re
from pathlib import Path

from django.db import migrations


INTERNAL_CODE_PATTERN = re.compile(r"^INC-BIEN-(?P<year>\d{4})-(?P<sequence>\d+)$")
CATALOG_SHA256 = "9b04ff552d664936a0be274fda9b6497937ad546dddc4c82d758eadfda75a82f"


def _load_frozen_catalog():
    """Load the immutable catalog snapshot certified for this migration."""

    catalog_path = (
        Path(__file__).resolve().parents[2] / "taxonomy" / "data" / "catalog_v1.json"
    )
    catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
    canonical_payload = json.dumps(
        catalog,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    digest = hashlib.sha256(canonical_payload).hexdigest()
    if digest != CATALOG_SHA256:
        raise RuntimeError(
            "catalog_v1.json cambió después de crear assets.0004. "
            "Restaure el snapshot certificado y publique los cambios en una migración nueva."
        )
    return catalog


def seed_normalized_taxonomy(apps, schema_editor):
    Taxonomy = apps.get_model("assets", "Taxonomy")
    TaxonomySequence = apps.get_model("assets", "TaxonomySequence")
    Asset = apps.get_model("assets", "Asset")
    AssetInternalSequence = apps.get_model("assets", "AssetInternalSequence")

    catalog = _load_frozen_catalog()
    for row in catalog["taxonomies"]:
        prefix = row["prefix"].strip().upper()
        taxonomy, _ = Taxonomy.objects.update_or_create(
            prefix=prefix,
            defaults={
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
                "review_status": "VALIDATED",
                "aliases": row.get("aliases", []),
                "canonical_prefix": prefix,
                "source_version": catalog["version"],
                "notes": row.get("notes", ""),
                "active": True,
            },
        )
        sequence, _ = TaxonomySequence.objects.get_or_create(taxonomy=taxonomy)
        historical_max = row["last_sequence"]
        if sequence.last_value < historical_max:
            sequence.last_value = historical_max
            sequence.save(update_fields=("last_value", "updated_at"))

    Taxonomy.objects.filter(prefix__isnull=True).update(
        active=False,
        issuance_enabled=False,
        review_status="REVIEW",
    )

    maxima = {}
    for code in Asset.objects.values_list("code", flat=True):
        match = INTERNAL_CODE_PATTERN.fullmatch(code)
        if match:
            year = int(match.group("year"))
            sequence = int(match.group("sequence"))
            maxima[year] = max(maxima.get(year, 0), sequence)
    for year, maximum in maxima.items():
        counter, _ = AssetInternalSequence.objects.get_or_create(year=year)
        if counter.last_value < maximum:
            counter.last_value = maximum
            counter.save(update_fields=("last_value", "updated_at"))


class Migration(migrations.Migration):
    dependencies = [
        ("assets", "0003_taxonomy_catalog_and_fm_codes"),
    ]

    operations = [
        # This migration normalizes existing rows and advances historical
        # sequences. Pretending that it is reversible would silently corrupt a
        # database with issued codes, so Django must stop an unsafe rollback.
        migrations.RunPython(seed_normalized_taxonomy),
    ]
