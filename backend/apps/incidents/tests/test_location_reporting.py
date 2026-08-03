from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import AccountProfile
from apps.assets.models import Asset, Location
from apps.incidents.models import Incident
from apps.notifications.models import Notification


class IncidentLocationReportingTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(username="reporter", first_name="Ana", last_name="Ríos")
        AccountProfile.objects.create(user=self.user, worker_code="REPORTER-01", role=AccountProfile.Role.REQUESTER, must_change_password=False)
        planner = get_user_model().objects.create_user(
            username='planner-incidents', email='planner@incalpaca.test'
        )
        AccountProfile.objects.create(
            user=planner,
            worker_code='PLANNER-INCIDENTS',
            role=AccountProfile.Role.ADMIN,
            must_change_password=False,
        )
        self.location = Location.objects.create(zone="Zona Industrial", building="Edificio Administrativo", area="Facility Management", room="Oficina FM", location_code="AMB-FM")
        self.client = APIClient()
        self.client.force_authenticate(self.user)

    def test_incident_uses_canonical_location_instead_of_client_text(self):
        response = self.client.post("/api/v1/incidents/", {
            "locationId": str(self.location.id),
            "zone": "Texto alterado",
            "building": "Texto alterado",
            "area": "Texto alterado",
            "room": "Texto alterado",
            "requestType": "INSPECCION",
            "description": "Se detectó una filtración junto a la ventana principal.",
            "requesterPriority": "NORMAL",
            "project": False,
            "evidence": [],
            "status": "PENDIENTE",
        }, format="json")
        self.assertEqual(response.status_code, 201, response.json())
        self.assertEqual(response.json()["locationId"], str(self.location.id))
        self.assertEqual(response.json()["room"], "Oficina FM")
        self.assertEqual(response.json()["status"], "PENDIENTE")
        self.assertEqual(Notification.objects.filter(event='INCIDENT_CREATED').count(), 1)

    def test_rejects_unknown_location(self):
        response = self.client.post("/api/v1/incidents/", {
            "locationId": "00000000-0000-0000-0000-000000000000",
            "requestType": "INSPECCION",
            "description": "La ubicación no pertenece al catálogo oficial.",
            "requesterPriority": "NORMAL",
            "project": False,
            "evidence": [],
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("locationId", response.json())

    def test_list_tolerates_legacy_blank_location_markers(self):
        Incident.objects.create(
            code="SOL-2026-LEGACY",
            requester=self.user,
            request_type="INSPECCION",
            description="Registro heredado sin marcador dentro del ambiente.",
            location_snapshot={
                "locationId": str(self.location.id),
                "zone": self.location.zone,
                "building": self.location.building,
                "area": self.location.area,
                "room": self.location.room,
                "locationMapId": "",
                "locationMarkerX": "",
                "locationMarkerY": "",
            },
        )

        response = self.client.get("/api/v1/incidents/")

        self.assertEqual(response.status_code, 200, response.content)
        self.assertIsNone(response.json()[0]["locationMapId"])
        self.assertIsNone(response.json()[0]["locationMarkerX"])
        self.assertIsNone(response.json()[0]["locationMarkerY"])


class PublicIncidentReportingTests(TestCase):
    def setUp(self):
        owner = get_user_model().objects.create_user(username='asset-owner')
        self.location = Location.objects.create(
            zone='Zona Industrial', building='Administración',
            area='Facility Management', room='Oficina FM',
        )
        self.asset = Asset.objects.create(
            code='INC-BIEN-2026-009999',
            entry_type='purchase', name='Equipo público',
            description='Bien disponible mediante QR.', condition='Bueno',
            location=self.location, registered_by=owner,
        )
        self.client = APIClient()

    def test_anonymous_user_can_report_from_asset_qr(self):
        context = self.client.get(
            f'/api/v1/public/assets/{self.asset.public_token}/report/'
        )
        self.assertEqual(context.status_code, 200)
        self.assertEqual(context.json()['displayCode'], self.asset.code)

        response = self.client.post(
            f'/api/v1/public/assets/{self.asset.public_token}/report/',
            {
                'reporterName': 'Visitante de planta',
                'reporterEmail': 'visitante@example.com',
                'requestType': 'FALLA',
                'requesterPriority': 'ALTA',
                'description': 'El equipo emite un ruido inusual al encender.',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.json())
        incident = Incident.objects.get(pk=response.json()['id'])
        self.assertEqual(incident.asset, self.asset)
        self.assertTrue(incident.public_submission)
        self.assertEqual(incident.reporter_name, 'Visitante de planta')
        self.assertEqual(incident.location_snapshot['room'], 'Oficina FM')

        tracking = self.client.get(
            f'/api/v1/public/assets/{self.asset.public_token}/'
        )
        self.assertEqual(tracking.status_code, 200)
        self.assertEqual(
            tracking.json()['service_tracking']['current_stage'],
            'received',
        )

        incident.status = Incident.Status.CLOSED
        incident.save(update_fields=['status', 'updated_at'])
        completed = self.client.get(
            f'/api/v1/public/assets/{self.asset.public_token}/'
        )
        self.assertIsNone(completed.json()['service_tracking'])
