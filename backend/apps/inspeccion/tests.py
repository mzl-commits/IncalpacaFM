from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from apps.catalogo.models import Categoria, Subcategoria, Material, Pieza
from apps.inspeccion.models import PlantillaCriterio, Inspeccion

User = get_user_model()

class ActiveChecksTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username="testinspector", password="password")
        
        # Plantilla
        self.plantilla = PlantillaCriterio.objects.create(nombre="Plantilla Test")
        
        # Categoría
        self.categoria = Categoria.objects.create(
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

        # Restaurar y hacer subcategoría inactiva
        self.material.activo = True
        self.material.save()
        self.subcategoria.activo = False
        self.subcategoria.save()
        response = self.client.post("/api/v1/inspecciones/", payload, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("material", response.json())

        # Restaurar y hacer categoría inactiva
        self.subcategoria.activo = True
        self.subcategoria.save()
        self.categoria.activo = False
        self.categoria.save()
        response = self.client.post("/api/v1/inspecciones/", payload, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("material", response.json())
