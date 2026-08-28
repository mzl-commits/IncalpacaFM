from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status as http_status

from apps.catalogo.models import Almacen, Material
from apps.inventario.models import GrupoSolicitud, SolicitudMovimiento
from apps.workorders.models import WorkOrder, WorkOrderMaterial
from apps.incidents.models import Incident
from apps.accounts.models import AccountProfile

User = get_user_model()


class CantidadComprometidaTestCase(TestCase):
    def setUp(self):
        self.almacenero = User.objects.create_user(username="almacenero1", password="x")
        AccountProfile.objects.create(user=self.almacenero, role=AccountProfile.Role.ALMACENERO)

        self.admin = User.objects.create_user(username="admin1", password="x")
        AccountProfile.objects.create(user=self.admin, role=AccountProfile.Role.ADMIN)

        self.tecnico = User.objects.create_user(username="tecnico1", password="x")
        self.supervisor = User.objects.create_user(username="supervisor1", password="x")

        self.almacen = Almacen.objects.create(nombre="Almacén Test")
        self.material = Material.objects.create(
            nombre="Llave Stilson", codigo="AC9999", almacen=self.almacen,
        )

        incident = Incident.objects.create(
            title="Fuga en tubería",
            description="Prueba",
        )

        self.work_order = WorkOrder.objects.create(
            code="OT-TEST-0001",
            incident=incident,
            technician=self.tecnico,
            supervisor=self.supervisor,
            specialty="Plomería",
            admin_priority="alta",
            scheduled_date=timezone.now().date(),
            created_by=self.admin,
        )

        self.wm = WorkOrderMaterial.objects.create(
            work_order=self.work_order,
            material=self.material,
            cantidad=3,
            tipo=WorkOrderMaterial.Tipo.USADO,
            registrado_por=self.tecnico,
        )

        self.client = APIClient()

    def _cantidad_pendiente(self, wm):
        """Reimplementa la fórmula documentada en el help_text del modelo."""
        wm.refresh_from_db()
        return wm.cantidad - wm.cantidad_comprometida

    def test_solicitar_todo_lo_planificado_deja_pendiente_en_cero(self):
        """Bug original: cantidad_comprometida nunca se actualizaba, por lo
        que 'Cargar materiales de la OT' seguía ofreciendo el material
        completo aunque ya se hubiera solicitado todo."""
        self.assertEqual(self._cantidad_pendiente(self.wm), 3)

        self.client.force_authenticate(user=self.almacenero)
        resp = self.client.post(
            "/api/inventario/grupos-solicitud/",
            {
                "work_order": str(self.work_order.id),
                "items": [
                    {
                        "tipo": "salida_material",
                        "material": self.material.id,
                        "cantidad": 3,
                        "work_order_material": str(self.wm.id),
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, http_status.HTTP_201_CREATED, resp.data)

        # Antes del fix, esto daba 3 (nunca se actualizaba). Con el fix, 0.
        self.assertEqual(self._cantidad_pendiente(self.wm), 0)

        sol = SolicitudMovimiento.objects.get(grupo__work_order=self.work_order)
        self.assertEqual(sol.work_order_material_id, self.wm.id)

    def test_no_permite_comprometer_mas_de_lo_planificado(self):
        self.client.force_authenticate(user=self.almacenero)
        resp = self.client.post(
            "/api/inventario/grupos-solicitud/",
            {
                "work_order": str(self.work_order.id),
                "items": [
                    {
                        "tipo": "salida_material",
                        "material": self.material.id,
                        "cantidad": 5,  # más que los 3 planificados
                        "work_order_material": str(self.wm.id),
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, http_status.HTTP_400_BAD_REQUEST, resp.data)
        # El grupo entero debe haber hecho rollback: no debe existir ninguna
        # SolicitudMovimiento ni GrupoSolicitud huérfanos.
        self.assertEqual(GrupoSolicitud.objects.count(), 0)
        self.assertEqual(SolicitudMovimiento.objects.count(), 0)
        self.assertEqual(self._cantidad_pendiente(self.wm), 3)

    def test_rechazar_libera_el_cupo_comprometido(self):
        self.client.force_authenticate(user=self.almacenero)
        resp = self.client.post(
            "/api/inventario/grupos-solicitud/",
            {
                "work_order": str(self.work_order.id),
                "items": [
                    {
                        "tipo": "salida_material",
                        "material": self.material.id,
                        "cantidad": 3,
                        "work_order_material": str(self.wm.id),
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, http_status.HTTP_201_CREATED, resp.data)
        self.assertEqual(self._cantidad_pendiente(self.wm), 0)

        sol = SolicitudMovimiento.objects.get(grupo__work_order=self.work_order)

        self.client.force_authenticate(user=self.admin)
        resp = self.client.post(f"/api/inventario/solicitudes-movimiento/{sol.id}/rechazar/")
        self.assertEqual(resp.status_code, http_status.HTTP_200_OK, resp.data)

        # Al rechazar, el cupo vuelve a estar disponible.
        self.assertEqual(self._cantidad_pendiente(self.wm), 3)

    def test_aprobar_no_decrementa_lo_comprometido(self):
        """cantidad_comprometida representa 'ya resuelto de una forma u otra'
        (pendiente O aprobado), no solo 'pendiente de aprobar' — al aprobar
        debe permanecer en el mismo valor que al crear la solicitud."""
        self.client.force_authenticate(user=self.almacenero)
        resp = self.client.post(
            "/api/inventario/grupos-solicitud/",
            {
                "work_order": str(self.work_order.id),
                "items": [
                    {
                        "tipo": "salida_material",
                        "material": self.material.id,
                        "cantidad": 3,
                        "work_order_material": str(self.wm.id),
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, http_status.HTTP_201_CREATED, resp.data)
        sol = SolicitudMovimiento.objects.get(grupo__work_order=self.work_order)

        self.client.force_authenticate(user=self.admin)
        resp = self.client.post(f"/api/inventario/solicitudes-movimiento/{sol.id}/aprobar/")
        self.assertEqual(resp.status_code, http_status.HTTP_200_OK, resp.data)

        # Sigue en 0 pendiente: cantidad_comprometida no bajó al aprobar.
        self.assertEqual(self._cantidad_pendiente(self.wm), 0)
        self.wm.refresh_from_db()
        self.assertEqual(self.wm.cantidad_comprometida, 3)