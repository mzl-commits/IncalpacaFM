from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import AccountProfile
from apps.assets.models import Location
from apps.catalogo.models import Almacen, Categoria, Subcategoria, Material
from apps.incidents.models import Incident
from apps.inventario.models import GrupoSolicitud, SolicitudMovimiento
from apps.workorders.models import WorkOrder

User = get_user_model()


class GrupoSolicitudEstadoTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="almacenero1", password="password123")
        AccountProfile.objects.create(user=self.user, role=AccountProfile.Role.ALMACENERO, worker_code="ALM-001")
        self.almacen = Almacen.objects.create(nombre="Almacén Test", codigo="ALM-TEST")
        self.categoria = Categoria.objects.create(almacen=self.almacen, nombre="Cat Test", prefijo="CT")
        self.subcategoria = Subcategoria.objects.create(categoria=self.categoria, nombre="Subcat Test")
        self.mat1 = Material.objects.create(subcategoria=self.subcategoria, almacen=self.almacen, nombre="Material 1")
        self.mat2 = Material.objects.create(subcategoria=self.subcategoria, almacen=self.almacen, nombre="Material 2")

    def test_estado_pendiente(self):
        grupo = GrupoSolicitud.objects.create(solicitado_por=self.user)
        SolicitudMovimiento.objects.create(
            grupo=grupo,
            tipo=SolicitudMovimiento.Tipo.SALIDA_MATERIAL,
            material=self.mat1,
            cantidad=1,
            solicitado_por=self.user,
            estado=SolicitudMovimiento.Estado.PENDIENTE,
        )
        SolicitudMovimiento.objects.create(
            grupo=grupo,
            tipo=SolicitudMovimiento.Tipo.SALIDA_MATERIAL,
            material=self.mat2,
            cantidad=1,
            solicitado_por=self.user,
            estado=SolicitudMovimiento.Estado.PENDIENTE,
        )
        self.assertEqual(grupo.estado, "pendiente")

    def test_estado_aprobada(self):
        grupo = GrupoSolicitud.objects.create(solicitado_por=self.user)
        SolicitudMovimiento.objects.create(
            grupo=grupo,
            tipo=SolicitudMovimiento.Tipo.SALIDA_MATERIAL,
            material=self.mat1,
            cantidad=1,
            solicitado_por=self.user,
            estado=SolicitudMovimiento.Estado.APROBADA,
        )
        SolicitudMovimiento.objects.create(
            grupo=grupo,
            tipo=SolicitudMovimiento.Tipo.SALIDA_MATERIAL,
            material=self.mat2,
            cantidad=1,
            solicitado_por=self.user,
            estado=SolicitudMovimiento.Estado.APROBADA,
        )
        self.assertEqual(grupo.estado, "aprobada")

    def test_estado_rechazada(self):
        grupo = GrupoSolicitud.objects.create(solicitado_por=self.user)
        SolicitudMovimiento.objects.create(
            grupo=grupo,
            tipo=SolicitudMovimiento.Tipo.SALIDA_MATERIAL,
            material=self.mat1,
            cantidad=1,
            solicitado_por=self.user,
            estado=SolicitudMovimiento.Estado.RECHAZADA,
        )
        SolicitudMovimiento.objects.create(
            grupo=grupo,
            tipo=SolicitudMovimiento.Tipo.SALIDA_MATERIAL,
            material=self.mat2,
            cantidad=1,
            solicitado_por=self.user,
            estado=SolicitudMovimiento.Estado.RECHAZADA,
        )
        self.assertEqual(grupo.estado, "rechazada")

    def test_estado_parcial_un_aprobado_un_rechazado(self):
        grupo = GrupoSolicitud.objects.create(solicitado_por=self.user)
        SolicitudMovimiento.objects.create(
            grupo=grupo,
            tipo=SolicitudMovimiento.Tipo.SALIDA_MATERIAL,
            material=self.mat1,
            cantidad=1,
            solicitado_por=self.user,
            estado=SolicitudMovimiento.Estado.APROBADA,
        )
        SolicitudMovimiento.objects.create(
            grupo=grupo,
            tipo=SolicitudMovimiento.Tipo.SALIDA_MATERIAL,
            material=self.mat2,
            cantidad=1,
            solicitado_por=self.user,
            estado=SolicitudMovimiento.Estado.RECHAZADA,
        )
        self.assertEqual(grupo.estado, "parcial")


