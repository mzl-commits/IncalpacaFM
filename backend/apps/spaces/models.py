import re
import uuid

from django.core.exceptions import ValidationError
from django.core.validators import RegexValidator
from django.db import models
from django.db.models import Q

SITE_CODE_PATTERN = r"^[A-Z]{3}[0-9]$"
SEGMENT_CODE_PATTERN = r"^[A-Z][A-Z0-9]{0,15}$"
_SPACE_SEPARATOR_RE = re.compile(r"\s+")


def normalize_space_text(value: str) -> str:
    return _SPACE_SEPARATOR_RE.sub(" ", (value or "").strip())


def normalize_segment_code(value: str) -> str:
    return normalize_space_text(value).upper()


class FacilitySite(models.Model):
    """Una sede o complejo físico que es la raíz de su árbol espacial."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.CharField(
        max_length=4,
        unique=True,
        validators=[
            RegexValidator(
                regex=SITE_CODE_PATTERN,
                message="El código de sede debe tener tres letras y un número (ej.: INC1).",
            )
        ],
    )
    # Estos nombres se proyectan sobre ``assets.Location`` para los ambientes
    # nuevos. Mantener el mismo límite evita que PostgreSQL rechace una
    # jerarquía válida cuando se crea su registro legado compatible.
    name = models.CharField(max_length=100)
    normalized_name = models.CharField(max_length=100, editable=False)
    address_line = models.CharField(max_length=240, blank=True)
    district = models.CharField(max_length=100, blank=True)
    province = models.CharField(max_length=100, blank=True)
    department = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, default="Perú")
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("code", "name")
        constraints = [
            models.UniqueConstraint(
                fields=("normalized_name",),
                name="uq_facility_site_normalized_name",
            ),
        ]

    def clean_fields(self, exclude=None):
        self.code = normalize_segment_code(self.code)
        super().clean_fields(exclude=exclude)

    def clean(self):
        self.name = normalize_space_text(self.name)
        self.normalized_name = self.name.casefold()
        if not self.name:
            raise ValidationError({"name": "Ingresa el nombre de la sede."})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.code} · {self.name}"


class SpaceNode(models.Model):
    """Nodo administrable para la infraestructura de una sede.

    La estructura es intencionalmente flexible: puede modelar
    sede -> macroárea -> sector -> módulo -> ambiente, o bien
    sede -> edificio -> nivel -> área -> ambiente. La taxonomía de
    bienes se conserva en ``assets.Taxonomy`` y nunca se mezcla aquí.
    """

    class Type(models.TextChoices):
        MACRO_AREA = "MACRO_AREA", "Área Macro"
        AREA = "AREA", "Área"
        MODULE = "MODULE", "Módulo de trabajo"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    site = models.ForeignKey(
        FacilitySite,
        related_name="space_nodes",
        on_delete=models.PROTECT,
    )
    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        related_name="children",
        on_delete=models.PROTECT,
    )
    node_type = models.CharField(max_length=20, choices=Type.choices)
    code_segment = models.CharField(
        max_length=16,
        validators=[
            RegexValidator(
                regex=SEGMENT_CODE_PATTERN,
                message="El segmento debe iniciar con una letra y usar solo A-Z y 0-9.",
            )
        ],
    )
    path_code = models.CharField(max_length=255, unique=True, editable=False, db_index=True)
    # La proyección de ambientes se almacena también en ``assets.Location``.
    # Los límites son deliberadamente iguales para que falle la validación de
    # forma clara antes de iniciar una transacción de sincronización.
    name = models.CharField(max_length=100)
    normalized_name = models.CharField(max_length=100, editable=False)
    square_meters = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    headcount = models.PositiveIntegerField(null=True, blank=True)
    common_space = models.BooleanField(default=False)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("path_code", "name")
        constraints = [
            models.UniqueConstraint(
                fields=("site", "code_segment"),
                condition=Q(parent__isnull=True),
                name="uq_space_root_segment",
            ),
            models.UniqueConstraint(
                fields=("parent", "code_segment"),
                condition=Q(parent__isnull=False),
                name="uq_space_sibling_segment",
            ),
            models.CheckConstraint(
                condition=Q(square_meters__isnull=True) | Q(square_meters__gt=0),
                name="ck_space_node_square_meters_positive",
            ),
        ]

    def clean_fields(self, exclude=None):
        self.code_segment = normalize_segment_code(self.code_segment)
        super().clean_fields(exclude=exclude)

    def clean(self):
        self.name = normalize_space_text(self.name)
        self.normalized_name = self.name.casefold()
        if not self.name:
            raise ValidationError({"name": "Ingresa el nombre del espacio."})
        if self.parent_id and self.parent.site_id != self.site_id:
            raise ValidationError({"parent": "El padre debe pertenecer a la misma sede."})
        
        if self.node_type == self.Type.MACRO_AREA:
            valid_prefixes = ("PP", "AD", "CO", "RE", "AL")
            if not any(self.code_segment.startswith(p) for p in valid_prefixes):
                raise ValidationError({"code_segment": "El código del Área Macro debe iniciar con PP, AD, CO, RE o AL."})
        expected_path = (
            f"{self.parent.path_code}-{self.code_segment}"
            if self.parent_id
            else f"{self.site.code}-{self.code_segment}"
        )
        if self.path_code and self.path_code != expected_path:
            raise ValidationError(
                {"path_code": "La ruta debe derivarse de la sede, padre y segmento."}
            )

    def save(self, *args, **kwargs):
        # La ruta se calcula desde services para proteger traslados y subárboles.
        self.code_segment = normalize_segment_code(self.code_segment)
        self.name = normalize_space_text(self.name)
        self.normalized_name = self.name.casefold()
        if self._state.adding and not self.path_code:
            raise ValidationError(
                "Crea SpaceNode mediante apps.spaces.services para derivar su ruta."
            )
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.path_code or self.code_segment} · {self.name}"
