import django.db.models.deletion
from django.db import migrations, models

import apps.catalogo.models as catalogo_models


UNIDADES_MEDIDA = [
    # codigo, nombre, abreviatura, familia, factor_a_base, orden
    ("mm", "Milímetros", "mm", "longitud", 1, 1),
    ("cm", "Centímetros", "cm", "longitud", 10, 2),
    ("m", "Metros", "m", "longitud", 1000, 3),
    ("in", "Pulgadas", "in", "longitud", "25.4", 4),
    ("ft", "Pies", "ft", "longitud", "304.8", 5),
    ("g", "Gramos", "g", "peso", 1, 6),
    ("kg", "Kilogramos", "kg", "peso", 1000, 7),
    ("lb", "Libras", "lb", "peso", "453.592", 8),
    ("ml", "Mililitros", "ml", "volumen", 1, 9),
    ("l", "Litros", "l", "volumen", 1000, 10),
    ("gal", "Galones", "gal", "volumen", "3785.41", 11),
]

# codigo (= valor legacy exacto guardado en Material.unidad_manejo), nombre,
# requiere_multiplicador, permite_conversion_unidad, orden
TIPOS_MANEJO_STOCK = [
    ("unidad", "Por Unidad", False, False, 1),
    ("Paquete", "Por Paquete", True, False, 2),
    ("Bolsa", "Por Bolsa", True, False, 3),
    ("Blister", "Por Blíster", True, False, 4),
    ("Kit", "Por Kit / Juego", True, False, 5),
    ("Rollo", "Por Rollo", False, True, 6),
    ("Docena", "Por Docena", True, False, 7),
    ("Millar", "Por Millar", True, False, 8),
    ("Litro", "Por Litro", False, False, 9),
    ("Mililitro", "Por Mililitro", False, False, 10),
    ("Galon", "Por Galón", False, False, 11),
    ("Bidon", "Por Bidón", True, False, 12),
    ("Kilogramo", "Por Kilogramo", False, False, 13),
    ("Gramo", "Por Gramo", False, False, 14),
    ("Libra", "Por Libra", False, False, 15),
    ("Metro", "Por Metro", False, False, 16),
    ("Centimetro", "Por Centímetro", False, False, 17),
    ("Milimetro", "Por Milímetro", False, False, 18),
    ("MetroCuadrado", "Por Metro Cuadrado", False, False, 19),
    ("MetroCubico", "Por Metro Cúbico", False, False, 20),
]


def seed_catalogos(apps, schema_editor):
    UnidadMedida = apps.get_model("catalogo", "UnidadMedida")
    TipoManejoStock = apps.get_model("catalogo", "TipoManejoStock")

    for codigo, nombre, abrev, familia, factor, orden in UNIDADES_MEDIDA:
        UnidadMedida.objects.get_or_create(
            codigo=codigo,
            defaults=dict(
                nombre=nombre, abreviatura=abrev, familia=familia,
                factor_a_base=factor, orden=orden, activo=True,
            ),
        )

    for codigo, nombre, requiere_mult, permite_conv, orden in TIPOS_MANEJO_STOCK:
        TipoManejoStock.objects.get_or_create(
            codigo=codigo,
            defaults=dict(
                nombre=nombre, requiere_multiplicador=requiere_mult,
                permite_conversion_unidad=permite_conv, orden=orden, activo=True,
            ),
        )


