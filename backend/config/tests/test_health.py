from unittest.mock import patch

from django.test import TestCase, override_settings
from rest_framework.test import APIClient


class HealthEndpointTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_liveness_is_public_and_does_not_expose_dependencies(self):
        response = self.client.get("/api/v1/health/live/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    @override_settings(DEBUG=True)
    @patch("config.health.storage_probe", return_value=(True, "ok"))
    @patch("config.health.redis_probe", return_value=(True, "ok"))
    @patch("config.health.database_probe", return_value=(True, "ok"))
    def test_readiness_returns_components_when_every_dependency_is_available(
        self, database_probe, redis_probe, storage_probe
    ):
        response = self.client.get("/api/v1/health/ready/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "ok")
        self.assertEqual(response.json()["components"]["database"]["status"], "ok")

    @override_settings(DEBUG=True)
    @patch("config.health.storage_probe", return_value=(True, "ok"))
    @patch("config.health.redis_probe", return_value=(False, "unavailable"))
    @patch("config.health.database_probe", return_value=(True, "ok"))
    def test_readiness_returns_503_when_a_dependency_is_down(
        self, database_probe, redis_probe, storage_probe
    ):
        response = self.client.get("/api/v1/health/ready/")

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["components"]["redis"]["status"], "error")
