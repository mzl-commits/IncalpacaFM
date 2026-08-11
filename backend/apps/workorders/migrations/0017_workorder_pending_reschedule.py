from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("workorders", "0016_work_order_material_porcentaje_requerido")]

    operations = [
        migrations.AlterField(
            model_name="workorder",
            name="status",
            field=models.CharField(
                choices=[
                    ("PROGRAMADA", "Programada"),
                    ("PENDIENTE_REPROGRAMACION", "Pendiente de reprogramación"),
                    ("EN_PROCESO", "En proceso"),
                    ("PENDIENTE_DE_SUPERVISION", "Pendiente de supervisión"),
                    ("PENDIENTE_DE_VALIDACION", "Pendiente de validación"),
                    ("PENDIENTE_DE_CONFORMIDAD", "Pendiente de conformidad"),
                    ("CERRADA", "Cerrada"),
                    ("DEVUELTA", "Devuelta"),
                    ("CANCELADA", "Cancelada"),
                ],
                default="PROGRAMADA",
                max_length=32,
            ),
        ),
    ]
