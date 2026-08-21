from django.db import migrations


def seed_inspeccion_config(apps, schema_editor):
    Categoria = apps.get_model("catalogo", "Categoria")
    Subcategoria = apps.get_model("catalogo", "Subcategoria")
    PlantillaCriterio = apps.get_model("inspeccion", "PlantillaCriterio")
    Criterio = apps.get_model("inspeccion", "Criterio")

    # 1. Habilitar inspección en categorías clave
    Categoria.objects.filter(
        nombre__iregex=r"(herramienta|protecci|epp|equipo de protecci)"
    ).update(requiere_inspeccion=True)

    # 2. Crear/obtener plantillas de criterios
    p_manual = PlantillaCriterio.objects.filter(nombre__icontains="Manual").first()
    p_inalamb = PlantillaCriterio.objects.filter(nombre__icontains="Inal").first()
    p_cable = PlantillaCriterio.objects.filter(nombre__icontains="Cable").first()

    p_epp, _ = PlantillaCriterio.objects.get_or_create(
        nombre="Equipo de Protección Personal (EPP)"
    )
    criterios_epp = [
        (1, "Cintas y correas sin cortes, deshilachados, quemaduras ni desgaste excesivo"),
        (2, "Costuras de seguridad intactas, sin hilos rotos ni sueltos"),
        (3, "Argollas en D metálicas sin fisuras, deformaciones, corrosión ni bordes cortantes"),
        (4, "Hebillas y elementos de ajuste operativos, sin trabas ni deformaciones"),
        (5, "Absorbedor de impacto intacto, sin indicios de activación previa ni roturas"),
        (6, "Mosquetones y ganchos con cierre y bloqueo automático 100% operativo"),
        (7, "Etiquetas de fabricación, capacidad y certificación legibles"),
        (8, "Limpieza general, libre de grasa, químicos, pintura o solventes corrosivos"),
        (9, "Ausencia de caídas o impactos previos registrados en el equipo"),
        (10, "Almacenamiento adecuado en lugar seco, ventilado y protegido de luz solar directa"),
    ]
    for orden, texto in criterios_epp:
        Criterio.objects.get_or_create(plantilla=p_epp, orden=orden, defaults={"texto": texto})

    p_esc, _ = PlantillaCriterio.objects.get_or_create(
        nombre="Escaleras y Equipos de Altura"
    )
    criterios_esc = [
        (1, "Zapatas o tacos antideslizantes en buen estado y bien asegurados"),
        (2, "Peldaños limpios, sin grasa, deformaciones ni fisuras"),
        (3, "Largueros rectos, sin abolladuras ni rajaduras"),
        (4, "Tirantes o crucetas de unión y bloqueo de apertura operativos"),
        (5, "Remaches, pernos y uniones firmes sin holguras"),
        (6, "Poleas, cuerdas y guías (en extensibles) operativas y sin desgaste"),
        (7, "Etiquetas de advertencia y capacidad de carga legibles"),
        (8, "Superficie libre de pintura u otros recubrimientos que oculten defectos"),
    ]
    for orden, texto in criterios_esc:
        Criterio.objects.get_or_create(plantilla=p_esc, orden=orden, defaults={"texto": texto})

    # 3. Asignar plantillas por defecto a subcategorías
    for s in Subcategoria.objects.select_related("categoria").all():
        nom = (s.nombre or "").lower()
        cat_nom = (s.categoria.nombre or "").lower() if s.categoria else ""

        if "caída" in nom or "caida" in nom or "protecci" in cat_nom or "protecci" in nom:
            if p_epp:
                s.plantilla_inspeccion_id = p_epp.id
                s.save(update_fields=["plantilla_inspeccion"])
        elif "escalera" in nom or "andamio" in nom:
            if p_esc:
                s.plantilla_inspeccion_id = p_esc.id
                s.save(update_fields=["plantilla_inspeccion"])
        elif "inal" in nom:
            if p_inalamb:
                s.plantilla_inspeccion_id = p_inalamb.id
                s.save(update_fields=["plantilla_inspeccion"])
        elif "el" in nom and "herr" in cat_nom:
            if p_cable:
                s.plantilla_inspeccion_id = p_cable.id
                s.save(update_fields=["plantilla_inspeccion"])
        elif "herr" in cat_nom or "herr" in nom or "alba" in cat_nom or "espatula" in nom:
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
