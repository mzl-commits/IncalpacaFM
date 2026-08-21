from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from datetime import date
from apps.accounts.models import AccountProfile
from apps.catalogo.models import Almacen, Categoria, Subcategoria, Material, Pieza
from apps.inspeccion.models import PlantillaCriterio, Inspeccion, ProgramacionInspeccion
from apps.inspeccion.planificacion import construir_materiales_config, generar_plan_anual

User = get_user_model()

class ActiveChecksTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.almacen = Almacen.objects.create(nombre="Almacen Test", codigo="ALM-TEST")
        self.user = User.objects.create_user(username="testinspector", password="password")
        AccountProfile.objects.create(
            user=self.user,
            worker_code="INSPECTOR-TEST",
            role=AccountProfile.Role.INSPECTOR,
            almacen=self.almacen,
            must_change_password=False,
        )
        self.client.force_authenticate(self.user)
        
        # Plantilla
        self.plantilla = PlantillaCriterio.objects.create(nombre="Plantilla Test")
        
        # Categoría
        self.categoria = Categoria.objects.create(
            almacen=self.almacen,
            nombre="Herramientas", 
            prefijo="H",
            activo=True,
            requiere_inspeccion=True
        )
        
        # Subcategoría
        self.subcategoria = Subcategoria.objects.create(
            categoria=self.categoria,
            nombre="Manuales",
            plantilla_inspeccion=self.plantilla,
            activo=True
        )
        
        # Material
        self.material = Material.objects.create(
            subcategoria=self.subcategoria,
            almacen=self.almacen,
            nombre="Taladro",
            tipo_control="retornable",
            control_individual=True,
            activo=True
        )
        
        # Pieza
        self.pieza = Pieza.objects.create(
            material=self.material,
            estado="Disponible"
        )

    def test_plan_anual_escalonado(self):
        """Verifica que el plan anual se genere con fechas escalonadas y no concentradas."""
        # Crear varias piezas para el material
        for _ in range(10):
            Pieza.objects.create(material=self.material, estado="Disponible")
        
        cfg = construir_materiales_config(self.almacen.id)
        plan, creadas = generar_plan_anual(2026, date(2026, 1, 1), cfg, self.almacen.id)
        self.assertEqual(len(creadas), 11)
        fechas = [p.fecha_programada for p in creadas]
        # No deben ser todas la misma fecha
        self.assertGreater(len(set(fechas)), 1)
        # Ninguna debe caer en sábado (5) ni domingo (6)
        for f in fechas:
            self.assertNotIn(f.weekday(), [5, 6])

    def test_vencidas_active_elements_appear(self):
        """Un material con todo activo debe aparecer en las alertas de vencidas."""
        response = self.client.get("/api/v1/inspecciones/vencidas/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        material_ids = [item["material_id"] for item in data]
        self.assertIn(self.material.id, material_ids)

    def test_vencidas_inactive_material_excluded(self):
        """Un material inactivo no debe aparecer en vencidas."""
        self.material.activo = False
        self.material.save()
        
        response = self.client.get("/api/v1/inspecciones/vencidas/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        material_ids = [item["material_id"] for item in data]
        self.assertNotIn(self.material.id, material_ids)

    def test_vencidas_inactive_subcategory_excluded(self):
        """Un material con subcategoría inactiva no debe aparecer en vencidas."""
        self.subcategoria.activo = False
        self.subcategoria.save()
        
        response = self.client.get("/api/v1/inspecciones/vencidas/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        material_ids = [item["material_id"] for item in data]
        self.assertNotIn(self.material.id, material_ids)

    def test_vencidas_inactive_category_excluded(self):
        """Un material con categoría inactiva no debe aparecer en vencidas."""
        self.categoria.activo = False
        self.categoria.save()
        
        response = self.client.get("/api/v1/inspecciones/vencidas/")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        material_ids = [item["material_id"] for item in data]
        self.assertNotIn(self.material.id, material_ids)

    def test_materiales_inspeccionables_endpoint(self):
        """El endpoint de materiales con inspeccionable=true debe filtrar inactivos."""
        # 1. Todo activo
        response = self.client.get("/api/v1/materiales/?inspeccionable=true")
        self.assertEqual(response.status_code, 200)
        results = response.json()
        if isinstance(results, dict) and "results" in results:
            results = results["results"]
        material_ids = [m["id"] for m in results]
        self.assertIn(self.material.id, material_ids)

        # 2. Material inactivo
        self.material.activo = False
        self.material.save()
        response = self.client.get("/api/v1/materiales/?inspeccionable=true")
        results = response.json()
        if isinstance(results, dict) and "results" in results:
            results = results["results"]
        material_ids = [m["id"] for m in results]
        self.assertNotIn(self.material.id, material_ids)

    def test_api_inspeccion_creation_fails_for_inactive(self):
        """La creación de una inspección por API debe fallar si algún elemento está inactivo."""
        payload = {
            "tipo": "individual",
            "material": self.material.id,
            "pieza": self.pieza.id,
            "plantilla": self.plantilla.id,
            "inspector": self.user.id,
            "resultado_general": "apta",
            "accion_tomada": "continua_servicio",
            "cantidad_inspeccionada": 1,
            "cantidad_apta": 1,
            "cantidad_no_apta": 0,
            "respuestas": []
        }

        # 1. Todo activo -> debe tener éxito
        response = self.client.post("/api/v1/inspecciones/", payload, format="json")
        self.assertEqual(response.status_code, 201)

        # Limpiar
        Inspeccion.objects.all().delete()

        # 2. Material inactivo -> debe fallar
        self.material.activo = False
        self.material.save()
        response = self.client.post("/api/v1/inspecciones/", payload, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("material", response.json())

        self.material.activo = True
        self.material.save()
        self.subcategoria.activo = False
        self.subcategoria.save()
        response = self.client.post("/api/v1/inspecciones/", payload, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("material", response.json())

        self.subcategoria.activo = True
        self.subcategoria.save()
        self.categoria.activo = False
        self.categoria.save()
        response = self.client.post("/api/v1/inspecciones/", payload, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("material", response.json())


class InspectionTemplatePermissionsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = User.objects.create_user(username="template-admin", password="password")
        AccountProfile.objects.create(
            user=self.admin,
            worker_code="TEMPLATE-ADMIN",
            role=AccountProfile.Role.ADMIN,
            must_change_password=False,
        )

    def test_only_authorized_users_can_manage_questions(self):
        self.assertEqual(self.client.get("/api/v1/plantillas-criterios/").status_code, 401)
        self.client.force_authenticate(self.admin)
        template = self.client.post("/api/v1/plantillas-criterios/", {"nombre": "Checklist UAT"}, format="json")
        self.assertEqual(template.status_code, 201, template.json())
        criterion = self.client.post(
            "/api/v1/criterios/",
            {"plantilla": template.json()["id"], "texto": "Pregunta editable", "orden": 1},
            format="json",
        )
        self.assertEqual(criterion.status_code, 201, criterion.json())


class InspeccionSSTTests(TestCase):
    """Tests del plan: código correlativo mensual, campos SST nuevos,
    inspección grupal, endpoint de pendientes/re-inspección y exportación."""

    def setUp(self):
        self.client = APIClient()
        self.almacen = Almacen.objects.create(nombre="Almacen Test", codigo="ALM-TEST")
        self.user = User.objects.create_user(username="testinspector-sst", password="password")
        AccountProfile.objects.create(
            user=self.user,
            worker_code="INSPECTOR-SST",
            role=AccountProfile.Role.INSPECTOR,
            almacen=self.almacen,
            must_change_password=False,
        )
        self.client.force_authenticate(self.user)

        self.plantilla = PlantillaCriterio.objects.create(nombre="Plantilla SST Test")
        self.categoria = Categoria.objects.create(
            almacen=self.almacen,
            nombre="Herramientas",
            prefijo="H",
            activo=True,
            requiere_inspeccion=True,
        )
        self.subcategoria = Subcategoria.objects.create(
            categoria=self.categoria,
            nombre="Manuales",
            plantilla_inspeccion=self.plantilla,
            activo=True,
        )
        self.material = Material.objects.create(
            subcategoria=self.subcategoria,
            almacen=self.almacen,
            nombre="Taladro",
            tipo_control="retornable",
            control_individual=True,
            activo=True,
        )
        self.pieza = Pieza.objects.create(material=self.material, estado="Disponible")
        self.pieza2 = Pieza.objects.create(material=self.material, estado="Disponible")

    def test_generar_codigo_inspeccion_correlativo_mensual(self):
        """FOR-SST-YYMM-00001, se incrementa dentro del mismo mes y se reinicia al cambiar de mes."""
        from datetime import datetime
        from apps.inspeccion.services import generar_codigo_inspeccion

        fecha_agosto = datetime(2026, 8, 15)
        codigo1 = generar_codigo_inspeccion(fecha_agosto)
        self.assertEqual(codigo1, "FOR-SST-2608-00001")

        Inspeccion.objects.create(
            inspector=self.user, tipo="individual", material=self.material,
            pieza=self.pieza, plantilla=self.plantilla, almacen=self.almacen,
            fecha=fecha_agosto, codigo_inspeccion=codigo1,
        )
        codigo2 = generar_codigo_inspeccion(fecha_agosto)
        self.assertEqual(codigo2, "FOR-SST-2608-00002")

        fecha_septiembre = datetime(2026, 9, 1)
        codigo_septiembre = generar_codigo_inspeccion(fecha_septiembre)
        self.assertEqual(codigo_septiembre, "FOR-SST-2609-00001")

    def test_crear_inspeccion_con_area_y_tipo_planificada(self):
        """area, tipo_inspeccion y frecuencia se persisten, y codigo_inspeccion se genera solo."""
        inspeccion = Inspeccion.objects.create(
            inspector=self.user, tipo="individual", material=self.material,
            pieza=self.pieza, plantilla=self.plantilla, almacen=self.almacen,
            area="Hilandería", tipo_inspeccion="planificada", frecuencia="Trimestral",
        )
        self.assertTrue(inspeccion.codigo_inspeccion.startswith("FOR-SST-"))
        self.assertEqual(inspeccion.area, "Hilandería")
        self.assertEqual(inspeccion.tipo_inspeccion, "planificada")
        self.assertEqual(inspeccion.frecuencia, "Trimestral")

    def test_crear_inspeccion_grupal_con_cantidades_y_codigos(self):
        """cantidad_apta + cantidad_no_apta debe ser igual a cantidad_inspeccionada; se guardan los códigos de piezas_lote."""
        payload = {
            "tipo": "grupal",
            "material": self.material.id,
            "piezas_lote": [self.pieza.id, self.pieza2.id],
            "plantilla": self.plantilla.id,
            "inspector": self.user.id,
            "area": "Tejeduría",
            "tipo_inspeccion": "planificada",
            "frecuencia": "Bimestral",
            "resultado_general": "apta",
            "accion_tomada": "continua_servicio",
            "cantidad_inspeccionada": 2,
            "cantidad_apta": 1,
            "cantidad_no_apta": 0,  # 1 + 0 != 2 -> debe fallar
            "respuestas": [],
        }
        response = self.client.post("/api/v1/inspecciones/", payload, format="json")
        self.assertEqual(response.status_code, 400)

        payload["cantidad_no_apta"] = 1  # 1 + 1 == 2, ahora cuadra
        response = self.client.post("/api/v1/inspecciones/", payload, format="json")
        self.assertEqual(response.status_code, 201, response.json())

        inspeccion = Inspeccion.objects.get(id=response.json()["id"])
        codigos_piezas = set(inspeccion.piezas_lote.values_list("codigo", flat=True))
        self.assertEqual(codigos_piezas, {self.pieza.codigo, self.pieza2.codigo})

    def test_endpoint_materiales_pendientes_y_reinspeccion(self):
        """Por defecto solo lista pendientes; con incluir_inspeccionados=true expone también los ya inspeccionados para re-inspección."""
        url = "/api/v1/inspecciones/materiales-pendientes/"

        response = self.client.get(url, {"almacen": self.almacen.id})
        self.assertEqual(response.status_code, 200)
        data = response.json()
        codigos = [item["pieza_codigo"] for item in data]
        self.assertIn(self.pieza.codigo, codigos)

        Inspeccion.objects.create(
            inspector=self.user, tipo="individual", material=self.material,
            pieza=self.pieza, plantilla=self.plantilla, almacen=self.almacen,
        )

        response = self.client.get(url, {"almacen": self.almacen.id})
        codigos = [item["pieza_codigo"] for item in response.json()]
        self.assertNotIn(self.pieza.codigo, codigos)

        response = self.client.get(url, {"almacen": self.almacen.id, "incluir_inspeccionados": "true"})
        data = response.json()
        item = next(i for i in data if i["pieza_codigo"] == self.pieza.codigo)
        self.assertEqual(item["estado_inspeccion"], "al_dia")
        self.assertIsNotNone(item["ultima_fecha"])

    def test_exportacion_pdf_y_excel(self):
        """Los generadores de PDF y Excel deben producir buffers válidos con cabecera SST, código y desglose de cantidades."""
        from apps.inspeccion.exporters import generar_pdf_inspeccion, generar_excel_inspeccion

        inspeccion = Inspeccion.objects.create(
            inspector=self.user, tipo="grupal", material=self.material,
            plantilla=self.plantilla, almacen=self.almacen,
            area="Mantenimiento Central", tipo_inspeccion="planificada", frecuencia="Trimestral",
            cantidad_inspeccionada=2, cantidad_apta=2, cantidad_no_apta=0,
        )
        inspeccion.piezas_lote.set([self.pieza, self.pieza2])

        pdf_buffer = generar_pdf_inspeccion(inspeccion)
        self.assertGreater(len(pdf_buffer.getvalue()), 0)

        excel_buffer = generar_excel_inspeccion(inspeccion)
        self.assertGreater(len(excel_buffer.getvalue()), 0)