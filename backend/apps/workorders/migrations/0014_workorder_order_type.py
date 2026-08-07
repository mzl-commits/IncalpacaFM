from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("workorders", "0013_normalize_correction_order_codes"),
    ]

    operations = [
        migrations.AddField(
            model_name="workorder",
            name="order_type",
            field=models.CharField(
                choices=[
                    ("OT", "Orden de trabajo"),
                    ("OL", "Orden de limpieza"),
                    ("OS", "Orden de servicio"),
                ],
                default="OT",
                max_length=2,
            ),
        ),
    ]