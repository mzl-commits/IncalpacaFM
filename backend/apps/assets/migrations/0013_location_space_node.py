# Generated manually to bridge the new spatial hierarchy to legacy locations.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("spaces", "0001_initial"),
        ("assets", "0012_alter_buildingarea_square_meters"),
    ]

    operations = [
        migrations.AddField(
            model_name="location",
            name="space_node",
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="legacy_location",
                to="spaces.spacenode",
            ),
        ),
    ]
