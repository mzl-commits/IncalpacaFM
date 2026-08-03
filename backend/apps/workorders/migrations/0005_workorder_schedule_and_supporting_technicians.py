from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("workorders", "0004_techniciansatisfaction")]
    operations = [
        migrations.AddField(model_name="workorder", name="scheduled_start_time", field=models.TimeField(default="08:00")),
        migrations.AddField(model_name="workorder", name="supporting_technicians", field=models.ManyToManyField(blank=True, related_name="supporting_technical_orders", to=settings.AUTH_USER_MODEL)),
    ]
