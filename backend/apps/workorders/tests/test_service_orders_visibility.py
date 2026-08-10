from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import AccountProfile
from apps.incidents.models import Incident
from apps.workorders.models import WorkOrder


class ServiceOrderVisibilityTests(TestCase):
    def setUp(self):
        users = get_user_model()
        self.admin = users.objects.create_user(username="admin-os", email="admin-os@example.com")
        AccountProfile.objects.create(
            user=self.admin,
            worker_code="ADMIN-OS",
            role=AccountProfile.Role.ADMIN,
            must_change_password=False,
        )
        self.technician = users.objects.create_user(username="tecnico-os", email="tecnico-os@example.com")
        AccountProfile.objects.create(
            user=self.technician,
            worker_code="TEC-OS",
            role=AccountProfile.Role.TECHNICIAN,
            must_change_password=False,
        )
        self.supervisor = users.objects.create_user(username="supervisor-os", email="supervisor-os@example.com")
        AccountProfile.objects.create(
            user=self.supervisor,
            worker_code="SUP-OS",
            role=AccountProfile.Role.SUPERVISOR,
            must_change_password=False,
        )
        self.requester = users.objects.create_user(username="solicitante-os", email="solicitante-os@example.com")
        AccountProfile.objects.create(
            user=self.requester,
            worker_code="SOL-OS",
            role=AccountProfile.Role.REQUESTER,
            must_change_password=False,
        )
        self.incident = Incident.objects.create(
            code="SOL-2026-9100",
            requester=self.requester,
            request_type="MANTENIMIENTO",
            description="Solicitud de prueba para visibilidad.",
            requester_priority="MEDIA",
            location_snapshot={"zone": "Zona", "building": "Edificio", "area": "Area", "room": "Ambiente"},
            status=Incident.Status.IN_PROGRESS,
        )
        common = {
            "incident": self.incident,
            "technician": self.technician,
            "supervisor": self.supervisor,
            "admin_priority": "MEDIA",
            "scheduled_date": timezone.localdate(),
            "scheduled_start_time": "08:00",
            "planned_hours": 1,
            "created_by": self.admin,
        }
        self.work_order = WorkOrder.objects.create(
            code="OT-2026-9100",
            order_type=WorkOrder.OrderType.WORK,
            specialty="MANTENIMIENTO",
            **common,
        )
        self.cleaning_order = WorkOrder.objects.create(
            code="OL-2026-9100",
            order_type=WorkOrder.OrderType.CLEANING,
            specialty="LIMPIEZA",
            **common,
        )
        self.service_order = WorkOrder.objects.create(
            code="OS-2026-9100",
            order_type=WorkOrder.OrderType.SERVICE,
            specialty="SERVICIO EXTERNO",
            **common,
        )
        self.client = APIClient()

    def list_codes_as(self, user):
        self.client.force_authenticate(user)
        response = self.client.get("/api/v1/work-orders/")
        self.assertEqual(response.status_code, 200, response.json())
        return {item["code"] for item in response.json()}

    def test_service_orders_are_only_visible_to_admin_list(self):
        admin_codes = self.list_codes_as(self.admin)
        self.assertIn(self.service_order.code, admin_codes)

        technician_codes = self.list_codes_as(self.technician)
        self.assertIn(self.work_order.code, technician_codes)
        self.assertIn(self.cleaning_order.code, technician_codes)
        self.assertNotIn(self.service_order.code, technician_codes)

        supervisor_codes = self.list_codes_as(self.supervisor)
        self.assertIn(self.work_order.code, supervisor_codes)
        self.assertIn(self.cleaning_order.code, supervisor_codes)
        self.assertNotIn(self.service_order.code, supervisor_codes)

    def test_service_order_detail_is_not_available_to_technician_or_supervisor(self):
        for user in (self.technician, self.supervisor):
            self.client.force_authenticate(user)
            response = self.client.get(f"/api/v1/work-orders/{self.service_order.id}/")
            self.assertEqual(response.status_code, 404)
