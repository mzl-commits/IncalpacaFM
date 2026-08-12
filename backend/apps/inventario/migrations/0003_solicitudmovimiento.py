from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('inventario', '0002_movimiento_cantidad_cajas_alter_movimiento_cantidad'),
        ('catalogo', '0012_ampliar_unidad_manejo_choices'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='SolicitudMovimiento',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('tipo', models.CharField(
                    choices=[
                        ('salida_material', 'Salida de material'),
                        ('salida_pieza',    'Salida de pieza'),
                        ('baja_material',   'Baja de material'),
                        ('baja_pieza',      'Baja de pieza'),
                    ],
                    max_length=20,
                )),
                ('piezas_hijas_ids', models.JSONField(
                    blank=True, default=list,
                    help_text='IDs de piezas hijas a mover en una salida parcial de estuche.',
                )),
                ('cantidad', models.PositiveIntegerField(default=1)),
                ('cantidad_cajas', models.PositiveIntegerField(blank=True, null=True)),
                ('referencia_externa', models.CharField(blank=True, max_length=50)),
                ('observaciones', models.TextField(blank=True)),
                ('estado', models.CharField(
                    choices=[
                        ('pendiente', 'Pendiente'),
                        ('aprobada',  'Aprobada'),
                        ('rechazada', 'Rechazada'),
                    ],
                    default='pendiente', max_length=10,
                )),
                ('creado_en', models.DateTimeField(auto_now_add=True)),
                ('resuelto_en', models.DateTimeField(blank=True, null=True)),
                ('motivo_rechazo', models.TextField(blank=True)),
                ('material', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='solicitudes_movimiento',
                    to='catalogo.material',
                )),
                ('movimiento', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='solicitud_origen',
                    to='inventario.movimiento',
                )),
                ('pieza', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='solicitudes_movimiento',
                    to='catalogo.pieza',
                )),
                ('resuelto_por', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='solicitudes_movimiento_resueltas',
                    to=settings.AUTH_USER_MODEL,
                )),
                ('solicitado_por', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    related_name='solicitudes_movimiento_creadas',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'ordering': ['-creado_en'],
            },
        ),
    ]
