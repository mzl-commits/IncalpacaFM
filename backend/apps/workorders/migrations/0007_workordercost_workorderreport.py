import uuid

from django.conf import settings
from django.db import migrations, models

import apps.assets.storage


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("workorders", "0006_workorderphoto"),
    ]

    operations = [
        migrations.CreateModel(
            name="WorkOrderCost",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("category", models.CharField(choices=[("MANO_OBRA", "Mano de obra"), ("MATERIAL", "Material"), ("SERVICIO", "Servicio"), ("OTRO", "Otro")], max_length=16)),
                ("description", models.CharField(max_length=240)),
                ("amount", models.DecimalField(decimal_places=2, max_digits=12)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("created_by", models.ForeignKey(on_delete=models.deletion.PROTECT, related_name="work_order_costs", to=settings.AUTH_USER_MODEL)),
                ("work_order", models.ForeignKey(on_delete=models.deletion.PROTECT, related_name="cost_items", to="workorders.workorder")),
            ],
            options={"ordering": ("created_at",)},
        ),
        migrations.CreateModel(
            name="WorkOrderReport",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("file", models.FileField(storage=apps.assets.storage.PrivateAssetPhotoStorage(), upload_to="work_order_reports/")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("generated_by", models.ForeignKey(on_delete=models.deletion.PROTECT, related_name="generated_work_order_reports", to=settings.AUTH_USER_MODEL)),
                ("work_order", models.ForeignKey(on_delete=models.deletion.PROTECT, related_name="generated_reports", to="workorders.workorder")),
            ],
            options={"ordering": ("-created_at",)},
        ),
    ]
