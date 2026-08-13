from django.db import migrations


def asignar_almacen(apps, schema_editor):
    Almacen = apps.get_model("catalogo", "Almacen")
    Categoria = apps.get_model("catalogo", "Categoria")
    almacen_defecto, _ = Almacen.objects.get_or_create(
        codigo="ALM-HERR",
        defaults={"nombre": "Almacén de Herramientas", "activo": True},
    )
    Categoria.objects.filter(almacen__isnull=True).update(almacen=almacen_defecto)


def revertir(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("catalogo", "0016_categoria_almacen_alter_categoria_nombre_and_more"),
    ]

    operations = [
        migrations.RunPython(asignar_almacen, revertir),
    ]