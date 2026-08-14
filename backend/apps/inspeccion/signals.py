"""
Señales post_save para notificaciones cruzadas entre roles en el módulo de
inspección. Se conectan en InspeccionConfig.ready().
"""
from django.db.models.signals import post_save
from django.dispatch import receiver

from apps.accounts.models import AccountProfile
from apps.notifications.services import queue_for_roles

NON_CONFORMING = {"requiere_reparacion", "fuera_servicio"}


@receiver(post_save, sender="inspeccion.Inspeccion")
def notify_on_non_conforming_inspection(sender, instance, created, **kwargs):
    """Si una inspección registra un resultado no conforme, notifica a
    Almaceneros y Administradores para que evalúen retiro/reparación."""
    if not instance.resultado_general:
        return
    if instance.resultado_general not in NON_CONFORMING:
        return

    objetivo = (
        instance.pieza.codigo if instance.pieza else instance.material.codigo
    )
    resultado_label = dict(instance.RESULTADO_CHOICES).get(
        instance.resultado_general, instance.resultado_general
    )
    accion_label = dict(instance.ACCION_CHOICES).get(
        instance.accion_tomada, instance.accion_tomada or "—"
    )

    queue_for_roles(
        event="INSPECTION_NON_CONFORMING",
        roles=[AccountProfile.Role.ALMACENERO, AccountProfile.Role.ADMIN],
        subject=f"Inspección no conforme: {objetivo}",
        body=(
            f"La inspección de {objetivo} registró resultado «{resultado_label}». "
            f"Acción tomada: {accion_label}. "
            f"Revisar si corresponde retirar del inventario o programar reparación."
        ),
        entity=instance,
        context={
            "inspeccionId": instance.id,
            "objetivo": objetivo,
            "resultado": instance.resultado_general,
            "accion": instance.accion_tomada,
        },
        discriminator=f"non-conforming-{instance.id}",
    )


@receiver(post_save, sender="inspeccion.PlanInspeccionAnual")
def notify_on_plan_anual(sender, instance, created, **kwargs):
    """Notifica a Inspectores y Administradores cuando se genera o actualiza un
    plan anual de inspección."""
    if created:
        subject = f"Plan de inspección {instance.anio} creado"
        body = (
            f"Se generó el plan de inspección anual {instance.anio} "
            f"({instance.fecha_inicio} – {instance.fecha_fin}). "
            f"Estado: {instance.get_estado_display()}."
        )
    else:
        subject = f"Plan de inspección {instance.anio} actualizado"
        body = (
            f"El plan de inspección anual {instance.anio} fue actualizado. "
            f"Estado actual: {instance.get_estado_display()}."
        )

    queue_for_roles(
        event="INSPECTION_PLAN_SAVED",
        roles=[AccountProfile.Role.INSPECTOR, AccountProfile.Role.ADMIN],
        subject=subject,
        body=body,
        entity=instance,
        context={
            "planId": instance.id,
            "anio": instance.anio,
            "estado": instance.estado,
        },
        discriminator=f"plan-{instance.id}-{instance.estado}",
    )
