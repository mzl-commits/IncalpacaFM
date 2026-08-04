import re
import uuid
from pathlib import Path

from django.db import transaction
from django.db.models import Count, Exists, OuterRef, Prefetch, Q
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils.cache import patch_vary_headers
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import generics
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdministrator, IsTechnicianOrAdministrator
from apps.audit.services import record_audit

from .facility_plan_serializers import (
    FacilityPlanDetailSerializer,
    FacilityPlanReconcileResponseSerializer,
    FacilityPlanSerializer,
    facility_plan_summary,
)
from .models import Asset, FacilityPlan, FacilityPlanMarker

PLACEHOLDER_PATTERN = re.compile(r"^[A-Z][A-Z0-9]{0,15}-XXXX$")
FILTER_PARAMETERS = [
    OpenApiParameter(
        "taxonomy",
        uuid.UUID,
        description="UUID de la taxonomía asociada al marcador.",
        required=False,
    ),
    OpenApiParameter(
        "status",
        str,
        enum=[value for value, _ in FacilityPlanMarker.Status.choices],
        description="Estado de conciliación del marcador.",
        required=False,
    ),
]
IMAGE_CONTENT_TYPES = {
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
}


def _summary_queryset():
    return FacilityPlan.objects.annotate(
        marker_total=Count("markers"),
        marker_matched=Count(
            "markers",
            filter=Q(markers__status=FacilityPlanMarker.Status.MATCHED),
        ),
        marker_taxonomy_only=Count(
            "markers",
            filter=Q(markers__status=FacilityPlanMarker.Status.TAXONOMY_ONLY),
        ),
        marker_placeholder=Count(
            "markers",
            filter=Q(markers__status=FacilityPlanMarker.Status.PLACEHOLDER),
        ),
        marker_unknown=Count(
            "markers",
            filter=Q(markers__status=FacilityPlanMarker.Status.UNKNOWN),
        ),
    )


def _marker_filters(request) -> dict:
    filters: dict = {}
    taxonomy = request.query_params.get("taxonomy", "").strip()
    if taxonomy:
        try:
            filters["taxonomy_id"] = uuid.UUID(taxonomy)
        except (TypeError, ValueError):
            raise ValidationError({"taxonomy": "Ingresa un UUID de taxonomía válido."}) from None
    status_value = request.query_params.get("status", "").strip().upper()
    if status_value:
        valid_statuses = {value for value, _ in FacilityPlanMarker.Status.choices}
        if status_value not in valid_statuses:
            raise ValidationError(
                {"status": ("Usa MATCHED, TAXONOMY_ONLY, PLACEHOLDER o UNKNOWN.")}
            )
        filters["status"] = status_value
    return filters


class FacilityPlanListView(generics.ListAPIView):
    permission_classes = [IsTechnicianOrAdministrator]
    serializer_class = FacilityPlanSerializer
    pagination_class = None

    @extend_schema(parameters=FILTER_PARAMETERS)
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        queryset = _summary_queryset()
        filters = _marker_filters(self.request)
        if filters:
            matching_markers = FacilityPlanMarker.objects.filter(
                plan_id=OuterRef("pk"),
                **filters,
            )
            queryset = queryset.filter(Exists(matching_markers))
        return queryset.order_by("code", "version", "id")


class FacilityPlanDetailView(generics.RetrieveAPIView):
    permission_classes = [IsTechnicianOrAdministrator]
    serializer_class = FacilityPlanDetailSerializer

    @extend_schema(parameters=FILTER_PARAMETERS)
    def get(self, request, *args, **kwargs):
        return super().get(request, *args, **kwargs)

    def get_queryset(self):
        marker_queryset = FacilityPlanMarker.objects.select_related("taxonomy", "asset").order_by(
            "source_index"
        )
        filters = _marker_filters(self.request)
        if filters:
            marker_queryset = marker_queryset.filter(**filters)
        return _summary_queryset().prefetch_related(
            Prefetch(
                "markers",
                queryset=marker_queryset,
                to_attr="filtered_markers",
            )
        )


