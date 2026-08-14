# Generated manually for the spatial hierarchy domain.

import uuid

import django.core.validators
import django.db.models.deletion
from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="FacilitySite",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                (
                    "code",
                    models.CharField(
                        max_length=4,
                        unique=True,
                        validators=[
                            django.core.validators.RegexValidator(
                                message="El código de sede debe tener tres letras y un número (ej.: INC1).",
                                regex="^[A-Z]{3}[0-9]$",
                            )
                        ],
                    ),
                ),
                ("name", models.CharField(max_length=100)),
                ("normalized_name", models.CharField(editable=False, max_length=100)),
                ("address_line", models.CharField(blank=True, max_length=240)),
                ("district", models.CharField(blank=True, max_length=100)),
                ("province", models.CharField(blank=True, max_length=100)),
                ("department", models.CharField(blank=True, max_length=100)),
                ("country", models.CharField(default="Perú", max_length=100)),
                ("active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"ordering": ("code", "name")},
        ),
        migrations.CreateModel(
            name="SpaceNode",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                (
                    "node_type",
                    models.CharField(
                        choices=[
                            ("MACRO_AREA", "Macroárea"),
                            ("SECTOR", "Sector"),
                            ("BUILDING", "Edificio"),
                            ("LEVEL", "Nivel"),
                            ("AREA", "Área"),
                            ("MODULE", "Módulo"),
                            ("ENVIRONMENT", "Ambiente"),
                            ("POINT", "Punto o ubicación específica"),
                        ],
                        max_length=20,
                    ),
                ),
                (
                    "code_segment",
                    models.CharField(
                        max_length=16,
                        validators=[
                            django.core.validators.RegexValidator(
                                message="El segmento debe iniciar con una letra y usar solo A-Z y 0-9.",
                                regex="^[A-Z][A-Z0-9]{0,15}$",
                            )
                        ],
                    ),
                ),
                ("path_code", models.CharField(db_index=True, editable=False, max_length=255, unique=True)),
                ("name", models.CharField(max_length=100)),
                ("normalized_name", models.CharField(editable=False, max_length=100)),
                ("square_meters", models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True)),
                ("headcount", models.PositiveIntegerField(blank=True, null=True)),
                ("common_space", models.BooleanField(default=False)),
                ("active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "parent",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="children",
                        to="spaces.spacenode",
                    ),
                ),
                (
                    "site",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="space_nodes",
                        to="spaces.facilitysite",
                    ),
                ),
            ],
            options={"ordering": ("path_code", "name")},
        ),
        migrations.AddConstraint(
            model_name="facilitysite",
            constraint=models.UniqueConstraint(fields=("normalized_name",), name="uq_facility_site_normalized_name"),
        ),
        migrations.AddConstraint(
            model_name="spacenode",
            constraint=models.UniqueConstraint(
                condition=Q(("parent__isnull", True)),
                fields=("site", "code_segment"),
                name="uq_space_root_segment",
            ),
        ),
        migrations.AddConstraint(
            model_name="spacenode",
            constraint=models.UniqueConstraint(
                condition=Q(("parent__isnull", False)),
                fields=("parent", "code_segment"),
                name="uq_space_sibling_segment",
            ),
        ),
        migrations.AddConstraint(
            model_name="spacenode",
            constraint=models.CheckConstraint(
                condition=Q(("square_meters__isnull", True)) | Q(("square_meters__gt", 0)),
                name="ck_space_node_square_meters_positive",
            ),
        ),
    ]
