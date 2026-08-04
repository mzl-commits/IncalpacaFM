from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("workorders", "0008_reporttemplate")]
    operations = [
        migrations.AddField(model_name="reporttemplate", name="version", field=models.CharField(default="1.0", max_length=32)),
        migrations.AddField(model_name="reporttemplate", name="variables", field=models.JSONField(default=list)),
        migrations.AddField(model_name="reporttemplate", name="content_hash", field=models.CharField(blank=True, db_index=True, max_length=64)),
        migrations.AddField(model_name="reporttemplate", name="status", field=models.CharField(choices=[("BORRADOR", "Borrador"), ("EMITIDO", "Emitido"), ("ANULADO", "Anulado")], default="BORRADOR", max_length=12)),
        migrations.AddField(model_name="workorderreport", name="template_version", field=models.CharField(blank=True, max_length=32)),
        migrations.AddField(model_name="workorderreport", name="content_hash", field=models.CharField(blank=True, db_index=True, max_length=64)),
        migrations.AddField(model_name="workorderreport", name="status", field=models.CharField(choices=[("BORRADOR", "Borrador"), ("EMITIDO", "Emitido"), ("ANULADO", "Anulado")], default="EMITIDO", max_length=12)),
    ]
