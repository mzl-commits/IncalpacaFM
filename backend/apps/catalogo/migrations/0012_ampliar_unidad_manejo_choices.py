from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('catalogo', '0011_merge_20260810_2225'),
    ]

    operations = [
        migrations.AlterField(
            model_name='material',
            name='unidad_manejo',
            field=models.CharField(
                choices=[
                    ('unidad',  'Unidad'),
                    ('caja',    'Caja'),
                    ('bolsa',   'Bolsa'),
                    ('paquete', 'Paquete'),
                    ('fardo',   'Fardo'),
                    ('saco',    'Saco'),
                    ('balde',   'Balde'),
                    ('cunete',  'Cuñete'),
                    ('tambor',  'Tambor'),
                    ('bidon',   'Bidón'),
                    ('frasco',  'Frasco'),
                    ('blister', 'Blíster'),
                    ('rollo',   'Rollo'),
                    ('bobina',  'Bobina'),
                    ('carrete', 'Carrete'),
                    ('millar',  'Millar'),
                    ('ciento',  'Ciento'),
                    ('docena',  'Docena'),
                    ('juego',   'Juego / Kit'),
                    ('plancha', 'Plancha'),
                    ('barra',   'Barra'),
                    ('hoja',    'Hoja'),
                ],
                default='unidad',
                help_text='Cómo se cuenta el stock de este consumible: por unidad suelta o por empaque.',
                max_length=10,
            ),
        ),
    ]