class FacilityPlanImageView(APIView):
    permission_classes = [IsTechnicianOrAdministrator]

    @extend_schema(responses={(200, "image/*"): OpenApiTypes.BINARY})
    def get(self, request, pk):
        plan = get_object_or_404(FacilityPlan, pk=pk)
        if not plan.image or not plan.image.name:
            raise NotFound("El plano no tiene una imagen disponible.")

        filename = Path(plan.image.name).name
        content_type = IMAGE_CONTENT_TYPES.get(Path(filename).suffix.lower())
        if not content_type:
            raise NotFound("El formato de la imagen del plano no está permitido.")
        try:
            image_file = plan.image.open("rb")
        except (FileNotFoundError, OSError, ValueError) as exc:
            raise NotFound("La imagen del plano no está disponible.") from exc

        response = FileResponse(
            image_file,
            as_attachment=False,
            filename=filename,
            content_type=content_type,
        )
        response["Cache-Control"] = "private, no-store, max-age=0"
        response["Pragma"] = "no-cache"
        response["X-Content-Type-Options"] = "nosniff"
        response["Content-Security-Policy"] = "default-src 'none'; sandbox"
        response["Referrer-Policy"] = "no-referrer"
        response["Cross-Origin-Resource-Policy"] = "same-origin"
        response["X-Frame-Options"] = "DENY"
        patch_vary_headers(response, ("Authorization",))
        return response


class FacilityPlanReconcileView(APIView):
    permission_classes = [IsAdministrator]

    @extend_schema(
        request=None,
        responses={200: FacilityPlanReconcileResponseSerializer},
    )
    @transaction.atomic
    def post(self, request, pk):
        plan = get_object_or_404(FacilityPlan.objects.select_for_update(), pk=pk)
        markers = list(
            FacilityPlanMarker.objects.select_for_update()
            .filter(plan=plan)
            .order_by("source_index")
        )
        exact_codes = {
            marker.raw_code
            for marker in markers
            if not PLACEHOLDER_PATTERN.fullmatch(marker.raw_code)
        }
        assets_by_code = {
            asset.fm_code: asset
            for asset in Asset.objects.select_related("taxonomy").filter(fm_code__in=exact_codes)
        }

        changed = []
        for marker in markers:
            asset = assets_by_code.get(marker.raw_code)
            if asset:
                taxonomy = asset.taxonomy
                status_value = FacilityPlanMarker.Status.MATCHED
            elif PLACEHOLDER_PATTERN.fullmatch(marker.raw_code):
                taxonomy = marker.taxonomy
                status_value = FacilityPlanMarker.Status.PLACEHOLDER
            elif marker.taxonomy_id:
                taxonomy = marker.taxonomy
                status_value = FacilityPlanMarker.Status.TAXONOMY_ONLY
            else:
                taxonomy = None
                status_value = FacilityPlanMarker.Status.UNKNOWN

            new_taxonomy_id = taxonomy.pk if taxonomy else None
            new_asset_id = asset.pk if asset else None
            if (
                marker.taxonomy_id != new_taxonomy_id
                or marker.asset_id != new_asset_id
                or marker.status != status_value
            ):
                marker.taxonomy = taxonomy
                marker.asset = asset
                marker.status = status_value
                changed.append(marker)

        if changed:
            FacilityPlanMarker.objects.bulk_update(
                changed,
                ("taxonomy", "asset", "status"),
            )
        summary = facility_plan_summary(plan)
        record_audit(
            request=request,
            action="FACILITY_PLAN_RECONCILED",
            entity="FacilityPlan",
            entity_id=plan.id,
            after={"updated": len(changed), "summary": summary},
        )
        return Response(
            {
                "plan_id": str(plan.id),
                "updated": len(changed),
                "summary": summary,
            }
        )
