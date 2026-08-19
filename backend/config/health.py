"""Health probes for load balancers, monitoring and operational alerts.

Only the liveness probe is intentionally public. Readiness and Celery details
are restricted in production through a shared token or an authenticated
administrator, so dependency information is not exposed through the internet.
"""

import hmac
import shutil
from pathlib import Path

import redis
from celery import current_app
from django.conf import settings
from django.db import connection
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from drf_spectacular.utils import extend_schema

from apps.accounts.permissions import IsAdministrator
from .schema import CeleryHealthResponseSerializer, HealthReadyResponseSerializer, HealthResponseSerializer


def database_probe() -> tuple[bool, str]:
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
    except Exception:
        return False, "unavailable"
    return True, "ok"


def redis_probe() -> tuple[bool, str]:
    try:
        client = redis.Redis.from_url(settings.CELERY_BROKER_URL, socket_connect_timeout=2)
        client.ping()
    except Exception:
        return False, "unavailable"
    return True, "ok"


def storage_probe() -> tuple[bool, str]:
    try:
        media_root = Path(settings.MEDIA_ROOT)
        media_root.mkdir(parents=True, exist_ok=True)
        free_bytes = shutil.disk_usage(media_root).free
    except OSError:
        return False, "unavailable"
    return free_bytes > 0, "ok" if free_bytes > 0 else "full"


def celery_probe() -> tuple[bool, str]:
    try:
        workers = current_app.control.ping(timeout=2.0)
    except Exception:
        return False, "unavailable"
    return bool(workers), "ok" if workers else "unavailable"


def readiness_snapshot() -> dict[str, dict[str, str]]:
    checks = {
        "database": database_probe(),
        "redis": redis_probe(),
        "storage": storage_probe(),
    }
    return {
        name: {"status": detail if healthy else "error"}
        for name, (healthy, detail) in checks.items()
    }


class InternalHealthPermission(permissions.BasePermission):
    """Allows local development plus protected probes in non-debug environments."""

    message = "Se requiere autenticación administrativa o un token de monitoreo."

    def has_permission(self, request, view):
        if settings.DEBUG:
            return True
        expected_token = settings.HEALTH_CHECK_TOKEN
        provided_token = request.headers.get("X-Health-Token", "")
        if expected_token and hmac.compare_digest(provided_token, expected_token):
            return True
        return IsAdministrator().has_permission(request, view)


class LiveHealthView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(responses={200: HealthResponseSerializer})
    def get(self, request):
        return Response({"status": "ok"})


class ReadyHealthView(APIView):
    permission_classes = [InternalHealthPermission]

    @extend_schema(responses={200: HealthReadyResponseSerializer, 503: HealthReadyResponseSerializer})
    def get(self, request):
        components = readiness_snapshot()
        healthy = all(component["status"] == "ok" for component in components.values())
        return Response(
            {"status": "ok" if healthy else "degraded", "components": components},
            status=status.HTTP_200_OK if healthy else status.HTTP_503_SERVICE_UNAVAILABLE,
        )


class CeleryHealthView(APIView):
    permission_classes = [InternalHealthPermission]

    @extend_schema(responses={200: CeleryHealthResponseSerializer, 503: CeleryHealthResponseSerializer})
    def get(self, request):
        healthy, detail = celery_probe()
        return Response(
            {"status": detail, "component": "celery"},
            status=status.HTTP_200_OK if healthy else status.HTTP_503_SERVICE_UNAVAILABLE,
        )
