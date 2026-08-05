import uuid

from django.conf import settings
from django.db import models


class PrivacyNotice(models.Model):
    class Context(models.TextChoices):
        GENERAL = "GENERAL", "General"
        LOGIN = "LOGIN", "Inicio de sesión"
        REPORT = "REPORTE", "Reporte de incidencia"
        EVIDENCE = "EVIDENCIA", "Fotos y evidencias"
        SIGNATURE = "FIRMA", "Firmas y actas"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    version = models.CharField(max_length=30, unique=True)
    title = models.CharField(max_length=180)
    content = models.TextField()
    contexts = models.JSONField(default=list)
    effective_from = models.DateField()
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-effective_from", "-created_at")


class PrivacyAcknowledgement(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    notice = models.ForeignKey(PrivacyNotice, related_name="acknowledgements", on_delete=models.PROTECT)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    context = models.CharField(max_length=20, choices=PrivacyNotice.Context.choices)
    subject_reference = models.CharField(max_length=180, blank=True)
    accepted = models.BooleanField(default=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=("context", "created_at")), models.Index(fields=("user", "created_at"))]
        ordering = ("-created_at",)


class DataSubjectRequest(models.Model):
    class RequestType(models.TextChoices):
        ACCESS = "ACCESO", "Acceso"
        RECTIFICATION = "RECTIFICACION", "Rectificación"
        CANCELLATION = "CANCELACION", "Cancelación"
        OPPOSITION = "OPOSICION", "Oposición"

    class Status(models.TextChoices):
        RECEIVED = "RECIBIDA", "Recibida"
        REVIEW = "EN_REVISION", "En revisión"
        RESOLVED = "RESUELTA", "Resuelta"
        REJECTED = "RECHAZADA", "Rechazada"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=32, unique=True)
    requester_name = models.CharField(max_length=180)
    requester_email = models.EmailField()
    requester_document = models.CharField(max_length=80, blank=True)
    request_type = models.CharField(max_length=20, choices=RequestType.choices)
    description = models.TextField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.RECEIVED)
    due_date = models.DateField(null=True, blank=True)
    response = models.TextField(blank=True)
    handled_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, related_name="handled_arco_requests", on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ("-created_at",)


class ProcessingInventory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=180, unique=True)
    purpose = models.TextField()
    legal_basis = models.CharField(max_length=240)
    data_categories = models.JSONField(default=list)
    data_subjects = models.CharField(max_length=300)
    recipients = models.CharField(max_length=300, blank=True)
    systems = models.CharField(max_length=300)
    retention_rule = models.CharField(max_length=300)
    security_measures = models.TextField()
    owner = models.CharField(max_length=160)
    active = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = "inventario de tratamientos"
        ordering = ("name",)


class PersonalDataIncident(models.Model):
    class Status(models.TextChoices):
        DETECTED = "DETECTADO", "Detectado"
        CONTAINED = "CONTENIDO", "Contenido"
        INVESTIGATING = "INVESTIGANDO", "En investigación"
        CLOSED = "CERRADO", "Cerrado"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(max_length=32, unique=True)
    title = models.CharField(max_length=180)
    description = models.TextField()
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.DETECTED)
    severity = models.CharField(max_length=20, choices=(("BAJA", "Baja"), ("MEDIA", "Media"), ("ALTA", "Alta"), ("CRITICA", "Crítica")))
    affected_categories = models.JSONField(default=list)
    affected_subjects_count = models.PositiveIntegerField(default=0)
    containment_actions = models.TextField(blank=True)
    authority_notified_at = models.DateTimeField(null=True, blank=True)
    subjects_notified_at = models.DateTimeField(null=True, blank=True)
    detected_at = models.DateTimeField()
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("-detected_at",)
