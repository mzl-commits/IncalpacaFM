from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from apps.audit.models import AuditEvent
from apps.assets.models import Location


class AuthenticationAndRbacTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        call_command("seed_demo_data", verbosity=0)

    def setUp(self):
        self.client = APIClient()

    def test_demo_users_can_login_with_their_effective_role(self):
        for worker_code, password, role in (
            ("admin", "Montescoli3", "ADMINISTRADOR"),
            ("tecnico", "Montescoli3", "TECNICO"),
        ):
            response = self.client.post(
                "/api/v1/auth/login/",
                {"worker_code": worker_code, "password": password},
                format="json",
            )
            self.assertEqual(response.status_code, 200, response.json())
            self.assertEqual(response.json()["user"]["role"], role)
            self.assertNotIn("password", response.json()["user"])

    def test_technician_cannot_create_assets(self):
        technician = get_user_model().objects.get(username="tecnico")
        self.client.force_authenticate(technician)
        response = self.client.post("/api/v1/assets/", {}, format="json")
        self.assertEqual(response.status_code, 403)

    def test_incident_creation_uses_session_actor_and_audits(self):
        administrator = get_user_model().objects.get(username="admin")
        location = Location.objects.get(room="Taller eléctrico")
        self.client.force_authenticate(administrator)
        response = self.client.post(
            "/api/v1/incidents/",
            {
                "requestType": "INSPECCION",
                "description": "Incidencia creada para comprobar autoría y auditoría.",
                "requesterPriority": "MEDIA",
                "project": False,
                "locationId": str(location.id),
                "zone": "Zona Industrial",
                "building": "Planta Principal",
                "area": "Mantenimiento",
                "room": "Taller eléctrico",
                "evidence": [],
                "status": "RECIBIDA",
            },
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.json())
        self.assertEqual(response.json()["requesterName"], "Rosa Medina")
        self.assertTrue(
            AuditEvent.objects.filter(
                actor=administrator,
                action="INCIDENT_CREATED",
                entity_id=response.json()["id"],
            ).exists()
        )
