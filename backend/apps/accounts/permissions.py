from rest_framework.permissions import BasePermission, SAFE_METHODS

from .models import AccountProfile


def user_role(user):
    if not user or not user.is_authenticated:
        return None
    try:
        return user.account_profile.role
    except AccountProfile.DoesNotExist:
        return AccountProfile.Role.ADMIN if user.is_superuser else None


class IsAdministrator(BasePermission):
    message = "Esta acción requiere permisos de Administrador/FM."

    def has_permission(self, request, view):
        return user_role(request.user) == AccountProfile.Role.ADMIN


class IsTechnicianOrAdministrator(BasePermission):
    def has_permission(self, request, view):
        return user_role(request.user) in {
            AccountProfile.Role.ADMIN,
            AccountProfile.Role.TECHNICIAN,
        }


class IsAuthenticatedReadAdministratorWrite(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return user_role(request.user) == AccountProfile.Role.ADMIN
