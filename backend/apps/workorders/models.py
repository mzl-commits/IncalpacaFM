
import uuid

from django.conf import settings
from django.db import models

from apps.incidents.models import Incident


class WorkOrder(models.Model):
    class Status(models.TextChoices):
        SCHEDULED = "PROGRAMADA", "Programada"
        IN_PROGRESS = "EN_PROCESO", "En proceso"
        SUPERVISION = "PENDIENTE_DE_SUPERVISION", "Pendiente de supervisión"
        ADMIN_REVIEW = "PENDIENTE_DE_VALIDACION", "Pendiente de validación"
        CONFORMITY = "PENDIENTE_DE_CONFORMIDAD", "Pendiente de conformidad"
        CLOSED = "CERRADA", "Cerrada"
        RETURNED = "DEVUELTA", "Devuelta"
        CANCELLED = "CANCELADA", "Cancelada"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=24, unique=True)
    incident = models.OneToOneField(
        Incident, related_name="work_order", on_delete=models.PROTECT
    )
    technician = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="technical_orders", on_delete=models.PROTECT
    )
    supervisor = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="supervised_orders", on_delete=models.PROTECT
    )
    specialty = models.CharField(max_length=100)
    admin_priority = models.CharField(max_length=20)
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.SCHEDULED)
    scheduled_date = models.DateField()
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    administrator_notes = models.TextField(blank=True)
    progress_percentage = models.PositiveSmallIntegerField(default=0)
    advances = models.JSONField(default=list)
    diagnosis = models.JSONField(default=dict)
    supervisor_validation = models.JSONField(default=dict)
    administrator_validation = models.JSONField(default=dict)
    conformity = models.JSONField(default=dict)
    recommendation_snapshot = models.JSONField(default=dict)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="created_orders", on_delete=models.PROTECT
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
