
from rest_framework import permissions, response, status, views
from rest_framework_simplejwt.views import TokenRefreshView

from .serializers import ChangePasswordSerializer, CurrentUserSerializer, LoginSerializer


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


__all__ = ["LoginView", "TokenRefreshView", "CurrentUserView", "ChangePasswordView"]
