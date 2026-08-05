from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.test import TestCase
from rest_framework.test import APIClient

from apps.assets.models import Location
from apps.audit.models import AuditEvent
from apps.notifications.models import Notification


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

    def test_administrator_can_manage_technician_profiles(self):
        administrator = get_user_model().objects.get(username="admin")
        self.client.force_authenticate(administrator)
        created = self.client.post(
            "/api/v1/technicians/",
            {
                "full_name": "Marco Flores",
                "worker_code": "TEC-MF-01",
                "email": "marco.flores@example.com",
                "specialty": "Soldador",
                "active": True,
                "temporary_password": "TemporalSegura3",
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201, created.json())
        self.assertEqual(created.json()["specialty"], "Soldador")

        updated = self.client.patch(
            f"/api/v1/technicians/{created.json()['id']}/",
            {"active": False},
            format="json",
        )
        self.assertEqual(updated.status_code, 200, updated.json())
        self.assertFalse(updated.json()["active"])

    def test_administrator_can_choose_manual_notification_channel(self):
        administrator = get_user_model().objects.get(username="admin")
        technician = get_user_model().objects.get(username="tecnico")
        self.client.force_authenticate(administrator)
        technician_id = technician.account_profile.id

        system_response = self.client.post(
            f"/api/v1/technicians/{technician_id}/notifications/",
            {"template": "REMINDER", "deliveryChannel": "SISTEMA"},
            format="json",
        )
        self.assertEqual(system_response.status_code, 201, system_response.json())
        system_notification = Notification.objects.get(event="TECHNICIAN_MANUAL_NOTIFICATION")
        self.assertEqual(system_notification.delivery_channel, Notification.DeliveryChannel.SYSTEM)
        self.assertEqual(system_notification.status, Notification.Status.SENT)

        email_response = self.client.post(
            f"/api/v1/technicians/{technician_id}/notifications/",
            {"template": "SCHEDULE", "deliveryChannel": "CORREO"},
            format="json",
        )
        self.assertEqual(email_response.status_code, 201, email_response.json())
        self.assertEqual(
            Notification.objects.filter(
                event="TECHNICIAN_MANUAL_NOTIFICATION",
                delivery_channel=Notification.DeliveryChannel.EMAIL,
            ).count(),
            1,
        )

        self.client.force_authenticate(technician)
        inbox = self.client.get("/api/v1/notifications/")
        self.assertEqual(inbox.status_code, 200, inbox.json())
        visible_ids = {item["id"] for item in inbox.json()}
        self.assertIn(str(system_notification.id), visible_ids)
        self.assertNotIn(
            str(Notification.objects.get(delivery_channel=Notification.DeliveryChannel.EMAIL).id),
            visible_ids,
        )

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
