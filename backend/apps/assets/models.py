
import secrets
import uuid
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.core.validators import MaxValueValidator, MinValueValidator, RegexValidator
from django.db import models
from django.db.models import Q

from .storage import (
    private_asset_photo_storage,
    private_facility_plan_storage,
    private_location_map_storage,
)


def generate_public_token():
    return secrets.token_urlsafe(24)


class UUIDModel(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    class Meta:
        abstract = True


class Taxonomy(UUIDModel):
    class ReviewStatus(models.TextChoices):
        VALIDATED = 'VALIDATED', 'Validada'
        REVIEW = 'REVIEW', 'Revisar'

    prefix = models.CharField(
        max_length=16,
        unique=True,
        null=True,
        blank=True,
        validators=[
            RegexValidator(
                regex=r'^[A-Z][A-Z0-9]{0,15}$',
                message='El prefijo debe iniciar con una letra y usar solo A-Z y 0-9.',
            )
        ],
    )
    name = models.CharField(max_length=160, blank=True)
    asset_type = models.CharField(max_length=100)
    category = models.CharField(max_length=100)
    subcategory = models.CharField(max_length=100)
    specialty = models.CharField(max_length=80)
    sequence_digits = models.PositiveSmallIntegerField(default=4)
    default_criticality = models.CharField(max_length=20, default='Media')
    useful_life_years = models.PositiveSmallIntegerField(null=True, blank=True)
    preventive_frequency_months = models.PositiveSmallIntegerField(null=True, blank=True)
    requires_maintenance = models.BooleanField(default=False)
    requires_certification = models.BooleanField(default=False)
    issuance_enabled = models.BooleanField(default=True)
    review_status = models.CharField(
        max_length=20, choices=ReviewStatus.choices, default=ReviewStatus.VALIDATED,
    )
    aliases = models.JSONField(default=list, blank=True)
    canonical_prefix = models.CharField(max_length=16, blank=True)
    source_version = models.CharField(max_length=40, blank=True)
    notes = models.TextField(blank=True)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ('prefix', 'name')
        constraints = [
            models.CheckConstraint(
                condition=Q(sequence_digits__gte=3, sequence_digits__lte=8),
                name='ck_taxonomy_sequence_digits',
            ),
        ]

    def save(self, *args, **kwargs):
        self.prefix = self.prefix.strip().upper() if self.prefix else None
        self.canonical_prefix = (
            self.canonical_prefix.strip().upper()
            if self.canonical_prefix
            else (self.prefix or '')
        )
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.prefix or "SIN-PREFIJO"} · {self.name or self.subcategory}'


class TaxonomySequence(UUIDModel):
    taxonomy = models.OneToOneField(Taxonomy, related_name='sequence', on_delete=models.PROTECT)
    last_value = models.PositiveBigIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.taxonomy.prefix}: {self.last_value}'


class AssetInternalSequence(UUIDModel):
    year = models.PositiveSmallIntegerField(unique=True)
    last_value = models.PositiveBigIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'INC-BIEN-{self.year}: {self.last_value}'


class Location(UUIDModel):
    location_code = models.CharField(max_length=20, blank=True, db_index=True)
    source_company = models.CharField(max_length=100, blank=True)
    source_row = models.PositiveIntegerField(null=True, blank=True)
    source_version = models.CharField(max_length=80, blank=True)
    requires_review = models.BooleanField(default=False)
    review_notes = models.CharField(max_length=240, blank=True)
    site = models.CharField(max_length=100, blank=True, default='')
    zone = models.CharField(max_length=100)
    building = models.CharField(max_length=100)
    level = models.CharField(max_length=100, blank=True, default='')
    area = models.CharField(max_length=100)
    room = models.CharField(max_length=100)
    specific_location = models.CharField(max_length=160, blank=True)
    headcount = models.PositiveIntegerField(null=True, blank=True, verbose_name="Usuarios (Capacidad)")
    square_meters = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True, verbose_name="Tamaño (m2)")
    common_space = models.BooleanField(default=False)
    active = models.BooleanField(default=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=('site', 'zone', 'building', 'level', 'area', 'room', 'location_code'), name='uq_asset_location')]

    def __str__(self):
        code = f'{self.location_code} · ' if self.location_code else ''
        return f'{code}{self.zone} / {self.building} / {self.area} / {self.room}'


