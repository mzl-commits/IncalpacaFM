from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('incidents', '0002_normalize_location_markers'),
    ]

    operations = [
        migrations.AddField(
            model_name='incident',
            name='public_submission',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='incident',
            name='reporter_email',
            field=models.EmailField(blank=True, max_length=254),
        ),
        migrations.AddField(
            model_name='incident',
            name='reporter_name',
            field=models.CharField(blank=True, max_length=160),
        ),
    ]
