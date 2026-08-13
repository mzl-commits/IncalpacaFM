from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("catalogo", "0018_poblar_nuevos_catalogos_almacen"),
    ]

    operations = [
        migrations.AddField(
            model_name="material",
            name="stock_minimo",
            field=models.PositiveIntegerField(
                default=0,
                help_text="Si el stock cae a este nivel o por debajo se genera una notificación. 0 = desactivado.",
            ),
        ),
    ]
