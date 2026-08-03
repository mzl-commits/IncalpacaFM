
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdministrator

from .models import Notification
from .selectors import notifications_for_user
from .serializers import NotificationSerializer
from .services import _dispatch_async


class NotificationListView(generics.ListAPIView):
    serializer_class = NotificationSerializer

    def get_queryset(self):
        return notifications_for_user(self.request.user, include_all=self.request.query_params.get('all') == '1')


class NotificationReadView(APIView):
    def post(self, request, pk):
        notification = get_object_or_404(Notification, pk=pk, recipient=request.user)
        if not notification.read_at:
            notification.read_at = timezone.now()
            notification.save(update_fields=('read_at', 'updated_at'))
        return Response(NotificationSerializer(notification).data)


class NotificationRetryView(APIView):
    permission_classes = [IsAdministrator]
    serializer_class = NotificationSerializer

    @extend_schema(request=None, responses={202: NotificationSerializer})
    def post(self, request, pk):
        notification = get_object_or_404(Notification, pk=pk)
        if notification.status == Notification.Status.SENT:
            return Response({'detail': 'La notificación ya fue enviada.'}, status=status.HTTP_409_CONFLICT)
        notification.status = Notification.Status.PENDING
        notification.available_at = timezone.now()
        notification.last_error = ''
        notification.save(update_fields=('status', 'available_at', 'last_error', 'updated_at'))
        _dispatch_async(notification.id)
        return Response(NotificationSerializer(notification).data, status=status.HTTP_202_ACCEPTED)
