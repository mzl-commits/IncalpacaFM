from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import AccountProfile
from apps.assets.models import Location
from apps.incidents.models import Incident
from apps.workorders.models import WorkOrder


class WorkOrderScheduleConflictTests(TestCase):
    def setUp(self):
        users = get_user_model()
        self.admin = users.objects.create_user(username="admin-schedule", email="admin-schedule@example.com")
        AccountProfile.objects.create(
            user=self.admin,
            worker_code="ADMIN-SCHEDULE",
            role=AccountProfile.Role.ADMIN,
            must_change_password=False,
        )
        self.technician = users.objects.create_user(username="tecnico-schedule", email="tecnico-schedule@example.com")
        AccountProfile.objects.create(
            user=self.technician,
            worker_code="TEC-SCHEDULE",
            role=AccountProfile.Role.TECHNICIAN,
            must_change_password=False,
        )
        self.supervisor = users.objects.create_user(username="supervisor", email="supervisor-schedule@example.com")
        AccountProfile.objects.create(
            user=self.supervisor,
            worker_code="supervisor",
            role=AccountProfile.Role.SUPERVISOR,
            must_change_password=False,
        )
        self.location = Location.objects.create(
            zone="Zona",
            building="Edificio",
            area="Area",
            room="Ambiente",
            location_code="SCH-001",
        )
        self.incident = Incident.objects.create(
            code="SOL-2026-9200",
            requester=self.admin,
            request_type="MANTENIMIENTO",
            description="Solicitud base",
            requester_priority="MEDIA",
            location_snapshot={"zone": "Zona", "building": "Edificio", "area": "Area", "room": "Ambiente"},
            status=Incident.Status.IN_PROGRESS,
        )
        self.existing_order = WorkOrder.objects.create(
            code="OT-2026-9200",
            incident=self.incident,
            technician=self.technician,
            supervisor=self.supervisor,
            specialty="CARPINTERIA",
            admin_priority="MEDIA",
            status=WorkOrder.Status.SCHEDULED,
            scheduled_date=timezone.localdate(),
            scheduled_start_time="08:00",
            planned_hours=2,
            created_by=self.admin,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_admin_cannot_create_order_when_technician_has_overlapping_schedule(self):
        response = self.client.post(
            "/api/v1/work-orders/",
            {
                "orderType": "OT",
                "directRequestDescription": "Nueva orden cruzada",
                "directRequestType": "OT directa",
                "directLocationId": str(self.location.id),
                "technicianWorkerCode": "TEC-SCHEDULE",
                "specialty": "CARPINTERIA",
                "adminPriority": "MEDIA",
                "scheduledDate": timezone.localdate().isoformat(),
                "scheduledStartTime": "09:00",
                "plannedHours": 1,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("scheduledStartTime", response.json())
