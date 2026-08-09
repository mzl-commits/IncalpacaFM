from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("privacy", "0002_seed_baseline")]
    operations = [
        migrations.AlterModelOptions(
            name="processinginventory",
            options={"ordering": ("name",), "verbose_name_plural": "inventario de tratamientos"},
        ),
        migrations.RenameIndex(
            model_name="privacyacknowledgement",
            old_name="privacy_ack_context_created_idx",
            new_name="privacy_pri_context_af44d3_idx",
        ),
        migrations.RenameIndex(
            model_name="privacyacknowledgement",
            old_name="privacy_ack_user_created_idx",
            new_name="privacy_pri_user_id_8226b7_idx",
        ),
    ]
