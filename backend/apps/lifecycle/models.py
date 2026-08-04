import uuid

from django.db import models

from apps.assets.models import Asset


class TechnicalDiagnosis(models.Model):
    class Result(models.TextChoices):
        REPAIRABLE = "REPARABLE", "Reparable"
        NOT_REPAIRABLE = "NO_REPARABLE", "No reparable"
        NOT_VIABLE = "REPAIR_NOT_VIABLE", "Reparación no viable"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    work_order_id = models.CharField(max_length=80, unique=True)
    work_order_code = models.CharField(max_length=40)
    asset = models.ForeignKey(Asset, related_name="technical_diagnoses", on_delete=models.PROTECT)
    evaluator_name = models.CharField(max_length=160)
    result = models.CharField(max_length=24, choices=Result.choices)
    description = models.TextField()
    probable_cause = models.TextField(blank=True)
    operational_risk = models.CharField(max_length=20, blank=True)
    affected_components = models.TextField(blank=True)
    technical_justification = models.TextField(blank=True)
    estimated_repair_cost = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    estimated_current_value = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    evidence = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)

class RetirementRequest(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDIENTE", "Pendiente"
        IN_REVIEW = "EN_EVALUACION", "En evaluación"
        APPROVED = "APROBADA", "Aprobada"
        REJECTED = "RECHAZADA", "Rechazada"
        CORRECTION = "SUBSANACION", "Requiere subsanación"
        PENDING_DISPOSAL = "PENDIENTE_DISPOSICION", "Pendiente de disposición"
        CLOSED = "CERRADA", "Cerrada"

    class Method(models.TextChoices):
        PENDING = "POR_DEFINIR", "Por definir"
        SALE = "VENTA", "Venta"
        RECYCLING = "RECICLAJE", "Reciclaje"
        DISCARD = "DESECHO", "Desecho"
        DONATION = "DONACION", "Donación"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=40, unique=True)
    asset = models.ForeignKey(Asset, related_name="retirement_requests", on_delete=models.PROTECT)
    diagnosis = models.OneToOneField(TechnicalDiagnosis, related_name="retirement_request", on_delete=models.PROTECT)
    recommendation = models.CharField(max_length=16, choices=Method.choices)
    requested_by = models.CharField(max_length=160)
    supervisor_name = models.CharField(max_length=160)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.PENDING)
    decision_reason = models.TextField(blank=True)
    decision_by = models.CharField(max_length=160, blank=True)
    decision_at = models.DateTimeField(null=True, blank=True)
    approved_method = models.CharField(max_length=16, choices=Method.choices, blank=True)
    disposal = models.JSONField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-created_at",)
