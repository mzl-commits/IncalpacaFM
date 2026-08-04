from django.db import migrations, models


METHOD_CHOICES = [
    ("POR_DEFINIR", "Por definir"),
    ("VENTA", "Venta"),
    ("RECICLAJE", "Reciclaje"),
    ("DESECHO", "Desecho"),
    ("DONACION", "Donación"),
]


class Migration(migrations.Migration):
    dependencies = [("lifecycle", "0002_seed_lifecycle_examples")]

    operations = [
        migrations.AlterField(
            model_name="retirementrequest",
            name="recommendation",
            field=models.CharField(choices=METHOD_CHOICES, max_length=16),
        ),
        migrations.AlterField(
            model_name="retirementrequest",
            name="approved_method",
            field=models.CharField(blank=True, choices=METHOD_CHOICES, max_length=16),
        ),
    ]
