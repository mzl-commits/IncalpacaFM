
from rest_framework import generics

from apps.accounts.permissions import IsAdministrator

from .models import AuditEvent
from .serializers import AuditEventSerializer


class AuditEventListView(generics.ListAPIView):
    permission_classes = [IsAdministrator]
    serializer_class = AuditEventSerializer
    queryset = AuditEvent.objects.select_related("actor").all()[:500]
