from django.utils import timezone

from apps.accounts.models import AccountProfile
from apps.inspeccion.models import ProgramacionInspeccion

from .services import queue_for_roles

# TODO: confirmar el nombre real de este choice en AccountProfile.Role.
# Se asume INSPECTOR por analogía con ADMIN (usado en queue_for_administrators).
ALERT_ROLES = [AccountProfile.Role.INSPECTOR, AccountProfile.Role.ADMIN]

DIAS_ANTICIPACION_PROXIMA = 2


def _objetivo_y_codigo(programacion):
    """Devuelve (material, código legible) tanto si la programación apunta a
    un material directo como si apunta a una pieza (control individual)."""
    if programacion.pieza_id:
        return programacion.pieza.material, programacion.pieza.codigo
    return programacion.material, programacion.material.codigo

def queue_inspection_alert(programacion):
    """Encola una alerta para una ProgramacionInspeccion pendiente, si corresponde."""
    if programacion.estado != "pendiente":
        return None

    material, codigo = _objetivo_y_codigo(programacion)
    hoy = timezone.localdate()
    dias_restantes = (programacion.fecha_programada - hoy).days

    if dias_restantes < 0:
        subject = f"Inspección vencida: {codigo}"
        body = (
            f"La inspección de {material.nombre} ({codigo}) estaba programada para "
            f"{programacion.fecha_programada:%d/%m/%Y} y aún no se ha registrado. "
            f"Lleva {abs(dias_restantes)} día(s) de atraso."
        )
        event = "INSPECTION_OVERDUE"
        discriminator = "vencida"
    elif dias_restantes <= DIAS_ANTICIPACION_PROXIMA:
        subject = f"Inspección próxima a vencer: {codigo}"
        body = (
            f"La inspección de {material.nombre} ({codigo}) está programada para "
            f"{programacion.fecha_programada:%d/%m/%Y} "
            f"(en {dias_restantes} día{'s' if dias_restantes != 1 else ''})."
        )
        event = "INSPECTION_DUE_SOON"
        discriminator = "proxima"
    else:
        return None

    return queue_for_roles(
        event=event,
        roles=ALERT_ROLES,
        subject=subject,
        body=body,
        entity=programacion,
        context={"materialCodigo": codigo, "fechaProgramada": str(programacion.fecha_programada)},
        discriminator=discriminator,
    )

def evaluate_all_inspection_alerts():
    """Sweep completo: recorre todas las programaciones pendientes y encola
    las que estén vencidas o próximas a vencer. Pensado para Celery Beat."""
    pendientes = ProgramacionInspeccion.objects.filter(
        estado="pendiente"
    ).select_related("material", "pieza__material")
    for programacion in pendientes:
        queue_inspection_alert(programacion)