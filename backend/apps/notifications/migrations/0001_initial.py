import uuid

from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Notification',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('recipient_email', models.EmailField(max_length=254)),
                ('event', models.CharField(db_index=True, max_length=80)),
                ('subject', models.CharField(max_length=200)),
                ('body', models.TextField()),
                ('html_body', models.TextField(blank=True)),
                ('context', models.JSONField(blank=True, default=dict)),
                ('entity_type', models.CharField(blank=True, max_length=80)),
                ('entity_id', models.CharField(blank=True, max_length=80)),
                ('dedupe_key', models.CharField(max_length=64, unique=True)),
                ('status', models.CharField(choices=[('PENDIENTE', 'Pendiente'), ('ENVIADA', 'Enviada'), ('ERROR', 'Error'), ('CANCELADA', 'Cancelada')], default='PENDIENTE', max_length=16)),
                ('attempts', models.PositiveSmallIntegerField(default=0)),
                ('max_attempts', models.PositiveSmallIntegerField(default=3)),
                ('available_at', models.DateTimeField()),
                ('sent_at', models.DateTimeField(blank=True, null=True)),
                ('message_id', models.CharField(blank=True, max_length=255)),
                ('last_error', models.CharField(blank=True, max_length=500)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('recipient', models.ForeignKey(on_delete=models.deletion.PROTECT, related_name='email_notifications', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ('-created_at',)},
        ),
        migrations.AddIndex(
            model_name='notification',
            index=models.Index(fields=['status', 'available_at'], name='idx_notification_queue'),
        ),
        migrations.AddIndex(
            model_name='notification',
            index=models.Index(fields=['recipient', 'status'], name='idx_notification_recipient'),
        ),
    ]
