from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Actualiza el texto visible de UNIDAD_MANEJO_CHOICES (prefijo "Por …").
    NO cambia valores guardados en la base de datos — solo actualiza los
    labels que Django muestra en admin, API y formularios.
    Inofensiva: no toca filas, no hace ALTER TABLE.
    """

    dependencies = [
        ('catalogo', '0012_ampliar_unidad_manejo_choices'),
    ]

    operations = [
        migrations.AlterField(
            model_name='material',
            name='unidad_manejo',
            field=models.CharField(
                choices=[
                    ('unidad',  'Por unidad suelta'),
                    ('caja',    'Por caja'),
                    ('bolsa',   'Por bolsa'),
                    ('paquete', 'Por paquete'),
                    ('fardo',   'Por fardo'),
                    ('saco',    'Por saco'),
                    ('balde',   'Por balde'),
                    ('cunete',  'Por cuñete'),
                    ('tambor',  'Por tambor / cilindro'),
                    ('bidon',   'Por bidón'),
                    ('frasco',  'Por frasco'),
                    ('blister', 'Por blíster'),
                    ('rollo',   'Por rollo'),
                    ('bobina',  'Por bobina'),
                    ('carrete', 'Por carrete'),
                    ('millar',  'Por millar'),
                    ('ciento',  'Por ciento'),
                    ('docena',  'Por docena'),
                    ('juego',   'Por juego / kit'),
                    ('plancha', 'Por plancha / lámina'),
                    ('barra',   'Por barra'),
                    ('hoja',    'Por hoja'),
                ],
                default='unidad',
                help_text='Cómo se cuenta el stock de este consumible: por unidad suelta o por empaque (caja, bolsa, saco, millar, etc.).',
                max_length=10,
            ),
        ),
    ]
