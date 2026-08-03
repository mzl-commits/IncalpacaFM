
import uuid

from django.conf import settings
from django.db import models


class Notification(models.Model):
    class Status(models.TextChoices):
        PENDING = 'PENDIENTE', 'Pendiente'
        SENT = 'ENVIADA', 'Enviada'
        ERROR = 'ERROR', 'Error'
        CANCELLED = 'CANCELADA', 'Cancelada'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name='email_notifications',
        on_delete=models.PROTECT,
    )
    recipient_email = models.EmailField()
    event = models.CharField(max_length=80, db_index=True)
    subject = models.CharField(max_length=200)
    body = models.TextField()
    html_body = models.TextField(blank=True)
    context = models.JSONField(default=dict, blank=True)
    entity_type = models.CharField(max_length=80, blank=True)
    entity_id = models.CharField(max_length=80, blank=True)
    dedupe_key = models.CharField(max_length=64, unique=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    attempts = models.PositiveSmallIntegerField(default=0)
    max_attempts = models.PositiveSmallIntegerField(default=3)
    available_at = models.DateTimeField()
    sent_at = models.DateTimeField(null=True, blank=True)
    message_id = models.CharField(max_length=255, blank=True)
    last_error = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('-created_at',)
        indexes = [
            models.Index(fields=('status', 'available_at'), name='idx_notification_queue'),
            models.Index(fields=('recipient', 'status'), name='idx_notification_recipient'),
        ]

    def __str__(self):
        return f'{self.event} -> {self.recipient_email} ({self.status})'
