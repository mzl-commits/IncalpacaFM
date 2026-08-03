from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('workorders', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='workorder',
            name='planned_hours',
            field=models.PositiveSmallIntegerField(default=2),
        ),
    ]
