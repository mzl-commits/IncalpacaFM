from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import generics, permissions, response, serializers, status, views

from apps.accounts.permissions import IsAdministrator

from .models import ReporterProfile
from apps.assets.models import AssetAssignment
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


class ReporterLookupView(views.APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        parameters=[],
        responses={200: inline_serializer(
            name="ReporterLookupResponse",
            fields={
                "found": serializers.BooleanField(),
                "conflict": serializers.BooleanField(required=False),
                "reporter": serializers.DictField(required=False),
                "assignedAssets": serializers.ListField(child=serializers.DictField(), required=False),
            },
        )},
    )
    def get(self, request):
        dni = "".join(ch for ch in request.query_params.get("dni", "") if ch.isdigit())
        code = request.query_params.get("worker_code", "").strip().upper()
        if len(dni) != 8 and not code:
            return response.Response({"found": False})
        reporter = ReporterProfile.objects.filter(dni=dni).first() if len(dni) == 8 else None
        code_record = reporter.worker_codes.filter(worker_code=code).first() if reporter and code else None
        if code and not reporter:
            code_record = ReporterProfile.objects.filter(worker_codes__worker_code=code).first()
            reporter = code_record
        if not reporter:
            return response.Response({"found": False})
        if code and not reporter.worker_codes.filter(worker_code=code).exists():
            return response.Response({"found": False, "conflict": True}, status=status.HTTP_409_CONFLICT)
        assignments = AssetAssignment.objects.filter(
            responsible__external_reference=code, status="ACTIVA"
        ).select_related("asset", "location")
        return response.Response({
            "found": True,
            "reporter": {"dni": reporter.dni, "workerCode": code or reporter.worker_codes.first().worker_code, "name": reporter.full_name, "email": reporter.email},
            "assignedAssets": [{"id": str(item.asset_id), "code": item.asset.fm_code or item.asset.code, "name": item.asset.name, "locationId": str((item.location or item.asset.location).id) if (item.location or item.asset.location) else ""} for item in assignments],
        })
