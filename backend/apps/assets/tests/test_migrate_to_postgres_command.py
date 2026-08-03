import json
import tempfile
from io import StringIO
from pathlib import Path
from unittest import skipUnless
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connections
from django.test import TestCase

from apps.accounts.models import AccountProfile
from apps.assets.management.commands.migrate_to_postgres import (
    INTERNAL_MODEL_LABELS,
    Command,
    _project_models,
    _serialize_models,
    _without_runtime_metadata,
)
from apps.assets.models import Taxonomy, TaxonomySequence


@skipUnless(
    connections["default"].vendor == "sqlite",
    "La exportación portable de origen se certifica contra SQLite.",
)
class MigrateToPostgresCommandTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username="portable-admin",
            password="Montescoli3",
            email="portable@example.test",
        )
        AccountProfile.objects.create(
            user=self.user,
            worker_code="PORTABLE-001",
            role=AccountProfile.Role.ADMIN,
            must_change_password=False,
        )
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary_directory.cleanup)
        self.bundle_path = Path(self.temporary_directory.name) / "portable.json"

    def export_bundle(self) -> dict:
        call_command(
            "migrate_to_postgres",
            "export",
            output=self.bundle_path,
            stdout=StringIO(),
        )
        return json.loads(self.bundle_path.read_text(encoding="utf-8"))

    def test_export_is_portable_and_excludes_internal_django_models(self):
        bundle = self.export_bundle()

        labels = [row["model"] for row in bundle["objects"]]
        self.assertEqual(bundle["format"], "sgtb-portable-data")
        self.assertEqual(bundle["source"]["vendor"], "sqlite")
        self.assertTrue(INTERNAL_MODEL_LABELS.isdisjoint(labels))
        self.assertIn("auth.user", labels)
        self.assertIn("accounts.accountprofile", labels)
        self.assertLess(
            bundle["models"].index("auth.user"),
            bundle["models"].index("accounts.accountprofile"),
        )

        exported_user = next(
            row
            for row in bundle["objects"]
            if row["model"] == "auth.user"
            and row["fields"]["username"] == self.user.username
        )
        self.assertNotIn("pk", exported_user)
        self.assertTrue(exported_user["fields"]["password"].startswith("pbkdf2_"))

        output = StringIO()
        call_command(
            "migrate_to_postgres",
            "validate",
            input=self.bundle_path,
            stdout=output,
        )
        self.assertIn("Bundle válido", output.getvalue())

    def test_export_refuses_to_overwrite_an_existing_bundle(self):
        self.export_bundle()

        with self.assertRaisesMessage(CommandError, "no será sobrescrito"):
            call_command(
                "migrate_to_postgres",
                "export",
                output=self.bundle_path,
                stdout=StringIO(),
            )

    def test_export_reads_a_consistent_transactional_snapshot(self):
        def assert_atomic_snapshot(models, database):
            self.assertTrue(connections[database].in_atomic_block)
            return _serialize_models(models, database)

        with patch(
            "apps.assets.management.commands.migrate_to_postgres._serialize_models",
            side_effect=assert_atomic_snapshot,
        ):
            self.export_bundle()

    def test_validate_rejects_a_tampered_bundle(self):
        bundle = self.export_bundle()
        bundle["objects"][0]["fields"] = {}
        self.bundle_path.write_text(json.dumps(bundle), encoding="utf-8")

        with self.assertRaisesMessage(CommandError, "firma SHA-256"):
            call_command(
                "migrate_to_postgres",
                "validate",
                input=self.bundle_path,
                stdout=StringIO(),
            )

    def test_import_refuses_a_sqlite_target_without_changing_it(self):
        self.export_bundle()
        before_users = get_user_model().objects.count()

        with self.assertRaisesMessage(CommandError, "solo se permite sobre PostgreSQL"):
            call_command(
                "migrate_to_postgres",
                "import",
                input=self.bundle_path,
                replace_bootstrap_taxonomy=True,
                stdout=StringIO(),
            )

        self.assertEqual(get_user_model().objects.count(), before_users)


class BootstrapTaxonomySafetyTests(TestCase):
    def test_requires_explicit_flag_before_replacing_pristine_bootstrap(self):
        command = Command()
        original_taxonomies = Taxonomy.objects.count()
        original_sequences = TaxonomySequence.objects.count()
        self.assertGreater(original_taxonomies, 0)

        with self.assertRaisesMessage(CommandError, "--replace-bootstrap-taxonomy"):
            command._prepare_empty_target("default", _project_models(), False)

        self.assertEqual(Taxonomy.objects.count(), original_taxonomies)
        self.assertEqual(TaxonomySequence.objects.count(), original_sequences)

        command._prepare_empty_target("default", _project_models(), True)
        self.assertEqual(Taxonomy.objects.count(), 0)
        self.assertEqual(TaxonomySequence.objects.count(), 0)

    def test_refuses_to_replace_a_modified_bootstrap(self):
        command = Command()
        taxonomy = Taxonomy.objects.order_by("prefix").first()
        taxonomy.name = f"{taxonomy.name} editada"
        taxonomy.save(update_fields=("name", "updated_at"))
        original_taxonomies = Taxonomy.objects.count()

        with self.assertRaisesMessage(CommandError, "no coinciden exactamente"):
            command._prepare_empty_target("default", _project_models(), True)

        self.assertEqual(Taxonomy.objects.count(), original_taxonomies)


class RuntimeMetadataVerificationTests(TestCase):
    def test_only_last_access_is_removed_from_account_profile(self):
        rows = [
            {
                "model": "accounts.accountprofile",
                "pk": "profile-1",
                "fields": {
                    "worker_code": "admin",
                    "last_access": "2026-07-31T15:00:00Z",
                    "failed_attempts": 2,
                },
            },
            {
                "model": "assets.asset",
                "pk": "asset-1",
                "fields": {"updated_at": "2026-07-31T15:00:00Z"},
            },
        ]

        normalized = _without_runtime_metadata(rows)

        self.assertNotIn("last_access", normalized[0]["fields"])
        self.assertEqual(normalized[0]["fields"]["failed_attempts"], 2)
        self.assertEqual(normalized[1], rows[1])
        self.assertIn("last_access", rows[0]["fields"])
