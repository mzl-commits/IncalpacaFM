import os
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch

from config.database import build_database_config


class DatabaseConfigurationTests(TestCase):
    def test_sqlite_fallback_uses_a_native_path_string(self):
        with TemporaryDirectory() as temporary_directory:
            base_dir = Path(temporary_directory) / "backend"
            with patch.dict(os.environ, {}, clear=True):
                database = build_database_config(base_dir)["default"]

        self.assertEqual(database["ENGINE"], "django.db.backends.sqlite3")
        self.assertEqual(database["NAME"], str(base_dir / "db.sqlite3"))

    def test_relative_sqlite_path_is_resolved_from_repository_root(self):
        environment = {
            "DB_ENGINE": "sqlite",
            "SQLITE_PATH": "backend/archive.sqlite3",
        }

        with TemporaryDirectory() as temporary_directory:
            repository_root = Path(temporary_directory)
            base_dir = repository_root / "backend"
            with patch.dict(os.environ, environment, clear=True):
                database = build_database_config(base_dir)["default"]

        self.assertEqual(
            database["NAME"],
            str((repository_root / "backend" / "archive.sqlite3").resolve()),
        )

    def test_database_url_has_precedence_and_keeps_connection_options(self):
        environment = {
            "DATABASE_URL": "postgresql://incalpaca:secret@db.internal:5544/incalpaca_test",
            "DB_ENGINE": "sqlite",
            "DB_CONN_MAX_AGE": "120",
            "DB_CONN_HEALTH_CHECKS": "1",
            "DB_CONNECT_TIMEOUT": "9",
            "DB_APPLICATION_NAME": "incalpaca-tests",
            "POSTGRES_SSLMODE": "require",
        }

        with TemporaryDirectory() as temporary_directory:
            base_dir = Path(temporary_directory) / "backend"
            with patch.dict(os.environ, environment, clear=True):
                database = build_database_config(base_dir)["default"]

        self.assertEqual(database["ENGINE"], "django.db.backends.postgresql")
        self.assertEqual(database["NAME"], "incalpaca_test")
        self.assertEqual(database["USER"], "incalpaca")
        self.assertEqual(database["PASSWORD"], "secret")
        self.assertEqual(database["HOST"], "db.internal")
        self.assertEqual(database["PORT"], 5544)
        self.assertEqual(database["CONN_MAX_AGE"], 120)
        self.assertTrue(database["CONN_HEALTH_CHECKS"])
        self.assertEqual(database["OPTIONS"]["connect_timeout"], 9)
        self.assertEqual(database["OPTIONS"]["application_name"], "incalpaca-tests")
        self.assertEqual(database["OPTIONS"]["sslmode"], "require")

    def test_discrete_postgres_environment_is_supported(self):
        environment = {
            "DB_ENGINE": "postgresql",
            "POSTGRES_DB": "assets",
            "POSTGRES_USER": "assets_user",
            "POSTGRES_PASSWORD": "secret",
            "POSTGRES_HOST": "127.0.0.1",
            "POSTGRES_PORT": "5433",
        }

        with TemporaryDirectory() as temporary_directory:
            base_dir = Path(temporary_directory) / "backend"
            with patch.dict(os.environ, environment, clear=True):
                database = build_database_config(base_dir)["default"]

        self.assertEqual(database["ENGINE"], "django.db.backends.postgresql")
        self.assertEqual(database["NAME"], "assets")
        self.assertEqual(database["USER"], "assets_user")
        self.assertEqual(database["PORT"], 5433)
