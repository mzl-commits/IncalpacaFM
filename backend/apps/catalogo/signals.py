from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver

from apps.catalogo.models import Pieza


@receiver(post_save, sender=Pieza)
@receiver(post_delete, sender=Pieza)
def actualizar_cantidad_material(sender, instance, **kwargs):
    instance.material.recalcular_cantidad()