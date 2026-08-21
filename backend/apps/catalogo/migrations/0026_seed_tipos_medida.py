from django.db import migrations

TIPOS = [
    {"codigo": "diametro", "nombre": "Diámetro", "orden": 1},
    {"codigo": "largo", "nombre": "Largo", "orden": 2},
    {"codigo": "ancho", "nombre": "Ancho", "orden": 3},
    {"codigo": "alto", "nombre": "Alto", "orden": 4},
    {"codigo": "espesor", "nombre": "Espesor / Grosor", "orden": 5},
    {"codigo": "calibre", "nombre": "Calibre", "orden": 6},
]


def seed_tipos_medida(apps, schema_editor):
    TipoMedidaCatalogo = apps.get_model("catalogo", "TipoMedidaCatalogo")
    for t in TIPOS:
        TipoMedidaCatalogo.objects.get_or_create(codigo=t["codigo"], defaults=t)


def eliminar_tipos_medida(apps, schema_editor):
    TipoMedidaCatalogo = apps.get_model("catalogo", "TipoMedidaCatalogo")
    TipoMedidaCatalogo.objects.filter(codigo__in=[t["codigo"] for t in TIPOS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        # Reemplaza esto por el nombre real de tu migración anterior
        # (la que creó el modelo TipoMedidaCatalogo, ej. "0017_..."),
        ("catalogo", "0025_tipomedidacatalogo_remove_material_grosor_and_more"),
    ]

    operations = [
        migrations.RunPython(seed_tipos_medida, eliminar_tipos_medida),
    ]