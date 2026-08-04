from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("workorders", "0002_workorder_planned_hours"),
        ("workorders", "0002_workorder_work_sessions"),
    ]

    operations = []
