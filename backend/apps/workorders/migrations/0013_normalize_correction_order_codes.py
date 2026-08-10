from django.db import migrations


def root_work_order(order):
    current = order
    seen = set()
    while current.correction_of_id and current.correction_of_id not in seen:
        seen.add(current.id)
        current = current.correction_of
    return current


def next_correction_code(WorkOrder, order, assigned):
    root = root_work_order(order)
    prefix = f"{root.code}-C"
    existing = set(WorkOrder.objects.filter(code__startswith=prefix).values_list("code", flat=True)) | assigned
    index = 1
    while True:
        code = f"{prefix}{index}"
        if code not in existing:
            assigned.add(code)
            return code
        index += 1


def normalize_codes(apps, schema_editor):
    WorkOrder = apps.get_model("workorders", "WorkOrder")
    assigned = set()
    corrections = WorkOrder.objects.filter(correction_of__isnull=False).order_by("correction_of__created_at", "created_at", "code")
    for order in corrections:
        root = root_work_order(order)
        if order.code.startswith(f"{root.code}-C"):
            assigned.add(order.code)
            continue
        old_code = order.code
        order.code = next_correction_code(WorkOrder, order, assigned)
        snapshot = dict(order.recommendation_snapshot or {})
        snapshot["correctionOfCode"] = order.correction_of.code
        order.recommendation_snapshot = snapshot
        order.save(update_fields=("code", "recommendation_snapshot", "updated_at"))

        parent = order.correction_of
        parent_snapshot = dict(parent.recommendation_snapshot or {})
        if parent_snapshot.get("correctionWorkOrderId") == str(order.id) or parent_snapshot.get("correctionWorkOrderCode") == old_code:
            parent_snapshot["correctionWorkOrderId"] = str(order.id)
            parent_snapshot["correctionWorkOrderCode"] = order.code
            parent.recommendation_snapshot = parent_snapshot
            parent.save(update_fields=("recommendation_snapshot", "updated_at"))


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("workorders", "0012_materialize_legacy_correction_orders"),
    ]

    operations = [
        migrations.RunPython(normalize_codes, noop),
    ]