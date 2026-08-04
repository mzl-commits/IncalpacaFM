
import uuid

from django.conf import settings
from django.db import models

from apps.assets.models import Asset


class Incident(models.Model):
    class Status(models.TextChoices):
        RECEIVED = "RECIBIDA", "Recibida"
        REVIEW = "EN_REVISION", "En revisión"
        ATTENDED = "APROBADA", "Aprobada para atención"
        REJECTED = "RECHAZADA", "Atención no aprobada"
        IN_PROGRESS = "EN_ATENCION", "En atención"
        CLOSED = "CERRADA", "Cerrada"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=24, unique=True)
    asset = models.ForeignKey(
        Asset, related_name="incidents", null=True, blank=True, on_delete=models.PROTECT
    )
    requester = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="reported_incidents", on_delete=models.PROTECT
    )
    request_type = models.CharField(max_length=40)
    description = models.TextField()
    requester_priority = models.CharField(max_length=20, default="MEDIA")
    project = models.BooleanField(default=False)
    location_snapshot = models.JSONField(default=dict)
    evidence = models.JSONField(default=list)
    reporter_name = models.CharField(max_length=160, blank=True)
    reporter_email = models.EmailField(blank=True)
    public_submission = models.BooleanField(default=False)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.RECEIVED)
    rejection_reason = models.TextField(blank=True)
    requester_contact = models.JSONField(blank=True, default=dict)
    impact_assessment = models.JSONField(blank=True, default=dict)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
