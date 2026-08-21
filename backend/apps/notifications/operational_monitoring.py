"""Periodic operational checks that feed the existing notification outbox."""

import logging
import shutil
import socket
import ssl
from datetime import datetime, timezone as dt_timezone
from pathlib import Path

from django.conf import settings

from config.health import celery_probe, database_probe, redis_probe

from .services import queue_for_administrators


logger = logging.getLogger(__name__)


def _notify(event: str, subject: str, body: str, discriminator: str) -> None:
    logger.warning("Operational alert %s: %s", event, body)
    queue_for_administrators(
        event=event,
        subject=subject,
        body=body,
        discriminator=discriminator,
    )


def _check_dependency(name: str, probe) -> None:
    healthy, _ = probe()
    if not healthy:
        _notify(
            f"HEALTH_{name.upper()}_UNAVAILABLE",
            f"Alerta operativa: {name} no disponible",
            f"La verificación automática no pudo confirmar la disponibilidad de {name}.",
            f"{name}:{datetime.now(dt_timezone.utc):%Y%m%d%H}",
        )


def _check_disk() -> None:
    try:
        usage = shutil.disk_usage(Path(settings.MEDIA_ROOT))
    except OSError:
        _notify(
            "HEALTH_DISK_UNAVAILABLE",
            "Alerta operativa: almacenamiento no disponible",
            "No se pudo consultar el almacenamiento de evidencias y documentos.",
            f"disk-unavailable:{datetime.now(dt_timezone.utc):%Y%m%d%H}",
        )
        return

    used_percent = round((usage.used / usage.total) * 100)
    if used_percent >= settings.HEALTH_DISK_CRITICAL_PERCENT:
        severity = "crítico"
    elif used_percent >= settings.HEALTH_DISK_WARNING_PERCENT:
        severity = "advertencia"
    else:
        return
    _notify(
        "HEALTH_DISK_THRESHOLD",
        f"Alerta operativa: disco en nivel {severity}",
        f"El almacenamiento usado alcanza {used_percent}%. Revisa media, logs, backups y archivos temporales.",
        f"disk:{severity}:{datetime.now(dt_timezone.utc):%Y%m%d%H}",
    )


def _check_certificate() -> None:
    if not settings.MONITORING_TLS_HOST:
        return
    try:
        context = ssl.create_default_context()
        with socket.create_connection(
            (settings.MONITORING_TLS_HOST, settings.MONITORING_TLS_PORT), timeout=5
        ) as raw_socket:
            with context.wrap_socket(raw_socket, server_hostname=settings.MONITORING_TLS_HOST) as tls_socket:
                certificate = tls_socket.getpeercert()
        expires_at = datetime.strptime(certificate["notAfter"], "%b %d %H:%M:%S %Y %Z").replace(
            tzinfo=dt_timezone.utc
        )
        remaining_days = (expires_at - datetime.now(dt_timezone.utc)).days
    except Exception:
        _notify(
            "HEALTH_TLS_UNAVAILABLE",
            "Alerta operativa: no se pudo verificar TLS",
            "La verificación automática del certificado TLS no pudo completarse.",
            f"tls-unavailable:{datetime.now(dt_timezone.utc):%Y%m%d%H}",
        )
        return

    if remaining_days < 30:
        _notify(
            "HEALTH_TLS_EXPIRING",
            "Alerta operativa: certificado TLS próximo a vencer",
            f"El certificado de {settings.MONITORING_TLS_HOST} vence en {max(remaining_days, 0)} días.",
            f"tls-expiring:{expires_at:%Y%m%d}",
        )


def evaluate_operational_health() -> None:
    """Check critical dependencies every 15 minutes from Celery Beat."""
    _check_dependency("PostgreSQL", database_probe)
    _check_dependency("Redis", redis_probe)
    _check_dependency("Celery", celery_probe)
    _check_disk()
    _check_certificate()
