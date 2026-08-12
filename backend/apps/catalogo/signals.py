from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from apps.catalogo.models import Pieza, Material


@receiver(post_save, sender=Pieza)
@receiver(post_delete, sender=Pieza)
def actualizar_cantidad_material(sender, instance, **kwargs):
    instance.material.recalcular_cantidad()


@receiver(post_save, sender=Material)
def notify_new_inspectable_material(sender, instance, created, **kwargs):
    """Notifica a los Inspectores cuando se crea un material nuevo cuya
    subcategoría tiene plantilla de inspección asignada."""
    if not created:
        return
    # Verificamos si la subcategoría tiene plantilla de inspección
    subcategoria = getattr(instance, "subcategoria", None)
    if not subcategoria:
        return
    plantilla = getattr(subcategoria, "plantilla_inspeccion", None)
    if not plantilla:
        return

    from apps.accounts.models import AccountProfile
    from apps.notifications.services import queue_for_roles

    queue_for_roles(
        event="NEW_INSPECTABLE_MATERIAL",
        roles=[AccountProfile.Role.INSPECTOR, AccountProfile.Role.ADMIN],
        subject=f"Nuevo material inspeccionable: {instance.nombre}",
        body=(
            f"Se registró el material «{instance.nombre}» (código: {instance.codigo}) "
            f"en la subcategoría «{subcategoria.nombre}», que requiere inspección "
            f"con la plantilla «{plantilla.nombre}». Actualizar el plan anual si corresponde."
        ),
        entity=instance,
        context={
            "materialId": instance.id,
            "materialNombre": instance.nombre,
            "subcategoria": subcategoria.nombre,
            "plantilla": plantilla.nombre,
        },
        discriminator=f"new-material-{instance.id}",
    )