from django.db.models.signals import post_save
from django.dispatch import receiver
from .models import AccountProfile
from apps.assets.models import AssignableResponsible

@receiver(post_save, sender=AccountProfile)
def sync_account_profile_to_assignable_responsible(sender, instance, created, **kwargs):
    display_name = instance.user.get_full_name() or instance.user.username
    area_name = instance.specialty or instance.position or instance.get_role_display()
    
    AssignableResponsible.objects.update_or_create(
        external_reference=instance.worker_code,
        defaults={
            'type': AssignableResponsible.Type.PERSON,
            'display_name': display_name,
            'area_name': area_name,
            'active': instance.active,
        }
    )
