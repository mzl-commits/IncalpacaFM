from django.db import migrations, models

import apps.assets.storage


class Migration(migrations.Migration):
    dependencies = [
        ('assets', '0008_taxonomy_location_catalog'),
    ]

    operations = [
        migrations.AddField(
            model_name='asset',
            name='photo',
            field=models.ImageField(
                blank=True,
                null=True,
                storage=apps.assets.storage.PrivateAssetPhotoStorage(),
                upload_to='asset_photos/',
            ),
        ),
    ]
