import hashlib
import importlib
import json
from pathlib import Path

from django.test import SimpleTestCase

migration = importlib.import_module(
    "apps.assets.migrations.0004_seed_normalized_taxonomy"
)


class TaxonomyCatalogMigrationIntegrityTests(SimpleTestCase):
    def test_catalog_snapshot_matches_the_migration_checksum(self):
        catalog_path = (
            Path(migration.__file__).resolve().parents[2]
            / "taxonomy"
            / "data"
            / "catalog_v1.json"
        )

        catalog = json.loads(catalog_path.read_text(encoding="utf-8"))
        canonical_payload = json.dumps(
            catalog,
            ensure_ascii=False,
            separators=(",", ":"),
            sort_keys=True,
        ).encode("utf-8")
        self.assertEqual(hashlib.sha256(canonical_payload).hexdigest(), migration.CATALOG_SHA256)
        self.assertEqual(migration._load_frozen_catalog()["version"], "FM-2026.1")

    def test_data_normalization_is_explicitly_irreversible(self):
        operation = migration.Migration.operations[0]

        self.assertIsNone(operation.reverse_code)
