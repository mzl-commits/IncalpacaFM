import hashlib
import json
import os
import tempfile
from decimal import Decimal
from io import StringIO
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings

from apps.assets.models import Asset, FacilityPlan, FacilityPlanMarker, Taxonomy


class ImportFacilityPlanCommandTests(TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)
        self.root = Path(self.temporary_directory.name)
        self.private_media_root = self.root / "private-media"
        self.override_private_media = override_settings(
            PRIVATE_MEDIA_ROOT=self.private_media_root
        )
        self.override_private_media.enable()
        self.addCleanup(self.override_private_media.disable)

        self.json_path = self.root / "plan.json"
        self.image_path = self.root / "plan.svg"
        self.dwg_path = self.root / "plan.dwg"
        self.image_path.write_text(
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
            '<path d="M0 0H100V100H0Z"/></svg>',
            encoding="utf-8",
        )
        self.dwg_content = b"AC1032" + b"\0" * 128
        self.dwg_path.write_bytes(self.dwg_content)
        self.taxonomy = Taxonomy.objects.get(prefix="IM")
        self.user = get_user_model().objects.create_user(username="plan-import-user")
        self.asset = Asset.objects.create(
            code="INC-BIEN-2026-991000",
            fm_code="IM-9910",
            fm_sequence_value=9910,
            taxonomy=self.taxonomy,
            entry_type=Asset.EntryType.PURCHASE,
            name="Impresora importada",
            description="Prueba de enlace exacto",
            condition="Bueno",
            registered_by=self.user,
        )

    def write_document(self, objects):
        self.json_path.write_text(
            json.dumps({"created_by": "LibreDWG", "OBJECTS": objects}),
            encoding="utf-8",
        )

    def command_options(self, **overrides):
        options = {
            "json_path": self.json_path,
            "image": self.image_path,
            "dwg": self.dwg_path,
            "dwg_sha256": hashlib.sha256(self.dwg_content).hexdigest(),
            "code": "PLAN-TEST-01",
            "name": "Planta de prueba",
            "plan_version": "2025.1",
            "level_name": "Nivel 1",
            "min_x": Decimal("0"),
            "min_y": Decimal("0"),
            "max_x": Decimal("100"),
            "max_y": Decimal("100"),
            "stdout": StringIO(),
        }
        options.update(overrides)
        return options

    def test_import_extracts_known_prefixes_links_exact_and_normalizes_inverted_y(self):
        self.write_document(
            [
                {
                    "object": "LAYER",
                    "index": 9,
                    "handle": [0, 2, 22739],
                    "name": "FM-CODES",
                },
                {
                    "entity": "TEXT",
                    "index": 10,
                    "type": 1,
                    "text_value": "IM-9910",
                    "layer": [5, 2, 22739, 22739],
                    "ins_pt": [10, 20, 0],
                },
                {
                    "object": "MTEXT",
                    "index": 11,
                    "text": "Reserva IM-XXXX",
                    "layer": "FM-RESERVAS",
                    "insertion_point": [100, 0, 0],
                },
                {
                    "object": "TEXT",
                    "index": 12,
                    "text_value": "ZZZ-0001",
                    "insertion_pt": {"x": 30, "y": 30},
                },
                {
                    "object": "LINE",
                    "index": 13,
                    "text_value": "IM-9910",
                    "insertion_pt": {"x": 40, "y": 40},
                },
                {
                    "object": "TEXT",
                    "index": 14,
                    "text_value": "XIM-9910Z",
                    "insertion_pt": {"x": 50, "y": 50},
                },
            ]
        )
        options = self.command_options()

        call_command("import_facility_plan", **options)

        plan = FacilityPlan.objects.get(code="PLAN-TEST-01")
        markers = list(plan.markers.order_by("source_index"))
        self.assertEqual(plan.source_filename, "plan.dwg")
        self.assertEqual(plan.source_sha256, options["dwg_sha256"])
        self.assertTrue(plan.image.name.startswith("facility_plans/PLAN-TEST-01"))
        self.assertTrue(
            os.path.samefile(Path(plan.image.path).parents[1], self.private_media_root)
        )
        self.assertTrue(Path(plan.image.path).is_file())
        self.assertEqual(plan.metadata["skipped_unknown_prefixes"], ["ZZZ"])
        self.assertEqual(len(markers), 2)

        matched, placeholder = markers
        self.assertEqual(matched.raw_code, "IM-9910")
        self.assertEqual(matched.asset_id, self.asset.id)
        self.assertEqual(matched.taxonomy_id, self.taxonomy.id)
        self.assertEqual(matched.status, FacilityPlanMarker.Status.MATCHED)
        self.assertEqual(matched.layer, "FM-CODES")
        self.assertEqual(matched.normalized_x, Decimal("0.10000000"))
        self.assertEqual(matched.normalized_y, Decimal("0.80000000"))
        self.assertEqual(placeholder.raw_code, "IM-XXXX")
        self.assertIsNone(placeholder.asset_id)
        self.assertEqual(placeholder.status, FacilityPlanMarker.Status.PLACEHOLDER)
        self.assertEqual(placeholder.normalized_x, Decimal("1.00000000"))
        self.assertEqual(placeholder.normalized_y, Decimal("1.00000000"))

        result = json.loads(options["stdout"].getvalue())
        self.assertTrue(result["created"])
        self.assertEqual(
            result["summary"],
            {
                "matched": 1,
                "placeholder": 1,
                "taxonomy_only": 0,
                "total": 2,
                "unknown": 0,
            },
        )

    def test_sha_mismatch_and_unsafe_svg_are_rejected_without_writes(self):
        self.write_document([])
        with self.assertRaisesMessage(CommandError, "SHA-256 del DWG no coincide"):
            call_command(
                "import_facility_plan",
                **self.command_options(dwg_sha256="0" * 64),
            )
        self.assertFalse(FacilityPlan.objects.filter(code="PLAN-TEST-01").exists())

        self.image_path.write_text(
            '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
            encoding="utf-8",
        )
        with self.assertRaisesMessage(CommandError, "elemento no permitido"):
            call_command("import_facility_plan", **self.command_options())
        self.assertFalse(FacilityPlan.objects.filter(code="PLAN-TEST-01").exists())

    def test_replace_is_explicit_and_preserves_existing_plan_identity(self):
        self.write_document(
            [
                {
                    "object": "TEXT",
                    "index": 1,
                    "text_value": "IM-9910",
                    "insertion_pt": [10, 20],
                }
            ]
        )
        call_command("import_facility_plan", **self.command_options())
        plan = FacilityPlan.objects.get(code="PLAN-TEST-01")
        original_id = plan.id

        self.write_document(
            [
                {
                    "object": "TEXT",
                    "index": 2,
                    "text_value": "IM-9999",
                    "insertion_pt": [40, 60],
                }
            ]
        )
        with self.assertRaisesMessage(CommandError, "usa --replace"):
            call_command("import_facility_plan", **self.command_options())
        self.assertEqual(list(plan.markers.values_list("raw_code", flat=True)), ["IM-9910"])

        call_command(
            "import_facility_plan", **self.command_options(replace=True, stdout=StringIO())
        )
        plan.refresh_from_db()
        self.assertEqual(plan.id, original_id)
        marker = plan.markers.get()
        self.assertEqual(marker.raw_code, "IM-9999")
        self.assertEqual(marker.status, FacilityPlanMarker.Status.TAXONOMY_ONLY)
        self.assertIsNone(marker.asset_id)

    def test_invalid_replacement_rolls_back_plan_and_markers(self):
        self.write_document(
            [
                {
                    "object": "TEXT",
                    "index": 1,
                    "text_value": "IM-9910",
                    "insertion_pt": [10, 20],
                }
            ]
        )
        call_command("import_facility_plan", **self.command_options())
        plan = FacilityPlan.objects.get(code="PLAN-TEST-01")
        original_image = plan.image.name

        self.write_document(
            [
                {
                    "object": "TEXT",
                    "index": 7,
                    "text_value": "IM-9999",
                    "insertion_pt": [101, 20],
                }
            ]
        )
        with self.assertRaisesMessage(CommandError, "fuera de los límites"):
            call_command(
                "import_facility_plan",
                **self.command_options(replace=True, stdout=StringIO()),
            )

        plan.refresh_from_db()
        self.assertEqual(plan.image.name, original_image)
        self.assertEqual(list(plan.markers.values_list("raw_code", flat=True)), ["IM-9910"])

    def test_duplicate_source_indexes_are_rejected_atomically(self):
        self.write_document(
            [
                {
                    "object": "TEXT",
                    "index": 5,
                    "text_value": "IM-9910",
                    "insertion_pt": [10, 20],
                },
                {
                    "object": "MTEXT",
                    "index": 5,
                    "text": "IM-XXXX",
                    "insertion_pt": [30, 40],
                },
            ]
        )

        with self.assertRaisesMessage(CommandError, "mismo source_index"):
            call_command("import_facility_plan", **self.command_options())
        self.assertFalse(FacilityPlan.objects.filter(code="PLAN-TEST-01").exists())
