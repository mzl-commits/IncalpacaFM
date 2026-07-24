
import uuid

from django.contrib.auth import get_user_model
from django.db import models

from apps.assets.models import AssetAssignment


class DeliveryAct(models.Model):
    class Status(models.TextChoices):
        DRAFT = 'BORRADOR', 'Borrador'
        ISSUED = 'EMITIDA', 'Emitida'
        VOID = 'ANULADA', 'Anulada'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    assignment = models.OneToOneField(AssetAssignment, related_name='delivery_act', on_delete=models.PROTECT)
    code = models.CharField(max_length=36, unique=True)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.DRAFT)
    condition = models.CharField(max_length=40)
    accessories = models.TextField(blank=True)
    observations = models.TextField(blank=True)
    checklist = models.JSONField(default=dict)
    privacy_accepted = models.BooleanField(default=False)
    template_version = models.CharField(max_length=20, default='1.1')
    hash_sha256 = models.CharField(max_length=64, blank=True)
    issued_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(get_user_model(), on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)


class DeliveryEvidence(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    act = models.ForeignKey(DeliveryAct, related_name='evidence', on_delete=models.PROTECT)
    category = models.CharField(max_length=30)
    name = models.CharField(max_length=180)
    mime_type = models.CharField(max_length=100)
    size = models.PositiveIntegerField(default=0)
    description = models.CharField(max_length=240, blank=True)
    content_data_url = models.TextField(blank=True)
    hash_sha256 = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)


class DeliverySignature(models.Model):
    class Role(models.TextChoices):
        DELIVERER = 'ENTREGA', 'Facility Management'
        RECEIVER = 'RECIBE', 'Receptor'

    class Method(models.TextChoices):
        DRAWN = 'DIBUJADA', 'Firma dibujada'
        DIGITAL = 'CONFIRMACION', 'Confirmación digital'
        SCANNED = 'ACTA_ESCANEADA', 'Acta escaneada'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    act = models.ForeignKey(DeliveryAct, related_name='signatures', on_delete=models.PROTECT)
    role = models.CharField(max_length=10, choices=Role.choices)
    method = models.CharField(max_length=16, choices=Method.choices)
    signer_name = models.CharField(max_length=160)
    signer_role = models.CharField(max_length=120)
    consent = models.BooleanField(default=False)
    signature_data_url = models.TextField(blank=True)
    session_reference = models.CharField(max_length=64, blank=True)
    signed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=('act', 'role'), name='uq_delivery_signature_role'),
        ]


class AssignmentOperation(models.Model):
    class Type(models.TextChoices):
        REASSIGN = 'REASIGNAR', 'Reasignar'
        TRANSFER = 'TRASLADAR', 'Trasladar'
        RETURN = 'DEVOLVER', 'Devolver'

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    assignment = models.ForeignKey(AssetAssignment, related_name='operations', on_delete=models.PROTECT)
    type = models.CharField(max_length=12, choices=Type.choices)
    reason = models.TextField()
    previous_state = models.CharField(max_length=30)
    resulting_state = models.CharField(max_length=30)
    payload = models.JSONField(default=dict)
    registered_by = models.ForeignKey(get_user_model(), on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
