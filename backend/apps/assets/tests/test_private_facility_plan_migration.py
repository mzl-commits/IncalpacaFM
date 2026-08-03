import tempfile
from decimal import Decimal
from importlib import import_module
from pathlib import Path

from django.apps import apps as django_apps
from django.test import TestCase, override_settings

from apps.assets.models import FacilityPlan


class PrivateFacilityPlanMigrationTests(TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)
        root = Path(self.temporary_directory.name)
        self.public_root = root / "public"
        self.private_root = root / "private"
        self.override_storage = override_settings(
            MEDIA_ROOT=self.public_root,
            PRIVATE_MEDIA_ROOT=self.private_root,
        )
        self.override_storage.enable()
        self.addCleanup(self.override_storage.disable)
        self.migration = import_module(
            "apps.assets.migrations.0006_private_facility_plan_images"
        )
        self.plan = FacilityPlan.objects.create(
            code="PLAN-MIGRATION",
            name="Plano de migración",
            version="1",
            level_name="Nivel 1",
            source_filename="plano.dwg",
            source_sha256="b" * 64,
            image="facility_plans/plano.svg",
            min_x=Decimal("0"),
            min_y=Decimal("0"),
            max_x=Decimal("10"),
            max_y=Decimal("10"),
        )

    def test_forward_and_reverse_copy_verify_before_removing_source(self):
        content = b"private facility plan"
        public_path = self.public_root / self.plan.image.name
        private_path = self.private_root / self.plan.image.name
        public_path.parent.mkdir(parents=True)
        public_path.write_bytes(content)

        self.migration.move_to_private_storage(django_apps, None)

        self.assertFalse(public_path.exists())
        self.assertEqual(private_path.read_bytes(), content)
        self.migration.move_to_private_storage(django_apps, None)
        self.assertEqual(private_path.read_bytes(), content)

        self.migration.move_to_public_storage(django_apps, None)

        self.assertFalse(private_path.exists())
        self.assertEqual(public_path.read_bytes(), content)

    def test_conflicting_destination_aborts_without_deleting_public_source(self):
        public_path = self.public_root / self.plan.image.name
        private_path = self.private_root / self.plan.image.name
        public_path.parent.mkdir(parents=True)
        private_path.parent.mkdir(parents=True)
        public_path.write_bytes(b"current")
        private_path.write_bytes(b"conflict")

        with self.assertRaisesMessage(RuntimeError, "contenido diferente"):
            self.migration.move_to_private_storage(django_apps, None)

        self.assertEqual(public_path.read_bytes(), b"current")
        self.assertEqual(private_path.read_bytes(), b"conflict")
