from drf_spectacular.utils import extend_schema
from rest_framework import generics

from apps.accounts.permissions import IsAdministrator

from .models import ReporterProfile
from .serializers import ReporterProfileSerializer


@extend_schema(tags=["Organización"])
class ReporterProfileListView(generics.ListAPIView):
    permission_classes = [IsAdministrator]
    serializer_class = ReporterProfileSerializer

    def get_queryset(self):
        query = self.request.query_params.get("q", "").strip()
        queryset = ReporterProfile.objects.prefetch_related("worker_codes").order_by("full_name")
        if query:
            queryset = queryset.filter(full_name__icontains=query) | queryset.filter(dni__icontains=query) | queryset.filter(worker_codes__worker_code__icontains=query)
        return queryset.distinct()
