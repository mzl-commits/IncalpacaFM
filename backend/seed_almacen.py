import os
import sys
import django
from decimal import Decimal

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.catalogo.models import Categoria, Subcategoria, Material, Pieza
from apps.inventario.models import Movimiento
from django.contrib.auth import get_user_model

User = get_user_model()

def seed_almacen():
    print("Sembrando 10 datos de prueba para Almacén (Catálogo e Inventario)...")
    
    admin = User.objects.filter(username='admin').first()
    if not admin:
        admin = User.objects.create(username='admin_almacen')
    
    # 1. Categorías y Subcategorías
    cat_herr, _ = Categoria.objects.get_or_create(nombre="Herramientas", defaults={"prefijo": "HER"})
    cat_elec, _ = Categoria.objects.get_or_create(nombre="Material Eléctrico", defaults={"prefijo": "ELE"})
    cat_epp, _ = Categoria.objects.get_or_create(nombre="EPP", defaults={"prefijo": "EPP"})

    sub_man, _ = Subcategoria.objects.get_or_create(categoria=cat_herr, nombre="Herramientas Manuales")
    sub_pow, _ = Subcategoria.objects.get_or_create(categoria=cat_herr, nombre="Herramientas de Poder")
    sub_cab, _ = Subcategoria.objects.get_or_create(categoria=cat_elec, nombre="Cables y Alambres")
    sub_seg, _ = Subcategoria.objects.get_or_create(categoria=cat_epp, nombre="Seguridad Industrial")

    # 10 Materiales de Prueba
    materiales_data = [
        {"nombre": "Martillo de Uña 16oz", "subcat": sub_man, "marca": "Stanley", "medida": "16 oz", "ctrl": "retornable", "indiv": True, "qty": 5},
        {"nombre": "Destornillador Estrella", "subcat": sub_man, "marca": "Truper", "medida": "6 pulgadas", "ctrl": "retornable", "indiv": True, "qty": 10},
        {"nombre": "Taladro Percutor 750W", "subcat": sub_pow, "marca": "Bosch", "modelo": "GSB 16 RE", "ctrl": "retornable", "indiv": True, "qty": 3},
        {"nombre": "Amoladora Angular 4 1/2", "subcat": sub_pow, "marca": "Makita", "modelo": "9557HPG", "ctrl": "retornable", "indiv": True, "qty": 4},
        {"nombre": "Cable THW 12 AWG", "subcat": sub_cab, "marca": "Indeco", "medida": "Rollo 100m", "ctrl": "no_retornable", "indiv": False, "qty": 20},
        {"nombre": "Cinta Aislante 3M", "subcat": sub_cab, "marca": "3M", "medida": "20m", "ctrl": "no_retornable", "indiv": False, "qty": 50},
        {"nombre": "Casco de Seguridad Blanco", "subcat": sub_seg, "marca": "MSA", "ctrl": "retornable", "indiv": True, "qty": 15},
        {"nombre": "Lentes de Seguridad Claros", "subcat": sub_seg, "marca": "3M", "ctrl": "no_retornable", "indiv": False, "qty": 100},
        {"nombre": "Guantes de Cuero", "subcat": sub_seg, "marca": "Segusa", "medida": "Talla L", "ctrl": "no_retornable", "indiv": False, "qty": 40},
        {"nombre": "Arnés de Seguridad de Cuerpo Entero", "subcat": sub_seg, "marca": "Delta Plus", "ctrl": "retornable", "indiv": True, "qty": 5},
    ]

    for idx, md in enumerate(materiales_data):
        mat, created = Material.objects.get_or_create(
            nombre=md["nombre"],
            defaults={
                "subcategoria": md["subcat"],
                "marca": md.get("marca", ""),
                "modelo": md.get("modelo", ""),
                "medida": md.get("medida", ""),
                "tipo_control": md["ctrl"],
                "control_individual": md["indiv"],
                "cantidad_total": md["qty"] if not md["indiv"] else 0,
                "ubicacion_fisica": f"Estante A-{idx+1}"
            }
        )

        if created:
            # Registrar entrada de inventario
            if not md["indiv"]:
                Movimiento.objects.create(
                    material=mat,
                    tipo="entrada",
                    cantidad=md["qty"],
                    responsable=admin,
                    observaciones="Entrada inicial de inventario (Seeder)"
                )
            else:
                # Generar piezas individuales
                for p_idx in range(md["qty"]):
                    pieza = Pieza.objects.create(
                        material=mat,
                        estado="Disponible"
                    )
                    Movimiento.objects.create(
                        material=mat,
                        pieza=pieza,
                        tipo="entrada",
                        cantidad=1,
                        responsable=admin,
                        observaciones="Entrada inicial de pieza (Seeder)"
                    )
                # Recalcular
                mat.recalcular_cantidad()

    print(f"¡10 Materiales creados exitosamente en el catálogo con sus respectivos movimientos de inventario!")

if __name__ == "__main__":
    seed_almacen()
