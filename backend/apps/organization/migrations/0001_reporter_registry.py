import uuid

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="ReporterProfile",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("dni", models.CharField(db_index=True, max_length=12, unique=True)),
                ("full_name", models.CharField(max_length=160)),
                ("email", models.EmailField(blank=True, max_length=254)),
                ("first_reported_at", models.DateTimeField(auto_now_add=True)),
                ("last_reported_at", models.DateTimeField(auto_now=True)),
                ("active", models.BooleanField(default=True)),
            ],
            options={"ordering": ("full_name",)},
        ),
        migrations.CreateModel(
            name="ReporterWorkerCode",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("worker_code", models.CharField(db_index=True, max_length=40, unique=True)),
                ("first_seen_at", models.DateTimeField(auto_now_add=True)),
                ("last_seen_at", models.DateTimeField(auto_now=True)),
                ("active", models.BooleanField(default=True)),
                ("reporter", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="worker_codes", to="organization.reporterprofile")),
            ],
            options={"ordering": ("-last_seen_at",)},
        ),
    ]
