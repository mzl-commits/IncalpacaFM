from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("notifications", "0002_notification_read_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="notification",
            name="delivery_channel",
            field=models.CharField(
                choices=[
                    ("SISTEMA", "Sistema"),
                    ("CORREO", "Correo"),
                    ("AMBOS", "Correo y sistema"),
                ],
                default="AMBOS",
                max_length=12,
            ),
        ),
    ]
