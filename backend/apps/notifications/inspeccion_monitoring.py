from datetime import timedelta

from django.db.models import Count
from django.utils import timezone

from apps.accounts.models import AccountProfile
from apps.inspeccion.models import ProgramacionInspeccion
from .services import daily_discriminator, weekly_discriminator, queue_for_roles

# Cada rol recibe el resumen con una cadencia distinta: los inspectores lo ven
# a diario (siguen el detalle operativo día a día); los administradores solo
# una vez por semana (vista gerencial, sin ruido diario).
ALERT_ROLES = [AccountProfile.Role.INSPECTOR, AccountProfile.Role.ADMIN]

ROLE_DISCRIMINATORS = {
    AccountProfile.Role.INSPECTOR: daily_discriminator,
    AccountProfile.Role.ADMIN: weekly_discriminator,
}

DIAS_ANTICIPACION_PROXIMA = 2


def _plural(n, singular, plural):
    return singular if n == 1 else plural


def _queue_summary(*, event, subject, body, base_discriminator, context=None):
    """Encola una notificación agregada (sin entidad puntual) para cada rol de
    alerta, usando la cadencia de discriminador que le corresponde a ese rol."""
    results = []
    for role, discriminator_fn in ROLE_DISCRIMINATORS.items():
        results += queue_for_roles(
            event=event,
            roles=[role],
            subject=subject,
            body=body,
            entity=None,
            context=context or {},
            discriminator=discriminator_fn(base_discriminator),
        )
    return results


def evaluate_all_inspection_alerts():
    """Sweep diario: agrupa las ProgramacionInspeccion pendientes por estado
    (vencidas / próximas a vencer) y encola UNA notificación resumen por
    grupo y por rol, sin exponer qué material o pieza puntual está detrás de
    cada conteo. Pensado para Celery Beat (correr una vez al día)."""
    hoy = timezone.localdate()
    pendientes = ProgramacionInspeccion.objects.filter(estado="pendiente")

    total_vencidas = pendientes.filter(fecha_programada__lt=hoy).count()
    if total_vencidas:
        _queue_summary(
            event="INSPECTION_OVERDUE",
            subject="Inspecciones vencidas",
            body=(
                f"Hay {total_vencidas} inspecci{_plural(total_vencidas, 'ón', 'ones')} "
                f"vencida{_plural(total_vencidas, '', 's')} pendiente{_plural(total_vencidas, '', 's')} "
                f"de registrar."
            ),
            base_discriminator="vencidas",
            context={"total": total_vencidas, "fechaCorte": str(hoy)},
        )

    limite = hoy + timedelta(days=DIAS_ANTICIPACION_PROXIMA)
    proximas_por_fecha = (
        pendientes.filter(fecha_programada__gte=hoy, fecha_programada__lte=limite)
        .values("fecha_programada")
        .annotate(total=Count("id"))
        .order_by("fecha_programada")
    )
    for fila in proximas_por_fecha:
        fecha = fila["fecha_programada"]
        total = fila["total"]
        _queue_summary(
            event="INSPECTION_DUE_SOON",
            subject="Inspecciones próximas a vencer",
            body=(
                f"Hay {total} inspecci{_plural(total, 'ón', 'ones')} programada"
                f"{_plural(total, '', 's')} para el {fecha:%d/%m/%Y}."
            ),
            base_discriminator=f"proximas-{fecha.isoformat()}",
            context={"total": total, "fechaProgramada": str(fecha)},
        )