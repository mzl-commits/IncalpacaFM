"""Rules that surface operational risks in work orders.

The same rules are run after an update and on a periodic sweep so a forgotten
order is still brought to the attention of the technician and FM team.
"""

from django.utils import timezone
from django.utils.dateparse import parse_datetime

from apps.workorders.models import WorkOrder

from .services import queue_for_administrators, queue_notification


FINAL_STATUSES = {WorkOrder.Status.CLOSED, WorkOrder.Status.CANCELLED}


def effective_work_minutes(order):
    total_seconds = 0
    now = timezone.now()
    for session in order.work_sessions or []:
        start = parse_datetime(session.get("startAt") or "")
        end = parse_datetime(session.get("endAt") or "") if session.get("endAt") else now
        if start and end and end >= start:
            total_seconds += (end - start).total_seconds()
    return round(total_seconds / 60)


def queue_work_order_alerts(order):
    """Queue each operational alert only once per order and alert type."""
    if order.status in FINAL_STATUSES:
        return

    planned_minutes = order.planned_hours * 60
    registered_minutes = effective_work_minutes(order)
    if registered_minutes > planned_minutes:
        excess = registered_minutes - planned_minutes
        subject = f"Tiempo excedido en {order.code}"
        body = (
            f"La OT {order.code} acumuló {registered_minutes} min frente a los "
            f"{planned_minutes} min programados ({excess} min adicionales). "
            "Revisa el avance y actualiza la trazabilidad."
        )
        queue_notification(
            event="WORK_ORDER_TIME_EXCEEDED",
            recipient=order.technician,
            subject=subject,
            body=body,
            entity=order,
            discriminator="time-exceeded",
        )
        queue_for_administrators(
            event="WORK_ORDER_TIME_EXCEEDED",
            subject=subject,
            body=body,
            entity=order,
            discriminator="time-exceeded",
        )

    missing_traceability = (
        order.scheduled_date < timezone.localdate()
        and not order.work_sessions
        and not order.advances
    )
    if missing_traceability:
        subject = f"Trazabilidad pendiente en {order.code}"
        body = (
            f"La OT {order.code} estaba programada para {order.scheduled_date:%d/%m/%Y} "
            "y aún no registra inicio, tiempo ni avance. Actualiza su estado o reprograma la atención."
        )
        queue_notification(
            event="WORK_ORDER_TRACEABILITY_PENDING",
            recipient=order.technician,
            subject=subject,
            body=body,
            entity=order,
            discriminator="traceability-pending",
        )
        queue_for_administrators(
            event="WORK_ORDER_TRACEABILITY_PENDING",
            subject=subject,
            body=body,
            entity=order,
            discriminator="traceability-pending",
        )


def evaluate_all_work_order_alerts():
    for order in WorkOrder.objects.select_related("technician").exclude(status__in=FINAL_STATUSES):
        queue_work_order_alerts(order)