def migrar_material_fks(apps, schema_editor):
    Material = apps.get_model("catalogo", "Material")
    UnidadMedida = apps.get_model("catalogo", "UnidadMedida")
    TipoManejoStock = apps.get_model("catalogo", "TipoManejoStock")

    mapa_unidad_medida = {u.codigo: u for u in UnidadMedida.objects.all()}
    mapa_manejo = {t.codigo: t for t in TipoManejoStock.objects.all()}
    default_unidad = mapa_unidad_medida.get("mm")
    default_manejo = mapa_manejo.get("unidad")

    for material in Material.objects.all():
        material.unidad_medida_new_id = (
            mapa_unidad_medida.get(material.unidad_medida, default_unidad).pk
        )
        material.unidad_manejo_new_id = (
            mapa_manejo.get(material.unidad_manejo, default_manejo).pk
        )
        # Migración inicial: ningún material 'Rollo' preexistente tenía unidad
        # base configurada (el campo no existía). Se deja vacío; el admin
        # debe completarlo desde la edición del material antes de registrar
        # movimientos con conversión de unidad.
        material.save(update_fields=["unidad_medida_new_id", "unidad_manejo_new_id"])


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('catalogo', '0015_alter_material_tipo_control_and_more'),
    ]

    operations = [
        migrations.CreateModel(
            name='UnidadMedida',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('codigo', models.SlugField(help_text="Identificador interno estable (ej. 'cm'). No se muestra al usuario.", max_length=20, unique=True)),
                ('nombre', models.CharField(help_text="Ej. 'Centímetros'.", max_length=50)),
                ('abreviatura', models.CharField(help_text="Ej. 'cm'.", max_length=10)),
                ('familia', models.CharField(choices=[('longitud', 'Longitud'), ('peso', 'Peso'), ('volumen', 'Volumen'), ('otro', 'Otro')], default='otro', help_text='Solo se puede convertir entre unidades de la misma familia.', max_length=10)),
                ('factor_a_base', models.DecimalField(decimal_places=6, default=1, help_text='Cuántas unidades de referencia de la familia equivalen a 1 de esta unidad.', max_digits=14)),
                ('activo', models.BooleanField(default=True)),
                ('orden', models.PositiveSmallIntegerField(default=0)),
            ],
            options={
                'verbose_name': 'Unidad de medida',
                'verbose_name_plural': 'Unidades de medida',
                'ordering': ['familia', 'orden', 'nombre'],
            },
        ),
        migrations.CreateModel(
            name='TipoManejoStock',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('codigo', models.SlugField(help_text="Identificador interno estable (ej. 'rollo'). No se muestra al usuario.", max_length=20, unique=True)),
                ('nombre', models.CharField(help_text="Ej. 'Por Rollo'.", max_length=50)),
                ('requiere_multiplicador', models.BooleanField(default=False, help_text='Si está activo, al crear el material se debe indicar cuántas unidades trae cada empaque (caja, bolsa, kit, docena, etc.).')),
                ('permite_conversion_unidad', models.BooleanField(default=False, help_text='Si está activo, el material guarda su stock en una unidad base fija (ej. cm) y en cada movimiento se puede elegir otra unidad compatible (ej. m) para registrar la salida/entrada; se convierte automáticamente.')),
                ('activo', models.BooleanField(default=True)),
                ('orden', models.PositiveSmallIntegerField(default=0)),
            ],
            options={
                'verbose_name': 'Tipo de manejo de stock',
                'verbose_name_plural': 'Tipos de manejo de stock',
                'ordering': ['orden', 'nombre'],
            },
        ),
        migrations.RunPython(seed_catalogos, noop),
        migrations.AddField(
            model_name='material',
            name='unidad_medida_new',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.PROTECT, related_name='materiales_medida', to='catalogo.unidadmedida'),
        ),
        migrations.AddField(
            model_name='material',
            name='unidad_manejo_new',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.PROTECT, related_name='materiales', to='catalogo.tipomanejostock'),
        ),
        migrations.AddField(
            model_name='material',
            name='unidad_movimiento_base',
            field=models.ForeignKey(blank=True, help_text="Unidad en la que se guarda internamente el stock (ej. 'cm' para un Rollo). Solo aplica si unidad_manejo.permite_conversion_unidad.", null=True, on_delete=django.db.models.deletion.PROTECT, related_name='materiales_base_movimiento', to='catalogo.unidadmedida'),
        ),
        migrations.RunPython(migrar_material_fks, noop),
        migrations.RemoveField(
            model_name='material',
            name='unidad_medida',
        ),
        migrations.RemoveField(
            model_name='material',
            name='unidad_manejo',
        ),
        migrations.RenameField(
            model_name='material',
            old_name='unidad_medida_new',
            new_name='unidad_medida',
        ),
        migrations.RenameField(
            model_name='material',
            old_name='unidad_manejo_new',
            new_name='unidad_manejo',
        ),
        migrations.AlterField(
            model_name='material',
            name='unidad_medida',
            field=models.ForeignKey(default=catalogo_models._default_unidad_medida, help_text='Unidad usada para grosor y largo.', on_delete=django.db.models.deletion.PROTECT, related_name='materiales_medida', to='catalogo.unidadmedida'),
        ),
        migrations.AlterField(
            model_name='material',
            name='unidad_manejo',
            field=models.ForeignKey(default=catalogo_models._default_tipo_manejo_stock, help_text='Cómo se cuenta el stock de este consumible: por unidad suelta, por empaque (caja, bolsa, kit, millar, etc.) o por rollo con conversión de unidad.', on_delete=django.db.models.deletion.PROTECT, related_name='materiales', to='catalogo.tipomanejostock'),
        ),
    ]
