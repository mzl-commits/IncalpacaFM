
from rest_framework import permissions, response, status, views
from rest_framework_simplejwt.views import TokenRefreshView
from django.contrib.auth import get_user_model

from .serializers import ChangePasswordSerializer, CurrentUserSerializer, LoginSerializer, UserListSerializer


class LoginView(views.APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "login"

    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        return response.Response(serializer.validated_data)


class CurrentUserView(views.APIView):
    def get(self, request):
        return response.Response(CurrentUserSerializer(request.user).data)


class ChangePasswordView(views.APIView):
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return response.Response(
            {"detail": "Contraseña actualizada correctamente."}, status=status.HTTP_200_OK
        )


class UserListView(views.APIView):
    """Lista todos los usuarios activos. Temporal con AllowAny hasta que exista autenticación en el frontend."""
    permission_classes = [permissions.AllowAny]

    def get(self, request):
        User = get_user_model()
        users = (
            User.objects
            .filter(is_active=True)
            .select_related("account_profile")
            .order_by("first_name", "last_name")
        )
        serializer = UserListSerializer(users, many=True)
        return response.Response(serializer.data)


__all__ = ["LoginView", "TokenRefreshView", "CurrentUserView", "ChangePasswordView", "UserListView"]
