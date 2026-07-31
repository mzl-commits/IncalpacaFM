# Generated for the normalized FM taxonomy catalog.

import django.core.validators
import django.db.models.deletion
import django.utils.timezone
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("assets", "0002_alter_asset_assignment_status"),
    ]

    operations = [
        migrations.AlterModelOptions(
            name="taxonomy",
            options={"ordering": ("prefix", "name")},
        ),
        migrations.RemoveConstraint(
            model_name="taxonomy",
            name="uq_asset_taxonomy",
        ),
        migrations.AddField(
            model_name="taxonomy",
            name="prefix",
            field=models.CharField(
                blank=True,
                max_length=16,
                null=True,
                unique=True,
                validators=[
                    django.core.validators.RegexValidator(
                        message="El prefijo debe iniciar con una letra y usar solo A-Z y 0-9.",
                        regex="^[A-Z][A-Z0-9]{0,15}$",
                    )
                ],
            ),
        ),
        migrations.AddField(
            model_name="taxonomy",
            name="name",
            field=models.CharField(blank=True, default="", max_length=160),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="taxonomy",
            name="sequence_digits",
            field=models.PositiveSmallIntegerField(default=4),
        ),
        migrations.AddField(
            model_name="taxonomy",
            name="default_criticality",
            field=models.CharField(default="Media", max_length=20),
        ),
        migrations.AddField(
            model_name="taxonomy",
            name="useful_life_years",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="taxonomy",
            name="preventive_frequency_months",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="taxonomy",
            name="requires_maintenance",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="taxonomy",
            name="requires_certification",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="taxonomy",
            name="issuance_enabled",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="taxonomy",
            name="review_status",
            field=models.CharField(
                choices=[("VALIDATED", "Validada"), ("REVIEW", "Revisar")],
                default="VALIDATED",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="taxonomy",
            name="aliases",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="taxonomy",
            name="canonical_prefix",
            field=models.CharField(blank=True, default="", max_length=16),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="taxonomy",
            name="source_version",
            field=models.CharField(blank=True, default="", max_length=40),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="taxonomy",
            name="notes",
            field=models.TextField(blank=True, default=""),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="taxonomy",
            name="created_at",
            field=models.DateTimeField(
                auto_now_add=True,
                default=django.utils.timezone.now,
            ),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="taxonomy",
            name="updated_at",
            field=models.DateTimeField(
                auto_now=True,
                default=django.utils.timezone.now,
            ),
            preserve_default=False,
        ),
        migrations.CreateModel(
            name="TaxonomySequence",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("last_value", models.PositiveBigIntegerField(default=0)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "taxonomy",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.PROTECT,
                        related_name="sequence",
                        to="assets.taxonomy",
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="AssetInternalSequence",
            fields=[
                (
                    "id",
                    models.UUIDField(
                        default=uuid.uuid4,
                        editable=False,
                        primary_key=True,
                        serialize=False,
                    ),
                ),
                ("year", models.PositiveSmallIntegerField(unique=True)),
                ("last_value", models.PositiveBigIntegerField(default=0)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.AddField(
            model_name="asset",
            name="fm_code",
            field=models.CharField(blank=True, max_length=32, null=True, unique=True),
        ),
        migrations.AddField(
            model_name="asset",
            name="fm_sequence_value",
            field=models.PositiveBigIntegerField(blank=True, null=True),
        ),
        migrations.AddConstraint(
            model_name="taxonomy",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ("sequence_digits__gte", 3),
                    ("sequence_digits__lte", 8),
                ),
                name="ck_taxonomy_sequence_digits",
            ),
        ),
        migrations.AddConstraint(
            model_name="asset",
            constraint=models.UniqueConstraint(
                condition=models.Q(("fm_sequence_value__isnull", False)),
                fields=("taxonomy", "fm_sequence_value"),
                name="uq_asset_taxonomy_sequence",
            ),
        ),
        migrations.AddConstraint(
            model_name="asset",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    models.Q(
                        ("fm_code__isnull", True),
                        ("fm_sequence_value__isnull", True),
                    ),
                    models.Q(
                        ("fm_code__isnull", False),
                        ("fm_sequence_value__isnull", False),
                    ),
                    _connector="OR",
                ),
                name="ck_asset_fm_code_pair",
            ),
        ),
        migrations.AddConstraint(
            model_name="asset",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ("fm_sequence_value__isnull", True),
                    ("fm_sequence_value__gte", 1),
                    _connector="OR",
                ),
                name="ck_asset_fm_sequence_positive",
            ),
        ),
        migrations.AddConstraint(
            model_name="asset",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    ("fm_code__isnull", True),
                    ("taxonomy__isnull", False),
                    _connector="OR",
                ),
                name="ck_asset_fm_code_taxonomy",
            ),
        ),
    ]
