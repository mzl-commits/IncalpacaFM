from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("accounts", "0005_merge_20260811_1436")]

    operations = [
        migrations.CreateModel(
            name="AccountWorkerCode",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("code", models.CharField(max_length=40, unique=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("profile", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="worker_code_aliases", to="accounts.accountprofile")),
            ],
            options={"ordering": ("code",)},
        ),
    ]
