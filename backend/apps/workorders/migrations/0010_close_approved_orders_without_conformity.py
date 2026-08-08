from django.db import migrations
from django.utils import timezone


def close_legacy_orders(apps, schema_editor):
    WorkOrder = apps.get_model("workorders", "WorkOrder")
    Incident = apps.get_model("incidents", "Incident")
    now = timezone.now()
    legacy_orders = WorkOrder.objects.filter(status="PENDIENTE_DE_CONFORMIDAD")
    incident_ids = list(legacy_orders.values_list("incident_id", flat=True))
    legacy_orders.update(status="CERRADA", closed_at=now)
    if incident_ids:
        Incident.objects.filter(pk__in=incident_ids).update(status="CERRADA", updated_at=now)


class Migration(migrations.Migration):
    dependencies = [("workorders", "0009_report_governance")]

    operations = [migrations.RunPython(close_legacy_orders, migrations.RunPython.noop)]
