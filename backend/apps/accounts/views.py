
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics, permissions, response, serializers, status, views
from rest_framework_simplejwt.views import TokenRefreshView

from .models import AccountProfile
from .permissions import IsAdministrator
from .serializers import (
    ChangePasswordSerializer,
    CurrentUserSerializer,
    LoginSerializer,
    TechnicianSerializer,
)


class LoginView(views.APIView):
    permission_classes = [permissions.AllowAny]
    throttle_scope = "login"

    @extend_schema(
        request=LoginSerializer,
        responses={
            200: inline_serializer(
                name="LoginResponse",
                fields={
                    "access": serializers.CharField(),
                    "refresh": serializers.CharField(),
                    "user": CurrentUserSerializer(),
                },
            )
        },
    )
    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        return response.Response(serializer.validated_data)


class CurrentUserView(views.APIView):
    @extend_schema(responses={200: CurrentUserSerializer})
    def get(self, request):
        return response.Response(CurrentUserSerializer(request.user).data)


class ChangePasswordView(views.APIView):
    @extend_schema(
        request=ChangePasswordSerializer,
        responses={
            200: inline_serializer(
                name="ChangePasswordResponse",
                fields={"detail": serializers.CharField()},
            )
        },
    )
    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return response.Response(
            {"detail": "Contraseña actualizada correctamente."}, status=status.HTTP_200_OK
        )


class TechnicianListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAdministrator]
    serializer_class = TechnicianSerializer
    queryset = get_user_model().objects.select_related('account_profile').filter(
        account_profile__role=AccountProfile.Role.TECHNICIAN
    ).order_by('first_name', 'last_name', 'username')


class TechnicianDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAdministrator]
    serializer_class = TechnicianSerializer
    queryset = get_user_model().objects.select_related('account_profile').filter(
        account_profile__role=AccountProfile.Role.TECHNICIAN
    )

    def get_object(self):
        return get_object_or_404(self.get_queryset(), account_profile__id=self.kwargs['pk'])


__all__ = [
    "LoginView", "TokenRefreshView", "CurrentUserView", "ChangePasswordView",
    "TechnicianListCreateView", "TechnicianDetailView",
]
