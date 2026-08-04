import uuid

from django.conf import settings
from django.db import migrations, models

import apps.assets.storage


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("workorders", "0005_workorder_schedule_and_supporting_technicians"),
    ]

    operations = [
        migrations.CreateModel(
            name="WorkOrderPhoto",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("stage", models.CharField(choices=[("INICIO", "Inicio"), ("FINAL", "Final")], max_length=12)),
                ("image", models.ImageField(storage=apps.assets.storage.PrivateAssetPhotoStorage(), upload_to="work_order_photos/")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("uploaded_by", models.ForeignKey(on_delete=models.deletion.PROTECT, related_name="work_order_photos", to=settings.AUTH_USER_MODEL)),
                ("work_order", models.ForeignKey(on_delete=models.deletion.PROTECT, related_name="traceability_photos", to="workorders.workorder")),
            ],
            options={"ordering": ("created_at",)},
        ),
        migrations.AddConstraint(
            model_name="workorderphoto",
            constraint=models.UniqueConstraint(fields=("work_order", "stage"), name="one_traceability_photo_per_stage"),
        ),
    ]
