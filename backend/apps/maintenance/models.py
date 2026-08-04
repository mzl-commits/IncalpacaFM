import uuid

from django.contrib.auth import get_user_model
from django.db import models

from apps.assets.models import Asset


class RepairRecord(models.Model):
    class Type(models.TextChoices):
        CORRECTIVE = 'CORRECTIVO', 'Correctivo'
        PREVENTIVE = 'PREVENTIVO', 'Preventivo'
        INSPECTION = 'INSPECCION', 'Inspección técnica'

    class Status(models.TextChoices):
        COMPLETED = 'COMPLETADO', 'Completado'
        IN_PROGRESS = 'EN_PROCESO', 'En proceso'
        CANCELLED = 'CANCELADO', 'Cancelado'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    asset = models.ForeignKey(Asset, related_name='repair_records', on_delete=models.PROTECT)
    work_order = models.CharField(max_length=32, unique=True)
    type = models.CharField(max_length=16, choices=Type.choices)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.COMPLETED)
    reported_at = models.DateTimeField()
    completed_at = models.DateTimeField(null=True, blank=True)
    issue = models.TextField()
    work_performed = models.TextField()
    technician_name = models.CharField(max_length=160)
    provider = models.CharField(max_length=160, blank=True)
    cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    resulting_condition = models.CharField(max_length=40)
    registered_by = models.ForeignKey(get_user_model(), on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ('-reported_at',)
