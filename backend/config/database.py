"""Database configuration shared by local, CI and deployed environments."""

from pathlib import Path

import environ

POSTGRES_ENGINES = {
    "postgres",
    "postgresql",
    "django.db.backends.postgresql",
}


def build_database_config(base_dir: Path) -> dict[str, dict]:
    """Build Django's DATABASES setting from environment variables.

    ``DATABASE_URL`` has precedence when it is present. Otherwise the discrete
    ``POSTGRES_*`` values are used when ``DB_ENGINE=postgresql``. With neither
    setting, the project keeps SQLite as a deliberate development/test fallback.
    """

    environment_file = base_dir.parent / ".env"
    if environment_file.exists():
        environ.Env.read_env(environment_file, overwrite=False)

    env = environ.Env()
    database_url = env.str("DATABASE_URL", default="").strip()
    engine = env.str("DB_ENGINE", default="sqlite").strip().lower()
    connection_max_age = env.int("DB_CONN_MAX_AGE", default=60)
    connection_health_checks = env.bool("DB_CONN_HEALTH_CHECKS", default=True)

    if database_url:
        database = environ.Env.db_url_config(database_url)
        database["CONN_MAX_AGE"] = connection_max_age
    elif engine in POSTGRES_ENGINES:
        database = {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": env.str("POSTGRES_DB", default="incalpaca_fm"),
            "USER": env.str("POSTGRES_USER", default="incalpaca_fm"),
            "PASSWORD": env.str("POSTGRES_PASSWORD"),
            "HOST": env.str("POSTGRES_HOST", default="127.0.0.1"),
            "PORT": env.int("POSTGRES_PORT", default=5432),
            "CONN_MAX_AGE": connection_max_age,
        }
    elif engine in {"sqlite", "sqlite3", "django.db.backends.sqlite3"}:
        sqlite_path = Path(
            env.str("SQLITE_PATH", default=str(base_dir / "db.sqlite3"))
        ).expanduser()
        if not sqlite_path.is_absolute():
            # Relative paths in the repository-level .env must behave the same
            # whether manage.py is invoked from the root or from backend/.
            sqlite_path = (base_dir.parent / sqlite_path).resolve()
        database = {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": str(sqlite_path),
        }
    else:
        raise ValueError(
            "DB_ENGINE debe ser 'postgresql' o 'sqlite', o debe definirse "
            "DATABASE_URL."
        )

    database["CONN_HEALTH_CHECKS"] = connection_health_checks

    if database["ENGINE"] == "django.db.backends.postgresql":
        options = dict(database.get("OPTIONS", {}))
        options.setdefault("connect_timeout", env.int("DB_CONNECT_TIMEOUT", default=5))
        options.setdefault("application_name", env.str("DB_APPLICATION_NAME", default="incalpaca-fm"))
        ssl_mode = env.str("POSTGRES_SSLMODE", default="prefer").strip()
        if ssl_mode:
            options.setdefault("sslmode", ssl_mode)
        database["OPTIONS"] = options

    return {"default": database}
