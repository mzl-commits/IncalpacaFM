from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("catalogo", "0015_material_clasificacion_operativa"),
        ("workorders", "0020_merge_20260811_1436"),
    ]

    operations = [
        migrations.AddField(
            model_name="workordercost",
            name="source_material",
            field=models.ForeignKey(blank=True, help_text="Material que originÃ³ este costo calculado automÃ¡ticamente.", null=True, on_delete=django.db.models.deletion.PROTECT, related_name="costos_generados_en_ot", to="catalogo.material"),
        ),
        migrations.AddField(
            model_name="workordermaterial",
            name="precio_unitario",
            field=models.DecimalField(blank=True, decimal_places=2, help_text="Precio aplicado a este uso. Solo influye cuando el material es consumible.", max_digits=10, null=True),
        ),
    ]
