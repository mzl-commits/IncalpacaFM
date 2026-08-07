from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import AccountProfile
from apps.incidents.models import Incident
from apps.workorders.models import WorkOrder


class LinkedCorrectionOrderTests(TestCase):
    def setUp(self):
        users = get_user_model()
        self.admin = users.objects.create_user(username="admin", email="admin@example.com")
        AccountProfile.objects.create(
            user=self.admin,
            worker_code="ADMIN-01",
            role=AccountProfile.Role.ADMIN,
            must_change_password=False,
        )
        self.technician = users.objects.create_user(username="tecnico", email="tecnico@example.com")
        AccountProfile.objects.create(
            user=self.technician,
            worker_code="TEC-01",
            role=AccountProfile.Role.TECHNICIAN,
            must_change_password=False,
        )
        self.supervisor = users.objects.create_user(username="supervisor", email="supervisor@example.com")
        AccountProfile.objects.create(
            user=self.supervisor,
            worker_code="SUP-01",
            role=AccountProfile.Role.SUPERVISOR,
            must_change_password=False,
        )
        self.requester = users.objects.create_user(username="solicitante", email="solicitante@example.com")
        AccountProfile.objects.create(
            user=self.requester,
            worker_code="SOL-01",
            role=AccountProfile.Role.REQUESTER,
            must_change_password=False,
        )
        self.incident = Incident.objects.create(
            code="SOL-2026-9001",
            requester=self.requester,
            request_type="MANTENIMIENTO",
            description="Revisar mobiliario observado.",
            requester_priority="MEDIA",
            location_snapshot={"zone": "Zona", "building": "Edificio", "area": "Area", "room": "Ambiente"},
            status=Incident.Status.IN_PROGRESS,
        )
        self.order = WorkOrder.objects.create(
            code="OT-2026-9001",
            incident=self.incident,
            technician=self.technician,
            supervisor=self.supervisor,
            specialty="CARPINTERIA",
            admin_priority="MEDIA",
            status=WorkOrder.Status.ADMIN_REVIEW,
            scheduled_date=timezone.localdate(),
            scheduled_start_time="08:00",
            planned_hours=2,
            progress_percentage=100,
            supervisor_validation={"approved": True, "comment": "Conforme por supervisor"},
            created_by=self.admin,
        )
        self.client = APIClient()
        self.client.force_authenticate(self.admin)

    def test_admin_correction_creates_linked_work_order(self):
        returned = self.client.post(
            f"/api/v1/work-orders/{self.order.id}/actions/",
            {"action": "ADMIN_RETURN", "payload": {"comment": "Falta corregir acabado."}},
            format="json",
        )
        self.assertEqual(returned.status_code, 200, returned.json())

        scheduled = self.client.post(
            f"/api/v1/work-orders/{self.order.id}/actions/",
            {
                "action": "RESCHEDULE_CORRECTION",
                "payload": {
                    "scheduledDate": timezone.localdate().isoformat(),
                    "scheduledStartTime": "10:00",
                    "plannedHours": 1,
                    "administratorNotes": "Corregir acabado indicado.",
                },
            },
            format="json",
        )
        self.assertEqual(scheduled.status_code, 200, scheduled.json())
        self.order.refresh_from_db()
        correction = self.order.correction_orders.get()

        self.assertEqual(correction.correction_of, self.order)
        self.assertEqual(correction.code, "OT-2026-9001-C1")
        self.assertEqual(correction.incident, self.incident)
        self.assertEqual(correction.status, WorkOrder.Status.SCHEDULED)
        self.assertEqual(correction.progress_percentage, 0)
        self.assertEqual(self.incident.work_order, correction)
        self.assertEqual(scheduled.json()["correctionWorkOrderId"], str(correction.id))
        self.assertEqual(scheduled.json()["correctionWorkOrderCode"], correction.code)

        detail = self.client.get(f"/api/v1/work-orders/{correction.id}/")
        self.assertEqual(detail.status_code, 200, detail.json())
        self.assertEqual(detail.json()["correctionOfId"], str(self.order.id))
        self.assertEqual(detail.json()["correctionOfCode"], self.order.code)