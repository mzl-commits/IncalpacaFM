import json
from pathlib import Path

from django.db import migrations, models


SOURCE_FILE = Path(__file__).resolve().parents[1] / "data" / "taxonomy_locations_2026.json"


def import_locations(apps, schema_editor):
    Location = apps.get_model("assets", "Location")
    rows = json.loads(SOURCE_FILE.read_text(encoding="utf-8"))
    for row in rows:
        Location.objects.update_or_create(
            zone=row["zone"],
            building=row["building"],
            area=row["area"],
            room=row["room"],
            location_code=row["location_code"],
            defaults={
                "source_company": row["source_company"],
                "source_row": row["source_row"],
                "source_version": row["source_version"],
                "common_space": row["common_space"],
                "requires_review": row["requires_review"],
                "review_notes": row["review_notes"],
                "active": True,
            },
        )


def remove_imported_locations(apps, schema_editor):
    Location = apps.get_model("assets", "Location")
    Location.objects.filter(source_version="TAXONOMIA FM 2026 · TAXONOMÍA Solo ambientes").delete()


class Migration(migrations.Migration):
    dependencies = [("assets", "0007_location_reference_maps")]

    operations = [
        migrations.RemoveConstraint(model_name="location", name="uq_asset_location"),
        migrations.AddField(model_name="location", name="location_code", field=models.CharField(blank=True, db_index=True, max_length=20)),
        migrations.AddField(model_name="location", name="source_company", field=models.CharField(blank=True, max_length=100)),
        migrations.AddField(model_name="location", name="source_row", field=models.PositiveIntegerField(blank=True, null=True)),
        migrations.AddField(model_name="location", name="source_version", field=models.CharField(blank=True, max_length=80)),
        migrations.AddField(model_name="location", name="requires_review", field=models.BooleanField(default=False)),
        migrations.AddField(model_name="location", name="review_notes", field=models.CharField(blank=True, max_length=240)),
        migrations.AddConstraint(
            model_name="location",
            constraint=models.UniqueConstraint(fields=("zone", "building", "area", "room", "location_code"), name="uq_asset_location"),
        ),
        migrations.RunPython(import_locations, remove_imported_locations),
    ]
