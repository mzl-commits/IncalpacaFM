from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import AccountProfile
from apps.incidents.models import Incident
from apps.workorders.models import WorkOrder

from ..models import Notification
from ..monitoring import queue_work_order_alerts


class WorkOrderAlertTests(TestCase):
    def setUp(self):
        user_model = get_user_model()
        self.technician = user_model.objects.create_user(
            username="alert-technician", email="technician-alert@example.com"
        )
        self.administrator = user_model.objects.create_user(
            username="alert-administrator", email="administrator-alert@example.com"
        )
        self.requester = user_model.objects.create_user(username="alert-requester")
        AccountProfile.objects.create(
            user=self.technician,
            worker_code="ALERT-TECHNICIAN",
            role=AccountProfile.Role.TECHNICIAN,
            must_change_password=False,
        )
        AccountProfile.objects.create(
            user=self.administrator,
            worker_code="ALERT-ADMINISTRATOR",
            role=AccountProfile.Role.ADMIN,
            must_change_password=False,
        )
        AccountProfile.objects.create(
            user=self.requester,
            worker_code="ALERT-REQUESTER",
            role=AccountProfile.Role.REQUESTER,
            must_change_password=False,
        )

    def create_order(self, *, code, scheduled_date, planned_hours=1, work_sessions=None, advances=None, status=None):
        incident = Incident.objects.create(
            code=f"INC-{code}",
            requester=self.requester,
            request_type="FALLA",
            description="Incidencia creada para verificar alertas operativas.",
        )
        return WorkOrder.objects.create(
            code=code,
            incident=incident,
            technician=self.technician,
            supervisor=self.administrator,
            specialty="Mantenimiento",
            admin_priority="MEDIA",
            scheduled_date=scheduled_date,
            planned_hours=planned_hours,
            work_sessions=work_sessions or [],
            advances=advances or [],
            status=status or WorkOrder.Status.SCHEDULED,
            created_by=self.administrator,
        )

    def test_time_exceeded_notifies_technician_and_administrator_once(self):
        now = timezone.now()
        order = self.create_order(
            code="OT-ALERT-TIME",
            scheduled_date=timezone.localdate(),
            work_sessions=[{
                "startAt": (now - timedelta(hours=2)).isoformat(),
                "endAt": now.isoformat(),
            }],
        )

        queue_work_order_alerts(order)
        queue_work_order_alerts(order)

        alerts = Notification.objects.filter(event="WORK_ORDER_TIME_EXCEEDED")
        self.assertEqual(alerts.count(), 2)
        self.assertSetEqual(
            set(alerts.values_list("recipient", flat=True)),
            {self.technician.id, self.administrator.id},
        )

    def test_missing_traceability_notifies_technician_and_administrator(self):
        order = self.create_order(
            code="OT-ALERT-TRACE",
            scheduled_date=timezone.localdate() - timedelta(days=1),
        )

        queue_work_order_alerts(order)

        self.assertEqual(
            Notification.objects.filter(event="WORK_ORDER_TRACEABILITY_PENDING").count(),
            2,
        )

    def test_closed_order_never_generates_operational_alerts(self):
        order = self.create_order(
            code="OT-ALERT-CLOSED",
            scheduled_date=timezone.localdate() - timedelta(days=1),
            status=WorkOrder.Status.CLOSED,
        )

        queue_work_order_alerts(order)

        self.assertFalse(Notification.objects.exists())
