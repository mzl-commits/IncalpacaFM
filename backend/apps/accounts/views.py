
from django.contrib.auth import get_user_model
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics, permissions, response, serializers, status, views
from rest_framework_simplejwt.views import TokenRefreshView

from .models import AccountProfile
from .permissions import IsAdministrator
from apps.notifications.services import queue_notification
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


class TechnicianManualNotificationView(views.APIView):
    permission_classes = [IsAdministrator]

    def post(self, request, pk):
        technician = get_object_or_404(TechnicianDetailView.queryset, account_profile__id=pk)
        template = str(request.data.get('template') or 'CUSTOM').upper()
        delivery_channel = str(request.data.get('deliveryChannel') or 'SISTEMA').upper()
        if delivery_channel not in {'SISTEMA', 'CORREO'}:
            return response.Response({'detail': 'Selecciona Sistema o Correo como canal de envío.'}, status=status.HTTP_400_BAD_REQUEST)
        templates = {
            'REMINDER': ('Recordatorio de jornada', 'Recuerda revisar tu agenda, iniciar el temporizador al comenzar y actualizar el avance de cada OT.'),
            'TRACEABILITY': ('Actualiza la trazabilidad de tus OT', 'Registra el inicio, tiempo trabajado y avance de las órdenes asignadas para mantener la trazabilidad al día.'),
            'SCHEDULE': ('Cambio en tu programación', 'Revisa tu agenda semanal: se registró una actualización en la programación de tus órdenes de trabajo.'),
        }
        if template == 'CUSTOM':
            subject = str(request.data.get('subject') or '').strip()
            body = str(request.data.get('body') or '').strip()
            if not subject or not body:
                return response.Response({'detail': 'Ingresa asunto y mensaje para la notificación personalizada.'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            if template not in templates:
                return response.Response({'detail': 'Plantilla no válida.'}, status=status.HTTP_400_BAD_REQUEST)
            subject, body = templates[template]
        notification = queue_notification(
            event='TECHNICIAN_MANUAL_NOTIFICATION', recipient=technician,
            subject=subject, body=body, discriminator=f'manual:{template}:{timezone.now().isoformat()}',
            delivery_channel=delivery_channel,
        )
        if not notification:
            return response.Response({'detail': 'El técnico necesita un correo activo para recibir avisos por correo.'}, status=status.HTTP_400_BAD_REQUEST)
        detail = 'Aviso publicado en la bandeja del técnico.' if delivery_channel == 'SISTEMA' else 'Correo programado para el técnico.'
        return response.Response({'detail': detail}, status=status.HTTP_201_CREATED)


__all__ = [
    "LoginView", "TokenRefreshView", "CurrentUserView", "ChangePasswordView",
    "TechnicianListCreateView", "TechnicianDetailView", "TechnicianManualNotificationView",
]
