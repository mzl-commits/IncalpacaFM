# Generated for the spatial hierarchy bridge.

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("spaces", "0001_initial"),
        ("assets", "0013_location_space_node"),
    ]

    operations = [
        migrations.AddField(
            model_name="buildingarea",
            name="space_node",
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="legacy_building_area",
                to="spaces.spacenode",
            ),
        ),
    ]
