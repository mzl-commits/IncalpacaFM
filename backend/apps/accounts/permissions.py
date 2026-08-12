from rest_framework.permissions import SAFE_METHODS, BasePermission

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



class IsWorkOrderParticipant(BasePermission):
    def has_permission(self, request, view):
        return user_role(request.user) in {
            AccountProfile.Role.ADMIN,
            AccountProfile.Role.TECHNICIAN,
            AccountProfile.Role.SUPERVISOR,
        }


class IsAuthenticatedReadAdministratorWrite(BasePermission):
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return user_role(request.user) == AccountProfile.Role.ADMIN


class IsAlmaceneroOrAdministratorWrite(BasePermission):
    """
    Requiere sesión iniciada para leer (GET/HEAD/OPTIONS).
    Requiere rol ADMINISTRADOR o ALMACENERO para escribir
    (POST, PUT, PATCH, DELETE).
    """
    message = "Esta acción requiere permisos de Administrador o Almacenero."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return user_role(request.user) in {
            AccountProfile.Role.ADMIN,
            AccountProfile.Role.ALMACENERO,
        }


class IsInspectorOrAdministratorWrite(BasePermission):
    """
    Requiere sesión iniciada para lecturas (SAFE_METHODS).
    Requiere rol ADMINISTRADOR o INSPECTOR para escritura (POST, PUT, PATCH, DELETE).
    """
    message = "Esta acción requiere permisos de Administrador o Inspector."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return user_role(request.user) in {
            AccountProfile.Role.ADMIN,
            AccountProfile.Role.INSPECTOR,
        }


class IsAlmaceneroAdminOrInspectorWrite(BasePermission):
    """
    Requiere sesión iniciada para leer (GET/HEAD/OPTIONS).
    Requiere rol ADMINISTRADOR, ALMACENERO o INSPECTOR para escribir
    (usado puntualmente en la frecuencia de inspección de un material).
    """
    message = "Esta acción requiere permisos de Administrador, Almacenero o Inspector."

    def has_permission(self, request, view):
        if not (request.user and request.user.is_authenticated):
            return False
        if request.method in SAFE_METHODS:
            return True
        return user_role(request.user) in {
            AccountProfile.Role.ADMIN,
            AccountProfile.Role.ALMACENERO,
            AccountProfile.Role.INSPECTOR,
        }