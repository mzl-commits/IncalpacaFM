from datetime import date, time

from django.db import migrations
from django.utils import timezone


def root_work_order(order):
    current = order
    seen = set()
    while current.correction_of_id and current.correction_of_id not in seen:
        seen.add(current.id)
        current = current.correction_of
    return current


def next_correction_code(WorkOrder, order):
    root = root_work_order(order)
    prefix = f"{root.code}-C"
    index = WorkOrder.objects.filter(code__startswith=prefix).count() + 1
    while True:
        code = f"{prefix}{index}"
        if not WorkOrder.objects.filter(code=code).exists():
            return code
        index += 1


def parse_date(value, fallback):
    try:
        return date.fromisoformat(str(value))
    except (TypeError, ValueError):
        return fallback


def parse_time(value, fallback):
    try:
        return time.fromisoformat(str(value))
    except (TypeError, ValueError):
        return fallback


def create_linked_corrections(apps, schema_editor):
    WorkOrder = apps.get_model("workorders", "WorkOrder")
    now = timezone.now()
    year = timezone.localdate().year

    for order in WorkOrder.objects.filter(correction_of__isnull=True):
        if order.correction_orders.exists():
            continue
        schedule = (order.recommendation_snapshot or {}).get("correctionSchedule") or {}
        if not schedule:
            continue
        returned = (
            (order.administrator_validation or {}).get("approved") is False
            or (order.supervisor_validation or {}).get("approved") is False
        )
        if not returned:
            continue

        scheduled_date = parse_date(schedule.get("scheduledDate"), order.scheduled_date)
        scheduled_time = parse_time(schedule.get("scheduledStartTime"), order.scheduled_start_time)
        try:
            planned_hours = int(schedule.get("plannedHours") or order.planned_hours or 2)
        except (TypeError, ValueError):
            planned_hours = order.planned_hours or 2
        notes = str(schedule.get("administratorNotes") or order.administrator_notes or "").strip()

        correction_order = WorkOrder.objects.create(
            code=next_correction_code(WorkOrder, order),
            incident_id=order.incident_id,
            correction_of_id=order.id,
            technician_id=order.technician_id,
            supervisor_id=order.supervisor_id,
            specialty=order.specialty,
            admin_priority=order.admin_priority,
            status="PROGRAMADA",
            scheduled_date=scheduled_date,
            scheduled_start_time=scheduled_time,
            planned_hours=planned_hours,
            administrator_notes=notes,
            created_by_id=order.created_by_id,
            recommendation_snapshot={
                "correctionOfId": str(order.id),
                "correctionOfCode": order.code,
                "correctionReason": (
                    (order.administrator_validation or {}).get("comment")
                    or (order.supervisor_validation or {}).get("comment")
                    or "Corrección solicitada."
                ),
                "scheduledBy": schedule.get("scheduledBy", ""),
                "scheduledAt": schedule.get("scheduledAt") or now.isoformat(),
                "migratedFromLegacyCorrection": True,
            },
        )
        correction_order.supporting_technicians.set(order.supporting_technicians.all())

        snapshot = dict(order.recommendation_snapshot or {})
        snapshot["correctionWorkOrderId"] = str(correction_order.id)
        snapshot["correctionWorkOrderCode"] = correction_order.code
        order.recommendation_snapshot = snapshot
        if order.status == "EN_PROCESO":
            order.status = "DEVUELTA"
        order.work_sessions = [
            {**item, "endAt": item.get("endAt") or now.isoformat()}
            for item in (order.work_sessions or [])
        ]
        order.save(update_fields=("recommendation_snapshot", "status", "work_sessions", "updated_at"))


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("workorders", "0011_linked_correction_orders"),
    ]

    operations = [
        migrations.RunPython(create_linked_corrections, noop),
    ]