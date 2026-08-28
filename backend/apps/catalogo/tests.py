from decimal import Decimal
from django.test import TestCase
from apps.catalogo.models import Almacen, Categoria, Subcategoria, Material
from apps.catalogo.serializers import MaterialSerializer


class MaterialPrecioTest(TestCase):
    def setUp(self):
        self.almacen = Almacen.objects.create(
            nombre="Almacén Principal",
            codigo="ALM-01",
        )
        self.categoria = Categoria.objects.create(
            almacen=self.almacen,
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
            almacen=self.almacen,
            nombre="Llave Inglesa 10",
            tipo_control="retornable",
            control_individual=True,
            precio=Decimal("125.50"),
        )
        self.assertEqual(material.precio, Decimal("125.50"))

    def test_material_serializer_incluye_precio(self):
        material = Material.objects.create(
            subcategoria=self.subcategoria,
            almacen=self.almacen,
            nombre="Alicate Universal",
            tipo_control="retornable",
            control_individual=False,
            precio=Decimal("45.00"),
        )
        serializer = MaterialSerializer(material)
        self.assertIn("precio", serializer.data)
        self.assertEqual(serializer.data["precio"], "45.00")

    def test_stock_minimo_formula(self):
        material = Material.objects.create(
            subcategoria=self.subcategoria,
            almacen=self.almacen,
            nombre="Tornillos M8",
            tipo_control="no_retornable",
            control_individual=False,
            cantidad_total=50,
            tiempo_entrega_dias=10,
            stock_seguridad=15,
        )
        # Sin movimientos, consumo_diario = 0, stock_minimo = 0 * 10 + 15 = 15
        self.assertEqual(material.calcular_consumo_diario(), 0.0)
        self.assertEqual(material.calcular_stock_minimo(), 15)

        serializer = MaterialSerializer(material)
        self.assertEqual(serializer.data["tiempo_entrega_dias"], 10)
        self.assertEqual(serializer.data["stock_seguridad"], 15)
        self.assertEqual(serializer.data["stock_minimo_calculado"], 15)
        self.assertIn("stock_desglose", serializer.data)
