from datetime import timedelta

from django.db.models import Count
from django.utils import timezone

from apps.accounts.models import AccountProfile
from apps.inspeccion.models import ProgramacionInspeccion
from .services import daily_discriminator, weekly_discriminator, queue_for_roles

# Cada rol recibe el resumen con una cadencia distinta: los inspectores lo ven
# a diario (siguen el detalle operativo día a día); los administradores solo
# una vez por semana (vista gerencial, sin ruido diario).

ROLE_DISCRIMINATORS = {
    AccountProfile.Role.INSPECTOR: daily_discriminator,
    AccountProfile.Role.ADMIN: weekly_discriminator,
}

DIAS_ANTICIPACION_PROXIMA = 2

def _plural(n, singular, plural):
    return singular if n == 1 else plural

def _queue_role_summary(role, *, event, subject, body, base_discriminator, context=None, almacen=None):
    """Encola una notificación agregada (sin entidad puntual) para UN rol.
    `almacen` se pasa a queue_for_roles: si el rol tiene alcance de almacén
    (Inspector), solo la reciben los inspectores de ESE almacén — Admin
    (alcance global) siempre se llama con almacen=None."""
    discriminator_fn = ROLE_DISCRIMINATORS[role]
    return queue_for_roles(
        event=event,
        roles=[role],
        subject=subject,
        body=body,
        entity=None,
        context=context or {},
        discriminator=discriminator_fn(base_discriminator),
        almacen=almacen,
    )

def _body_vencidas(total):
    return (
        f"Hay {total} inspecci{_plural(total, 'ón', 'ones')} "
        f"vencida{_plural(total, '', 's')} pendiente{_plural(total, '', 's')} de registrar."
    )


def _body_proximas(total, fecha):
    return (
        f"Hay {total} inspecci{_plural(total, 'ón', 'ones')} programada"
        f"{_plural(total, '', 's')} para el {fecha:%d/%m/%Y}."
    )


def evaluate_all_inspection_alerts():
    """Sweep diario: agrupa las ProgramacionInspeccion pendientes por estado
    (vencidas / próximas a vencer) y encola UNA notificación resumen por
    grupo. Administrador ve el total global (alcance de sistema); Inspector
    ve solo el total DE SU ALMACÉN. Pensado para Celery Beat (una vez al día)."""
    hoy = timezone.localdate()
    pendientes = ProgramacionInspeccion.objects.filter(estado="pendiente")

    vencidas = pendientes.filter(fecha_programada__lt=hoy)
    total_global = vencidas.count()
    if total_global:
        _queue_role_summary(
            AccountProfile.Role.ADMIN,
            event="INSPECTION_OVERDUE",
            subject="Inspecciones vencidas",
            body=_body_vencidas(total_global),
            base_discriminator="vencidas",
            context={"total": total_global, "fechaCorte": str(hoy)},
        )

    for fila in vencidas.values("almacen").annotate(total=Count("id")):
        _queue_role_summary(
            AccountProfile.Role.INSPECTOR,
            event="INSPECTION_OVERDUE",
            subject="Inspecciones vencidas",
            body=_body_vencidas(fila["total"]),
            base_discriminator="vencidas",
            context={"total": fila["total"], "fechaCorte": str(hoy)},
            almacen=fila["almacen"],
        )

    limite = hoy + timedelta(days=DIAS_ANTICIPACION_PROXIMA)
    proximas = pendientes.filter(fecha_programada__gte=hoy, fecha_programada__lte=limite)

    for fila in proximas.values("fecha_programada").annotate(total=Count("id")).order_by("fecha_programada"):
        fecha = fila["fecha_programada"]
        _queue_role_summary(
            AccountProfile.Role.ADMIN,
            event="INSPECTION_DUE_SOON",
            subject="Inspecciones próximas a vencer",
            body=_body_proximas(fila["total"], fecha),
            base_discriminator=f"proximas-{fecha.isoformat()}",
            context={"total": fila["total"], "fechaProgramada": str(fecha)},
        )

    por_almacen_y_fecha = (
        proximas.values("almacen", "fecha_programada")
        .annotate(total=Count("id"))
        .order_by("fecha_programada")
    )
    for fila in por_almacen_y_fecha:
        fecha = fila["fecha_programada"]
        _queue_role_summary(
            AccountProfile.Role.INSPECTOR,
            event="INSPECTION_DUE_SOON",
            subject="Inspecciones próximas a vencer",
            body=_body_proximas(fila["total"], fecha),
            base_discriminator=f"proximas-{fecha.isoformat()}",
            context={"total": fila["total"], "fechaProgramada": str(fecha)},
            almacen=fila["almacen"],
        )