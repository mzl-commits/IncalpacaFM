import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventario', '0005_gruposolicitud_and_solicitudmovimiento_v2'),
        ('catalogo', '0016_catalogos_unidad_medida_manejo_stock'),
    ]

    operations = [
        migrations.AddField(
            model_name='movimiento',
            name='unidad_movimiento',
            field=models.ForeignKey(
                blank=True, null=True,
                help_text="Si el material permite elegir unidad (ej. Rollo), unidad en la que el "
                          "almacenero registró la cantidad (ej. metros), distinta de la unidad base "
                          "del material (ej. centímetros) en la que 'cantidad' queda guardada.",
                on_delete=django.db.models.deletion.PROTECT,
                related_name='movimientos', to='catalogo.unidadmedida',
            ),
        ),
        migrations.AddField(
            model_name='movimiento',
            name='cantidad_en_unidad_movimiento',
            field=models.DecimalField(
                blank=True, null=True, decimal_places=3, max_digits=12,
                help_text="Cantidad tal como la ingresó el almacenero, en 'unidad_movimiento' (antes de "
                          "convertir a la unidad base del material). Solo trazabilidad/legibilidad.",
            ),
        ),
    ]
