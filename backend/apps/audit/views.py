
from django.db.models import Q
from rest_framework import generics

from apps.accounts.permissions import IsAdministrator

from .models import AuditEvent
from .serializers import AuditEventSerializer


class AuditEventListView(generics.ListAPIView):
    permission_classes = [IsAdministrator]
    serializer_class = AuditEventSerializer
    queryset = AuditEvent.objects.select_related("actor").all()

    def get_queryset(self):
        queryset = super().get_queryset()
        query = self.request.query_params.get("q", "").strip()
        entity = self.request.query_params.get("entity", "").strip()
        action = self.request.query_params.get("action", "").strip()
        actor = self.request.query_params.get("actor", "").strip()
        date_from = self.request.query_params.get("date_from", "").strip()
        date_to = self.request.query_params.get("date_to", "").strip()
        if query:
            queryset = queryset.filter(
                Q(action__icontains=query)
                | Q(entity__icontains=query)
                | Q(entity_id__icontains=query)
                | Q(actor__username__icontains=query)
                | Q(actor__first_name__icontains=query)
                | Q(actor__last_name__icontains=query)
            )
        if entity:
            queryset = queryset.filter(entity=entity)
        if action:
            queryset = queryset.filter(action=action)
        if actor:
            queryset = queryset.filter(actor_id=actor)
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)
        return queryset[:1000]
