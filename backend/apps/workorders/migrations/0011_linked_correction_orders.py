from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("incidents", "0005_incident_reporter_profile"),
        ("workorders", "0010_close_approved_orders_without_conformity"),
    ]

    operations = [
        migrations.AlterField(
            model_name="workorder",
            name="incident",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="work_orders",
                to="incidents.incident",
            ),
        ),
        migrations.AddField(
            model_name="workorder",
            name="correction_of",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="correction_orders",
                to="workorders.workorder",
            ),
        ),
    ]