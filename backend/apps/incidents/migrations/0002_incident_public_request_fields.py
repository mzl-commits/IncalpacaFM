from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("incidents", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="incident",
            name="impact_assessment",
            field=models.JSONField(blank=True, default=dict),
        ),
        migrations.AddField(
            model_name="incident",
            name="requester_contact",
            field=models.JSONField(blank=True, default=dict),
        ),
    ]
