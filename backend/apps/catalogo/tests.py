from decimal import Decimal
from django.test import TestCase
from apps.catalogo.models import Categoria, Subcategoria, Material
from apps.catalogo.serializers import MaterialSerializer


class MaterialPrecioTest(TestCase):
    def setUp(self):
        self.categoria = Categoria.objects.create(
            nombre="Herramientas Test",
            prefijo="HT",
        )
        self.subcategoria = Subcategoria.objects.create(
            categoria=self.categoria,
            nombre="Manuales Test",
        )

    def test_crear_material_con_precio(self):
        material = Material.objects.create(
            subcategoria=self.subcategoria,
            nombre="Llave Inglesa 10",
            tipo_control="retornable",
            control_individual=True,
            precio=Decimal("125.50"),
        )
        self.assertEqual(material.precio, Decimal("125.50"))

    def test_material_serializer_incluye_precio(self):
        material = Material.objects.create(
            subcategoria=self.subcategoria,
            nombre="Alicate Universal",
            tipo_control="retornable",
            control_individual=False,
            precio=Decimal("45.00"),
        )
        serializer = MaterialSerializer(material)
        self.assertIn("precio", serializer.data)
        self.assertEqual(serializer.data["precio"], "45.00")
