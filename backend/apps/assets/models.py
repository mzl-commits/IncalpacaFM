
import secrets
import uuid

from django.contrib.auth import get_user_model
from django.db import models
from django.db.models import Q


def generate_public_token():
    return secrets.token_urlsafe(24)


class UUIDModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class Taxonomy(UUIDModel):
    asset_type = models.CharField(max_length=100)
    category = models.CharField(max_length=100)
    subcategory = models.CharField(max_length=100)
    specialty = models.CharField(max_length=80)
    active = models.BooleanField(default=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=('asset_type', 'category', 'subcategory'), name='uq_asset_taxonomy')]


class Location(UUIDModel):
    zone = models.CharField(max_length=100)
    building = models.CharField(max_length=100)
    area = models.CharField(max_length=100)
    room = models.CharField(max_length=100)
    specific_location = models.CharField(max_length=160, blank=True)
    common_space = models.BooleanField(default=False)
    active = models.BooleanField(default=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=('zone', 'building', 'area', 'room'), name='uq_asset_location')]


class AssignableResponsible(UUIDModel):
    class Type(models.TextChoices):
        PERSON = 'PERSONA', 'Persona'
        AREA = 'AREA', 'Área'
        COMMON_SPACE = 'ESPACIO_COMUN', 'Espacio común'

    type = models.CharField(max_length=20, choices=Type.choices)
    external_reference = models.CharField(max_length=60, unique=True)
    display_name = models.CharField(max_length=160)
    area_name = models.CharField(max_length=120, blank=True)
    location = models.ForeignKey(Location, null=True, blank=True, on_delete=models.PROTECT)
    active = models.BooleanField(default=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                condition=(Q(type='ESPACIO_COMUN', location__isnull=False) | (~Q(type='ESPACIO_COMUN') & Q(location__isnull=True))),
                name='ck_common_space_location',
            )
        ]


class Asset(UUIDModel):
    class EntryType(models.TextChoices):
        PURCHASE = 'purchase', 'Compra'
        OWN = 'own_creation', 'Creación propia'
        DONATION = 'donation', 'Regalo o donación'
        RENTAL = 'rental', 'Alquiler'

    code = models.CharField(max_length=32, unique=True)
    public_token = models.CharField(max_length=48, unique=True, default=generate_public_token)
    entry_type = models.CharField(max_length=20, choices=EntryType.choices)
    name = models.CharField(max_length=180)
    description = models.TextField()
    brand = models.CharField(max_length=100, blank=True)
    model = models.CharField(max_length=100, blank=True)
    serial_number = models.CharField(max_length=120, blank=True, null=True, unique=True)
    condition = models.CharField(max_length=40)
    criticality = models.CharField(max_length=20, default='Media')
    administrative_status = models.CharField(max_length=30, default='Registrado')
    operational_status = models.CharField(max_length=30, default='No evaluado')
    assignment_status = models.CharField(max_length=30, default='Pendiente')
    taxonomy = models.ForeignKey(Taxonomy, null=True, blank=True, on_delete=models.PROTECT)
    location = models.ForeignKey(Location, null=True, blank=True, on_delete=models.PROTECT)
    entry_payload = models.JSONField(default=dict)
    registered_by = models.ForeignKey(get_user_model(), on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class AssetAssignment(UUIDModel):
    asset = models.ForeignKey(Asset, related_name='assignments', on_delete=models.PROTECT)
    responsible = models.ForeignKey(AssignableResponsible, on_delete=models.PROTECT)
    location = models.ForeignKey(Location, null=True, blank=True, on_delete=models.PROTECT)
    start_date = models.DateTimeField()
    end_date = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, default='ACTIVA')
    change_reason = models.TextField()
    registered_by = models.ForeignKey(get_user_model(), on_delete=models.PROTECT)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=('asset',), condition=Q(status='ACTIVA'), name='uq_active_assignment_per_asset'),
            models.CheckConstraint(condition=Q(status__in=['ACTIVA', 'FINALIZADA', 'ANULADA']), name='ck_assignment_status'),
        ]
