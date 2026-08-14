from django.db import migrations

def poblar_almacen(apps, schema_editor):
    Almacen = apps.get_model("catalogo", "Almacen")
    PlanInspeccionAnual = apps.get_model("inspeccion", "PlanInspeccionAnual")
    ProgramacionInspeccion = apps.get_model("inspeccion", "ProgramacionInspeccion")

    almacen_defecto, _ = Almacen.objects.get_or_create(
        codigo="ALM-HERR",
        defaults={"nombre": "Almacén de Herramientas", "activo": True},
    )

    # Los planes existentes se asumen del almacén por defecto (hasta ahora
    # el sistema operaba con uno solo).
    PlanInspeccionAnual.objects.filter(almacen__isnull=True).update(almacen=almacen_defecto)

    # Cada Programación hereda el almacén REAL de su material/pieza (ya
    # poblado desde Fase 1), no el default a ciegas.
    for prog in ProgramacionInspeccion.objects.filter(almacen__isnull=True).select_related(
        "material", "pieza__material"
    ):
        material = prog.material or (prog.pieza.material if prog.pieza else None)
        if material and material.almacen_id:
            prog.almacen_id = material.almacen_id
            prog.save(update_fields=["almacen"])

def revertir(apps, schema_editor):
    pass

class Migration(migrations.Migration):
    dependencies = [
        ("inspeccion", "0005_planinspeccionanual_almacen_and_more"),
    ]
    operations = [
        migrations.RunPython(poblar_almacen, revertir),
    ]