class WorkOrderActivasViewTest(TestCase):
    def setUp(self):
        self.admin = User.objects.create_superuser(username="admin1", password="password123", email="admin@test.com")
        AccountProfile.objects.create(user=self.admin, role=AccountProfile.Role.ADMIN, worker_code="ADM-001")
        self.tech = User.objects.create_user(username="tech1", password="password123")
        AccountProfile.objects.create(user=self.tech, role=AccountProfile.Role.TECHNICIAN, worker_code="TEC-001")
        self.supervisor = User.objects.create_user(username="sup1", password="password123")
        AccountProfile.objects.create(user=self.supervisor, role=AccountProfile.Role.SUPERVISOR, worker_code="SUP-001")
        self.location = Location.objects.create(zone="Z", building="B", area="A", room="R")
        self.incident = Incident.objects.create(code="INC-001", requester=self.admin, request_type="OT", description="Desc")

    def test_ots_activas_excludes_finished_and_cancelled_statuses(self):
        WorkOrder.objects.create(
            code="OT-PROG",
            incident=self.incident,
            technician=self.tech,
            supervisor=self.supervisor,
            created_by=self.admin,
            scheduled_date="2026-08-28",
            status=WorkOrder.Status.SCHEDULED,
        )
        WorkOrder.objects.create(
            code="OT-PROC",
            incident=self.incident,
            technician=self.tech,
            supervisor=self.supervisor,
            created_by=self.admin,
            scheduled_date="2026-08-28",
            status=WorkOrder.Status.IN_PROGRESS,
        )
        WorkOrder.objects.create(
            code="OT-DEV",
            incident=self.incident,
            technician=self.tech,
            supervisor=self.supervisor,
            created_by=self.admin,
            scheduled_date="2026-08-28",
            status=WorkOrder.Status.RETURNED,
        )

        WorkOrder.objects.create(
            code="OT-SUP",
            incident=self.incident,
            technician=self.tech,
            supervisor=self.supervisor,
            created_by=self.admin,
            scheduled_date="2026-08-28",
            status=WorkOrder.Status.SUPERVISION,
        )
        WorkOrder.objects.create(
            code="OT-VAL",
            incident=self.incident,
            technician=self.tech,
            supervisor=self.supervisor,
            created_by=self.admin,
            scheduled_date="2026-08-28",
            status=WorkOrder.Status.ADMIN_REVIEW,
        )
        WorkOrder.objects.create(
            code="OT-CONF",
            incident=self.incident,
            technician=self.tech,
            supervisor=self.supervisor,
            created_by=self.admin,
            scheduled_date="2026-08-28",
            status=WorkOrder.Status.CONFORMITY,
        )
        WorkOrder.objects.create(
            code="OT-CLOS",
            incident=self.incident,
            technician=self.tech,
            supervisor=self.supervisor,
            created_by=self.admin,
            scheduled_date="2026-08-28",
            status=WorkOrder.Status.CLOSED,
        )
        WorkOrder.objects.create(
            code="OT-CANC",
            incident=self.incident,
            technician=self.tech,
            supervisor=self.supervisor,
            created_by=self.admin,
            scheduled_date="2026-08-28",
            status=WorkOrder.Status.CANCELLED,
        )

        client = APIClient()
        client.force_authenticate(user=self.admin)
        response = client.get("/api/v1/ots-activas/")
        self.assertEqual(response.status_code, 200)
        codes = [item["code"] for item in response.data]
        self.assertIn("OT-PROG", codes)
        self.assertIn("OT-PROC", codes)
        self.assertIn("OT-DEV", codes)
        self.assertNotIn("OT-SUP", codes)
        self.assertNotIn("OT-VAL", codes)
        self.assertNotIn("OT-CONF", codes)
        self.assertNotIn("OT-CLOS", codes)
        self.assertNotIn("OT-CANC", codes)
