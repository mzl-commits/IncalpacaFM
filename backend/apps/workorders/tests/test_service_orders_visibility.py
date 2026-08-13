from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import AccountProfile
from apps.catalogo.models import Categoria, Material, Subcategoria
from apps.incidents.models import Incident
from apps.workorders.models import WorkOrder, WorkOrderCost, WorkOrderMaterial
from apps.workorders.reporting import _effective_minutes
from apps.workorders.serializers import effective_work_minutes


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

    def test_closed_order_does_not_accumulate_an_unclosed_legacy_session(self):
        started_at = timezone.now() - timedelta(hours=2)
        finished_at = started_at + timedelta(minutes=35)
        self.work_order.status = WorkOrder.Status.CLOSED
        self.work_order.finished_at = finished_at
        self.work_order.closed_at = finished_at
        self.work_order.work_sessions = [{"startAt": started_at.isoformat(), "endAt": None}]
        self.work_order.save(
            update_fields=("status", "finished_at", "closed_at", "work_sessions", "updated_at")
        )

        self.assertEqual(effective_work_minutes(self.work_order), 35)
        self.assertEqual(_effective_minutes(self.work_order), 35)

    def test_material_sync_calculates_quantity_times_unit_price_and_is_idempotent(self):
        category = Categoria.objects.create(nombre="Consumibles de prueba", prefijo="CP")
        subcategory = Subcategoria.objects.create(categoria=category, nombre="Eléctricos")
        material = Material.objects.create(
            subcategoria=subcategory,
            codigo="CP-001",
            nombre="Cable de prueba",
            precio="12.50",
            tipo_control="no_retornable",
            cantidad_total=50,
        )
        first_use = WorkOrderMaterial.objects.create(
            work_order=self.work_order,
            material=material,
            cantidad=2,
            tipo=WorkOrderMaterial.Tipo.USADO,
            registrado_por=self.technician,
        )
        WorkOrderMaterial.objects.create(
            work_order=self.work_order,
            material=material,
            cantidad=3,
            tipo=WorkOrderMaterial.Tipo.USADO,
            registrado_por=self.technician,
        )
        self.client.force_authenticate(self.admin)
        url = f"/api/v1/work-orders/{self.work_order.id}/costs/autocompletar-materiales/"

        created = self.client.post(url, {}, format="json")
        self.assertEqual(created.status_code, 201, created.json())
        self.assertEqual(created.json()["created"], 1)
        self.assertEqual(created.json()["materials"], 1)
        self.assertEqual(str(WorkOrderCost.objects.get(work_order=self.work_order, category="MATERIAL").amount), "62.50")

        first_use.cantidad = 4
        first_use.save(update_fields=("cantidad",))
        updated = self.client.post(url, {}, format="json")
        self.assertEqual(updated.status_code, 200, updated.json())
        self.assertEqual(updated.json()["updated"], 1)
        self.assertEqual(str(WorkOrderCost.objects.get(work_order=self.work_order, category="MATERIAL").amount), "87.50")

    def test_reusable_tool_or_epp_usage_is_not_included_in_material_costs(self):
        category = Categoria.objects.create(nombre="EPP de prueba", prefijo="EP")
        subcategory = Subcategoria.objects.create(categoria=category, nombre="ProtecciÃ³n")
        harness = Material.objects.create(
            subcategoria=subcategory,
            codigo="EP-001",
            nombre="ArnÃ©s de seguridad",
            precio="210.00",
            clasificacion_operativa="EPP",
            tipo_control="retornable",
            cantidad_total=3,
        )
        WorkOrderMaterial.objects.create(
            work_order=self.work_order,
            material=harness,
            cantidad=1,
            tipo=WorkOrderMaterial.Tipo.USADO,
            registrado_por=self.technician,
        )

        self.client.force_authenticate(self.admin)
        response = self.client.post(
            f"/api/v1/work-orders/{self.work_order.id}/costs/autocompletar-materiales/",
            {},
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.json())
        self.assertEqual(response.json()["materials"], 0)
        self.assertFalse(WorkOrderCost.objects.filter(work_order=self.work_order, category="MATERIAL").exists())

    def test_material_cost_is_synced_when_technician_registers_and_edits_usage(self):
        category = Categoria.objects.create(nombre="Consumibles automÃ¡ticos", prefijo="CA")
        subcategory = Subcategoria.objects.create(categoria=category, nombre="ElÃ©ctricos")
        cable = Material.objects.create(
            subcategoria=subcategory,
            codigo="CA-001",
            nombre="Cable automÃ¡tico",
            precio="8.00",
            clasificacion_operativa="CONSUMIBLE",
            tipo_control="no_retornable",
            cantidad_total=20,
        )
        self.client.force_authenticate(self.technician)
        response = self.client.post(
            f"/api/v1/work-orders/{self.work_order.id}/materiales/",
            {"material": cable.id, "cantidad": 2, "tipo": "USADO"},
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.json())
        cost = WorkOrderCost.objects.get(work_order=self.work_order, source_material=cable)
        self.assertEqual(str(cost.amount), "16.00")

        response = self.client.patch(
            f"/api/v1/work-orders/{self.work_order.id}/materiales/{response.json()['id']}/",
            {"cantidad": 3, "precioUnitario": "10.00"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.json())
        cost.refresh_from_db()
        self.assertEqual(str(cost.amount), "30.00")

    def test_technician_cannot_access_materials_from_another_work_order(self):
        users = get_user_model()
        other_technician = users.objects.create_user(username="tecnico-ajeno")
        AccountProfile.objects.create(
            user=other_technician,
            worker_code="TEC-AJENO",
            role=AccountProfile.Role.TECHNICIAN,
            must_change_password=False,
        )
        other_supervisor = users.objects.create_user(username="supervisor-ajeno")
        AccountProfile.objects.create(
            user=other_supervisor,
            worker_code="SUP-AJENO",
            role=AccountProfile.Role.SUPERVISOR,
            must_change_password=False,
        )
        other_incident = Incident.objects.create(
            code="SOL-2026-9101",
            requester=self.requester,
            request_type="MANTENIMIENTO",
            description="Solicitud aislada para validar materiales.",
            requester_priority="MEDIA",
            location_snapshot={"zone": "Zona", "building": "Edificio", "area": "Area", "room": "Ambiente"},
            status=Incident.Status.IN_PROGRESS,
        )
        other_order = WorkOrder.objects.create(
            code="OT-2026-9101",
            incident=other_incident,
            technician=other_technician,
            supervisor=other_supervisor,
            specialty="MANTENIMIENTO",
            admin_priority="MEDIA",
            scheduled_date=timezone.localdate(),
            scheduled_start_time="08:00",
            planned_hours=1,
            created_by=self.admin,
        )
        category = Categoria.objects.create(nombre="Aislamiento de materiales", prefijo="AM")
        subcategory = Subcategoria.objects.create(categoria=category, nombre="Consumibles")
        material = Material.objects.create(
            subcategoria=subcategory,
            codigo="AM-001",
            nombre="Material aislado",
            tipo_control="no_retornable",
            cantidad_total=10,
        )
        foreign_use = WorkOrderMaterial.objects.create(
            work_order=other_order,
            material=material,
            cantidad=1,
            tipo=WorkOrderMaterial.Tipo.NECESARIO_NO_BLOQUEANTE,
            registrado_por=other_technician,
        )

        self.client.force_authenticate(self.technician)
        detail_url = f"/api/v1/work-orders/{other_order.id}/materiales/{foreign_use.id}/"
        blocking_url = f"{detail_url}marcar-bloqueante/"

        self.assertEqual(self.client.get(detail_url).status_code, 404)
        self.assertEqual(self.client.patch(detail_url, {"cantidad": 2}, format="json").status_code, 404)
        self.assertEqual(self.client.post(blocking_url, {}, format="json").status_code, 404)
        foreign_use.refresh_from_db()
        self.assertFalse(foreign_use.es_bloqueante)

    def test_assigned_supervisor_can_approve_an_order_pending_supervision(self):
        self.work_order.status = WorkOrder.Status.SUPERVISION
        self.work_order.progress_percentage = 100
        self.work_order.save(update_fields=("status", "progress_percentage"))
        self.client.force_authenticate(self.supervisor)

        response = self.client.post(
            f"/api/v1/work-orders/{self.work_order.id}/actions/",
            {"action": "SUPERVISOR_APPROVE", "payload": {"comment": "Trabajo verificado conforme."}},
            format="json",
        )

        self.assertEqual(response.status_code, 200, response.json())
        self.work_order.refresh_from_db()
        self.assertEqual(self.work_order.status, WorkOrder.Status.ADMIN_REVIEW)
        self.assertTrue(self.work_order.supervisor_validation["approved"])
