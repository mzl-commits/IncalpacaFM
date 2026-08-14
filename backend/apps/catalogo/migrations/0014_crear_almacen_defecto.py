from django.db import migrations


def crear_almacen_defecto(apps, schema_editor):
    Almacen = apps.get_model("catalogo", "Almacen")
    Material = apps.get_model("catalogo", "Material")
    Movimiento = apps.get_model("inventario", "Movimiento")
    Inspeccion = apps.get_model("inspeccion", "Inspeccion")

    almacen, _ = Almacen.objects.get_or_create(
        codigo="ALM-HERR",
        defaults={"nombre": "Almacén de Herramientas", "activo": True},
    )
    Material.objects.filter(almacen__isnull=True).update(almacen=almacen)
    Movimiento.objects.filter(almacen__isnull=True).update(almacen=almacen)
    Inspeccion.objects.filter(almacen__isnull=True).update(almacen=almacen)


def revertir(apps, schema_editor):
    pass  # no revertimos la asignación de almacén por defecto


class Migration(migrations.Migration):

    dependencies = [
        ("catalogo", "0013_almacen_material_almacen"),
        ("inventario", "0003_movimiento_almacen"),
        ("inspeccion", "0003_inspeccion_almacen"),
    ]

    operations = [
        migrations.RunPython(crear_almacen_defecto, revertir),
    ]