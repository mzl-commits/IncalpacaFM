from django.db import migrations


def seed_inspeccion_config(apps, schema_editor):
    Categoria = apps.get_model("catalogo", "Categoria")
    Subcategoria = apps.get_model("catalogo", "Subcategoria")
    PlantillaCriterio = apps.get_model("inspeccion", "PlantillaCriterio")

    # 1. Habilitar inspección en categorías clave
    Categoria.objects.filter(
        nombre__iregex=r"(herramienta|protecci|epp|equipo de protecci)"
    ).update(requiere_inspeccion=True)

    # 2. Obtener plantillas
    p_manual = PlantillaCriterio.objects.filter(nombre__icontains="Manual").first()
    p_inalamb = PlantillaCriterio.objects.filter(nombre__icontains="Inal").first()
    p_cable = PlantillaCriterio.objects.filter(nombre__icontains="Cable").first()

    # 3. Asignar plantillas por defecto a subcategorías
    for s in Subcategoria.objects.select_related("categoria").all():
        nom = (s.nombre or "").lower()
        cat_nom = (s.categoria.nombre or "").lower() if s.categoria else ""

        if "inal" in nom:
            if p_inalamb:
                s.plantilla_inspeccion_id = p_inalamb.id
                s.save(update_fields=["plantilla_inspeccion"])
        elif "el" in nom and "herr" in cat_nom:
            if p_cable:
                s.plantilla_inspeccion_id = p_cable.id
                s.save(update_fields=["plantilla_inspeccion"])
        elif "herr" in cat_nom or "herr" in nom or "protecci" in cat_nom:
            if p_manual:
                s.plantilla_inspeccion_id = p_manual.id
                s.save(update_fields=["plantilla_inspeccion"])


def revert_inspeccion_config(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("catalogo", "0026_seed_tipos_medida"),
        ("inspeccion", "0001_initial"),
    ]

    operations = [
        migrations.RunPython(seed_inspeccion_config, revert_inspeccion_config),
    ]
