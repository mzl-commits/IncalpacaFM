import uuid
from django.conf import settings
from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL), ("workorders", "0007_workordercost_workorderreport")]
    operations = [migrations.CreateModel(name="ReportTemplate", fields=[
        ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
        ("name", models.CharField(max_length=120, unique=True)),
        ("scope", models.CharField(default="ORDEN_TRABAJO", max_length=24)),
        ("sections", models.JSONField(default=list)),
        ("is_active", models.BooleanField(default=True)),
        ("created_at", models.DateTimeField(auto_now_add=True)),
        ("updated_at", models.DateTimeField(auto_now=True)),
        ("created_by", models.ForeignKey(on_delete=models.deletion.PROTECT, related_name="report_templates", to=settings.AUTH_USER_MODEL)),
    ], options={"ordering": ("name",)})]
