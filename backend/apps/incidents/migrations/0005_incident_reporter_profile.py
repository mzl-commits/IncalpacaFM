from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("organization", "0001_reporter_registry"),
        ("incidents", "0004_merge_public_request_and_reporter"),
    ]

    operations = [
        migrations.AddField(
            model_name="incident",
            name="reporter_profile",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="incidents", to="organization.reporterprofile"),
        ),
    ]
