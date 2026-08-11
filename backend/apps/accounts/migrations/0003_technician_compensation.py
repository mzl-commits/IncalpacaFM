from decimal import Decimal

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0002_accountprofile_dni")]

    operations = [
        migrations.AddField(
            model_name="accountprofile",
            name="position",
            field=models.CharField(blank=True, default="", max_length=100),
        ),
        migrations.AddField(
            model_name="accountprofile",
            name="hourly_rate",
            field=models.DecimalField(decimal_places=2, default=Decimal("0.00"), max_digits=10),
        ),
    ]
