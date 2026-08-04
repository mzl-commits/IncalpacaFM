from io import StringIO

from django.core.management import call_command
from django.test import TestCase

from apps.assets.models import Location


class TaxonomyLocationCatalogTests(TestCase):
    def test_catalog_contains_every_excel_row_and_sync_is_idempotent(self):
        source = Location.objects.filter(source_version="TAXONOMIA FM 2026 · TAXONOMÍA Solo ambientes")
        self.assertEqual(source.count(), 225)
        self.assertEqual(source.filter(zone="EDIFICIOS ADMINISTRATIVOS").count(), 138)
        self.assertEqual(source.filter(zone="ALMACENES").count(), 16)
        self.assertEqual(source.filter(zone="PLANTAS OPERATIVAS").count(), 55)
        self.assertEqual(source.filter(zone="VESTIDORES").count(), 16)
        self.assertEqual(source.filter(requires_review=True).count(), 1)

        output = StringIO()
        call_command("sync_taxonomy_locations", stdout=output)

        self.assertEqual(source.count(), 225)
        self.assertIn("0 creados, 225 actualizados", output.getvalue())

    def test_duplicate_excel_codes_and_room_names_are_preserved(self):
        self.assertEqual(Location.objects.filter(location_code="AMB-0062").count(), 2)
        self.assertEqual(
            Location.objects.filter(
                zone="PLANTAS OPERATIVAS",
                building="TEJIDO PLANO",
                room="SS.HH. DAMAS",
            ).count(),
            4,
        )