class BuildingArea(UUIDModel):
    """Superficie declarada para un edificio, independiente de sus ambientes."""

    site = models.CharField(max_length=100, blank=True, default='')
    zone = models.CharField(max_length=100)
    building = models.CharField(max_length=100)
    square_meters = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name="TamaÃ±o del edificio (m2)",
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=("site", "zone", "building"),
                name="uq_building_area_identity",
            )
        ]
        verbose_name = "Superficie de edificio"
        verbose_name_plural = "Superficies de edificios"

    def __str__(self):
        return f"{self.zone} / {self.building}"


class LocationMap(UUIDModel):
    location = models.ForeignKey(
        Location,
        related_name='reference_maps',
        on_delete=models.PROTECT,
    )
    version = models.PositiveIntegerField()
    image = models.FileField(
        upload_to='location_maps/',
        storage=private_location_map_storage,
    )
    original_filename = models.CharField(max_length=255)
    image_sha256 = models.CharField(max_length=64)
    width = models.PositiveIntegerField()
    height = models.PositiveIntegerField()
    description = models.CharField(max_length=240, blank=True)
    active = models.BooleanField(default=True)
    uploaded_by = models.ForeignKey(get_user_model(), on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=('location', 'version'),
                name='uq_location_map_version',
            ),
            models.UniqueConstraint(
                fields=('location',),
                condition=Q(active=True),
                name='uq_active_map_per_location',
            ),
        ]
        indexes = [
            models.Index(
                fields=('location', 'active'),
                name='idx_location_map_active',
            ),
        ]

    def __str__(self):
        return f'{self.location} · mapa v{self.version}'


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
    fm_code = models.CharField(max_length=32, unique=True, null=True, blank=True)
    fm_sequence_value = models.PositiveBigIntegerField(null=True, blank=True)
    public_token = models.CharField(max_length=48, unique=True, default=generate_public_token)
    entry_type = models.CharField(max_length=20, choices=EntryType.choices)
    name = models.CharField(max_length=180)
    description = models.TextField()
    photo = models.ImageField(
        upload_to='asset_photos/',
        storage=private_asset_photo_storage,
        null=True,
        blank=True,
    )
    brand = models.CharField(max_length=100, blank=True)
    model = models.CharField(max_length=100, blank=True)
    serial_number = models.CharField(max_length=120, blank=True, null=True, unique=True)
    condition = models.CharField(max_length=40)
    criticality = models.CharField(max_length=20, default='Media')
    administrative_status = models.CharField(max_length=30, default='Registrado')
    operational_status = models.CharField(max_length=30, default='No evaluado')
    assignment_status = models.CharField(max_length=30, default='Sin asignar')
    taxonomy = models.ForeignKey(Taxonomy, null=True, blank=True, on_delete=models.PROTECT)
    location = models.ForeignKey(Location, null=True, blank=True, on_delete=models.PROTECT)
    location_map = models.ForeignKey(
        LocationMap,
        null=True,
        blank=True,
        related_name='assets',
        on_delete=models.PROTECT,
    )
    location_marker_x = models.DecimalField(
        max_digits=9,
        decimal_places=8,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0')), MaxValueValidator(Decimal('1'))],
    )
    location_marker_y = models.DecimalField(
        max_digits=9,
        decimal_places=8,
        null=True,
        blank=True,
        validators=[MinValueValidator(Decimal('0')), MaxValueValidator(Decimal('1'))],
    )
    entry_payload = models.JSONField(default=dict)
    registered_by = models.ForeignKey(get_user_model(), on_delete=models.PROTECT)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=('taxonomy', 'fm_sequence_value'),
                condition=Q(fm_sequence_value__isnull=False),
                name='uq_asset_taxonomy_sequence',
            ),
            models.CheckConstraint(
                condition=(
                    Q(fm_code__isnull=True, fm_sequence_value__isnull=True)
                    | Q(fm_code__isnull=False, fm_sequence_value__isnull=False)
                ),
                name='ck_asset_fm_code_pair',
            ),
            models.CheckConstraint(
                condition=(
                    Q(fm_sequence_value__isnull=True)
                    | Q(fm_sequence_value__gte=1)
                ),
                name='ck_asset_fm_sequence_positive',
            ),
            models.CheckConstraint(
                condition=(
                    Q(fm_code__isnull=True)
                    | Q(taxonomy__isnull=False)
                ),
                name='ck_asset_fm_code_taxonomy',
            ),
            models.CheckConstraint(
                condition=(
                    Q(
                        location_map__isnull=True,
                        location_marker_x__isnull=True,
                        location_marker_y__isnull=True,
                    )
                    | Q(
                        location_map__isnull=False,
                        location_marker_x__isnull=False,
                        location_marker_y__isnull=False,
                    )
                ),
                name='ck_asset_location_marker_pair',
            ),
            models.CheckConstraint(
                condition=(
                    Q(location_marker_x__isnull=True)
                    | Q(location_marker_x__gte=0, location_marker_x__lte=1)
                ),
                name='ck_asset_location_marker_x',
            ),
            models.CheckConstraint(
                condition=(
                    Q(location_marker_y__isnull=True)
                    | Q(location_marker_y__gte=0, location_marker_y__lte=1)
                ),
                name='ck_asset_location_marker_y',
            ),
        ]


