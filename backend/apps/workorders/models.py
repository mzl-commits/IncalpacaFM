
import uuid

from django.conf import settings
from django.db import models

from apps.incidents.models import Incident
from apps.assets.storage import private_asset_photo_storage


class WorkOrder(models.Model):
    class OrderType(models.TextChoices):
        WORK = "OT", "Orden de trabajo"
        CLEANING = "OL", "Orden de limpieza"
        SERVICE = "OS", "Orden de servicio"

    class Status(models.TextChoices):
        SCHEDULED = "PROGRAMADA", "Programada"
        PENDING_RESCHEDULE = "PENDIENTE_REPROGRAMACION", "Pendiente de reprogramación"
        IN_PROGRESS = "EN_PROCESO", "En proceso"
        SUPERVISION = "PENDIENTE_DE_SUPERVISION", "Pendiente de supervisión"
        ADMIN_REVIEW = "PENDIENTE_DE_VALIDACION", "Pendiente de validación"
        CONFORMITY = "PENDIENTE_DE_CONFORMIDAD", "Pendiente de conformidad"
        CLOSED = "CERRADA", "Cerrada"
        RETURNED = "DEVUELTA", "Devuelta"
        CANCELLED = "CANCELADA", "Cancelada"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=24, unique=True)
    order_type = models.CharField(max_length=2, choices=OrderType.choices, default=OrderType.WORK)
    incident = models.ForeignKey(
        Incident, related_name="work_orders", on_delete=models.PROTECT
    )
    correction_of = models.ForeignKey(
        "self",
        related_name="correction_orders",
        null=True,
        blank=True,
        on_delete=models.PROTECT,
    )
    technician = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="technical_orders", on_delete=models.PROTECT
    )
    supporting_technicians = models.ManyToManyField(
        settings.AUTH_USER_MODEL, related_name="supporting_technical_orders", blank=True
    )
    supervisor = models.ForeignKey(
        settings.AUTH_USER_MODEL, related_name="supervised_orders", on_delete=models.PROTECT
    )
    specialty = models.CharField(max_length=100)
    admin_priority = models.CharField(max_length=20)
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.SCHEDULED)
    scheduled_date = models.DateField()
    scheduled_start_time = models.TimeField(default="08:00")
    planned_hours = models.PositiveSmallIntegerField(default=2)
    started_at = models.DateTimeField(null=True, blank=True)
    finished_at = models.DateTimeField(null=True, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    administrator_notes = models.TextField(blank=True)
    progress_percentage = models.PositiveSmallIntegerField(default=0)
    advances = models.JSONField(default=list)
    work_sessions = models.JSONField(default=list)
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


class WorkOrderPhoto(models.Model):
    """Private photographic evidence captured at the start and end of an OT."""

    class Stage(models.TextChoices):
        START = "INICIO", "Inicio"
        FINISH = "FINAL", "Final"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    work_order = models.ForeignKey(WorkOrder, related_name="traceability_photos", on_delete=models.PROTECT)
    stage = models.CharField(max_length=12, choices=Stage.choices)
    image = models.ImageField(
        upload_to="work_order_photos/",
        storage=private_asset_photo_storage,
    )
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="work_order_photos", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at",)
        constraints = [
            models.UniqueConstraint(fields=("work_order", "stage"), name="one_traceability_photo_per_stage"),
        ]


class WorkOrderCost(models.Model):
    class Category(models.TextChoices):
        LABOR = "MANO_OBRA", "Mano de obra"
        MATERIAL = "MATERIAL", "Material"
        SERVICE = "SERVICIO", "Servicio"
        OTHER = "OTRO", "Otro"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    work_order = models.ForeignKey(WorkOrder, related_name="cost_items", on_delete=models.PROTECT)
    category = models.CharField(max_length=16, choices=Category.choices)
    description = models.CharField(max_length=240)
    amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="work_order_costs", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("created_at",)


class WorkOrderReport(models.Model):
    class Status(models.TextChoices):
        DRAFT = "BORRADOR", "Borrador"
        ISSUED = "EMITIDO", "Emitido"
        VOID = "ANULADO", "Anulado"
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    work_order = models.ForeignKey(WorkOrder, related_name="generated_reports", on_delete=models.PROTECT)
    file = models.FileField(upload_to="work_order_reports/", storage=private_asset_photo_storage)
    generated_by = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="generated_work_order_reports", on_delete=models.PROTECT)
    template_version = models.CharField(max_length=32, blank=True)
    content_hash = models.CharField(max_length=64, blank=True, db_index=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.ISSUED)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-created_at",)


class ReportTemplate(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=120, unique=True)
    scope = models.CharField(max_length=24, default="ORDEN_TRABAJO")
    sections = models.JSONField(default=list)
    version = models.CharField(max_length=32, default="1.0")
    variables = models.JSONField(default=list)
    content_hash = models.CharField(max_length=64, blank=True, db_index=True)
    status = models.CharField(max_length=12, choices=(("BORRADOR", "Borrador"), ("EMITIDO", "Emitido"), ("ANULADO", "Anulado")), default="BORRADOR")
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="report_templates", on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("name",)


class TechnicianSatisfaction(models.Model):
    """Private management record created from the public delivery survey."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    work_order = models.OneToOneField(WorkOrder, related_name="satisfaction", on_delete=models.PROTECT)
    technician = models.ForeignKey(settings.AUTH_USER_MODEL, related_name="satisfaction_records", on_delete=models.PROTECT)
    accepted = models.BooleanField()
    rating = models.PositiveSmallIntegerField(null=True, blank=True)
    comment = models.TextField(blank=True)
    submitted_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-submitted_at",)
        constraints = [models.CheckConstraint(condition=models.Q(rating__isnull=True) | models.Q(rating__gte=1, rating__lte=5), name="satisfaction_rating_between_1_and_5")]


class WorkOrderMaterial(models.Model):
    """Material usado o anticipado por el técnico durante la ejecución de una OT."""

    class Tipo(models.TextChoices):
        USADO = "USADO", "Usado"
        NECESARIO_NO_BLOQUEANTE = "NECESARIO_NO_BLOQUEANTE", "Necesario (no bloqueante)"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    work_order = models.ForeignKey(
        WorkOrder,
        related_name="materiales_usados",
        on_delete=models.PROTECT,
    )
    material = models.ForeignKey(
        "catalogo.Material",
        related_name="usos_en_ot",
        on_delete=models.PROTECT,
    )
    cantidad = models.PositiveIntegerField()
    tipo = models.CharField(
        max_length=24,
        choices=Tipo.choices,
        default=Tipo.USADO,
    )
    es_bloqueante = models.BooleanField(
        default=False,
        help_text=(
            "True cuando el técnico llega al punto en que ya no puede continuar "
            "sin este material (solo aplica cuando tipo=NECESARIO_NO_BLOQUEANTE)."
        ),
    )
    porcentaje_requerido = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        help_text="Porcentaje de avance de la OT en que el material es requerido (0-100)."
    )
    registrado_por = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        related_name="materiales_registrados_en_ot",
        on_delete=models.PROTECT,
    )
    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("creado_en",)
        verbose_name = "Material en OT"
        verbose_name_plural = "Materiales en OT"
