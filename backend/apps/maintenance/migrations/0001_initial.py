import datetime
import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models
from django.utils import timezone


def seed_asset_histories(apps, schema_editor):
    Asset = apps.get_model('assets', 'Asset')
    AssetAssignment = apps.get_model('assets', 'AssetAssignment')
    AssignableResponsible = apps.get_model('assets', 'AssignableResponsible')
    Location = apps.get_model('assets', 'Location')
    RepairRecord = apps.get_model('maintenance', 'RepairRecord')
    User = apps.get_model(*settings.AUTH_USER_MODEL.split('.'))
    user, _ = User.objects.get_or_create(username='facility.demo')
    responsibles = list(AssignableResponsible.objects.filter(active=True).order_by('display_name'))
    locations = list(Location.objects.filter(active=True).order_by('building', 'area'))
    now = timezone.now()

    for index, asset in enumerate(Asset.objects.order_by('created_at'), start=1):
        if responsibles:
            AssetAssignment.objects.get_or_create(
                asset=asset,
                responsible=responsibles[index % len(responsibles)],
                status='FINALIZADA',
                change_reason='Dato de prueba: custodia anterior',
                defaults={
                    'location': locations[index % len(locations)] if locations else None,
                    'start_date': now - datetime.timedelta(days=240 + index * 7),
                    'end_date': now - datetime.timedelta(days=120 + index * 3),
                    'registered_by': user,
                },
            )
        RepairRecord.objects.get_or_create(
            work_order=f'OT-TEST-{index:05d}-01',
            defaults={
                'asset': asset, 'type': 'PREVENTIVO', 'status': 'COMPLETADO',
                'reported_at': now - datetime.timedelta(days=95 + index),
                'completed_at': now - datetime.timedelta(days=94 + index),
                'issue': 'Mantenimiento preventivo programado.',
                'work_performed': 'Limpieza, ajuste general y verificación de funcionamiento.',
                'technician_name': 'Carlos Huamán',
                'provider': 'Equipo interno de mantenimiento', 'cost': '85.00',
                'resulting_condition': 'Operativo', 'registered_by': user,
            },
        )
        RepairRecord.objects.get_or_create(
            work_order=f'OT-TEST-{index:05d}-02',
            defaults={
                'asset': asset, 'type': 'CORRECTIVO', 'status': 'COMPLETADO',
                'reported_at': now - datetime.timedelta(days=42 + index),
                'completed_at': now - datetime.timedelta(days=40 + index),
                'issue': 'Desgaste detectado durante la inspección.',
                'work_performed': 'Reemplazo de componente desgastado y prueba operativa.',
                'technician_name': 'María Quispe',
                'provider': 'Servicios Técnicos Andinos', 'cost': '240.00',
                'resulting_condition': 'Bueno', 'registered_by': user,
            },
        )


def remove_seed_data(apps, schema_editor):
    apps.get_model('maintenance', 'RepairRecord').objects.filter(work_order__startswith='OT-TEST-').delete()
    apps.get_model('assets', 'AssetAssignment').objects.filter(
        change_reason='Dato de prueba: custodia anterior').delete()


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        ('assets', '0002_alter_asset_assignment_status'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]
    operations = [
        migrations.CreateModel(
            name='RepairRecord',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('work_order', models.CharField(max_length=32, unique=True)),
                ('type', models.CharField(choices=[('CORRECTIVO', 'Correctivo'), ('PREVENTIVO', 'Preventivo'), ('INSPECCION', 'Inspección técnica')], max_length=16)),
                ('status', models.CharField(choices=[('COMPLETADO', 'Completado'), ('EN_PROCESO', 'En proceso'), ('CANCELADO', 'Cancelado')], default='COMPLETADO', max_length=16)),
                ('reported_at', models.DateTimeField()),
                ('completed_at', models.DateTimeField(blank=True, null=True)),
                ('issue', models.TextField()),
                ('work_performed', models.TextField()),
                ('technician_name', models.CharField(max_length=160)),
                ('provider', models.CharField(blank=True, max_length=160)),
                ('cost', models.DecimalField(decimal_places=2, default=0, max_digits=12)),
                ('resulting_condition', models.CharField(max_length=40)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('asset', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='repair_records', to='assets.asset')),
                ('registered_by', models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ('-reported_at',)},
        ),
        migrations.RunPython(seed_asset_histories, remove_seed_data),
    ]
