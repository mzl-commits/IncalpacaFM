from django.db import migrations, models


def classify_existing_materials(apps, schema_editor):
    Material = apps.get_model("catalogo", "Material")
    Material.objects.filter(tipo_control="retornable").update(clasificacion_operativa="HERRAMIENTA")


class Migration(migrations.Migration):
    dependencies = [("catalogo", "0014_alter_material_unidades_por_caja")]

    operations = [
        migrations.AddField(
            model_name="material",
            name="clasificacion_operativa",
            field=models.CharField(
                choices=[
                    ("CONSUMIBLE", "Consumible (genera costo)"),
                    ("HERRAMIENTA", "Herramienta reutilizable (solo uso)"),
                    ("EPP", "Equipo de protecciÃ³n personal (solo uso)"),
                ],
                default="CONSUMIBLE",
                help_text="Define el tratamiento en una OT. Solo los consumibles generan costos; herramientas y EPP quedan registrados como uso operativo.",
                max_length=16,
            ),
        ),
        migrations.RunPython(classify_existing_materials, migrations.RunPython.noop),
    ]
