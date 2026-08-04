from django.db import migrations


def normalize_location_markers(apps, schema_editor):
    Incident = apps.get_model("incidents", "Incident")
    for incident in Incident.objects.iterator():
        snapshot = dict(incident.location_snapshot or {})
        changed = False
        for key in ("locationMapId", "locationMarkerX", "locationMarkerY"):
            if snapshot.get(key) == "":
                snapshot[key] = None
                changed = True
        if changed:
            incident.location_snapshot = snapshot
            incident.save(update_fields=("location_snapshot",))


class Migration(migrations.Migration):
    dependencies = [("incidents", "0001_initial")]

    operations = [migrations.RunPython(normalize_location_markers, migrations.RunPython.noop)]