class FacilityPlan(UUIDModel):
    code = models.CharField(max_length=40, unique=True)
    name = models.CharField(max_length=160)
    version = models.CharField(max_length=40)
    level_name = models.CharField(max_length=100)
    source_filename = models.CharField(max_length=255)
    source_sha256 = models.CharField(max_length=64)
    image = models.FileField(
        upload_to='facility_plans/',
        storage=private_facility_plan_storage,
    )
    min_x = models.DecimalField(max_digits=20, decimal_places=6)
    min_y = models.DecimalField(max_digits=20, decimal_places=6)
    max_x = models.DecimalField(max_digits=20, decimal_places=6)
    max_y = models.DecimalField(max_digits=20, decimal_places=6)
    active = models.BooleanField(default=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'{self.code} · {self.name} ({self.version})'


class FacilityPlanMarker(UUIDModel):
    class Status(models.TextChoices):
        MATCHED = 'MATCHED', 'Vinculado'
        TAXONOMY_ONLY = 'TAXONOMY_ONLY', 'Solo taxonomía'
        PLACEHOLDER = 'PLACEHOLDER', 'Marcador pendiente'
        UNKNOWN = 'UNKNOWN', 'Desconocido'

    plan = models.ForeignKey(FacilityPlan, related_name='markers', on_delete=models.CASCADE)
    source_index = models.PositiveIntegerField(validators=[MinValueValidator(0)])
    raw_code = models.CharField(max_length=64, blank=True)
    label = models.CharField(max_length=255, blank=True)
    layer = models.CharField(max_length=120, blank=True)
    source_x = models.DecimalField(max_digits=20, decimal_places=6)
    source_y = models.DecimalField(max_digits=20, decimal_places=6)
    normalized_x = models.DecimalField(
        max_digits=9,
        decimal_places=8,
        validators=[MinValueValidator(Decimal('0')), MaxValueValidator(Decimal('1'))],
    )
    normalized_y = models.DecimalField(
        max_digits=9,
        decimal_places=8,
        validators=[MinValueValidator(Decimal('0')), MaxValueValidator(Decimal('1'))],
    )
    taxonomy = models.ForeignKey(Taxonomy, null=True, blank=True, on_delete=models.PROTECT)
    asset = models.ForeignKey(Asset, null=True, blank=True, on_delete=models.SET_NULL)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.UNKNOWN)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=('plan', 'source_index'),
                name='uq_plan_marker_source',
            ),
            models.CheckConstraint(
                condition=Q(normalized_x__gte=0, normalized_x__lte=1),
                name='ck_marker_norm_x',
            ),
            models.CheckConstraint(
                condition=Q(normalized_y__gte=0, normalized_y__lte=1),
                name='ck_marker_norm_y',
            ),
        ]
        indexes = [
            models.Index(fields=('plan', 'status'), name='idx_marker_plan_status'),
            models.Index(fields=('plan', 'taxonomy'), name='idx_marker_plan_tax'),
            models.Index(fields=('raw_code',), name='idx_marker_raw_code'),
        ]

    def __str__(self):
        return f'{self.plan.code} #{self.source_index}: {self.raw_code or self.label}'


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
