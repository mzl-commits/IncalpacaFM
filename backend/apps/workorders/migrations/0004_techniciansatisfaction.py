import uuid

from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL), ("workorders", "0003_merge_work_session_and_planned_hours")]
    operations = [
        migrations.CreateModel(name="TechnicianSatisfaction", fields=[
            ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
            ("accepted", models.BooleanField()),
            ("rating", models.PositiveSmallIntegerField(blank=True, null=True)),
            ("comment", models.TextField(blank=True)),
            ("submitted_at", models.DateTimeField(auto_now=True)),
            ("technician", models.ForeignKey(on_delete=models.deletion.PROTECT, related_name="satisfaction_records", to=settings.AUTH_USER_MODEL)),
            ("work_order", models.OneToOneField(on_delete=models.deletion.PROTECT, related_name="satisfaction", to="workorders.workorder")),
        ], options={"ordering": ("-submitted_at",)}),
        migrations.AddConstraint(model_name="techniciansatisfaction", constraint=models.CheckConstraint(condition=models.Q(rating__isnull=True) | models.Q(rating__gte=1, rating__lte=5), name="satisfaction_rating_between_1_and_5")),
    ]
