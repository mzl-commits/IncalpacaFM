import json
from pathlib import Path

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.assets.models import Location


SOURCE_FILE = Path(__file__).resolve().parents[2] / "data" / "taxonomy_locations_2026.json"


class Command(BaseCommand):
    help = "Sincroniza el catálogo oficial de ambientes de TAXONOMIA FM 2026."

    @transaction.atomic
    def handle(self, *args, **options):
        rows = json.loads(SOURCE_FILE.read_text(encoding="utf-8"))
        created = updated = 0
        for row in rows:
            _, was_created = Location.objects.update_or_create(
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
            created += int(was_created)
            updated += int(not was_created)
        review = Location.objects.filter(source_version=rows[0]["source_version"], requires_review=True).count()
        self.stdout.write(self.style.SUCCESS(f"Ambientes sincronizados: {len(rows)} ({created} creados, {updated} actualizados, {review} por revisar)."))
