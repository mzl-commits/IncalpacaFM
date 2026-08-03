from apps.accounts.models import AccountProfile

from .models import Notification


def notifications_for_user(user):
    queryset = Notification.objects.select_related('recipient')
    if getattr(user.account_profile, 'role', None) == AccountProfile.Role.ADMIN:
        return queryset
    return queryset.filter(recipient=user)
