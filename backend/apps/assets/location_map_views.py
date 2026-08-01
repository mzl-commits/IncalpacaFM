from pathlib import Path

from django.db import transaction
from django.db.models import Prefetch
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils.cache import patch_vary_headers
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import generics, status
from rest_framework.exceptions import NotFound
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdministrator
from apps.audit.services import record_audit

from .location_map_serializers import (
    LocationMapSummarySerializer,
    LocationMapUploadSerializer,
    LocationSerializer,
)
from .models import Location, LocationMap

IMAGE_CONTENT_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}


class LocationListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = LocationSerializer
    pagination_class = None

    def get_queryset(self):
        active_maps = LocationMap.objects.filter(active=True).select_related("uploaded_by")
        return (
            Location.objects.filter(active=True)
            .prefetch_related(
                Prefetch("reference_maps", queryset=active_maps, to_attr="active_maps")
            )
            .order_by("zone", "building", "area", "room")
        )


class LocationMapListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAdministrator]
    parser_classes = [MultiPartParser, FormParser]
    pagination_class = None

    def get_queryset(self):
        return LocationMap.objects.filter(active=True).select_related(
            "location",
            "uploaded_by",
        ).order_by("location__zone", "location__building", "location__area", "location__room")

    def get_serializer_class(self):
        if self.request.method == "POST":
            return LocationMapUploadSerializer
        return LocationMapSummarySerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        location_map = serializer.save()
        response_serializer = LocationMapSummarySerializer(
            location_map,
            context={"request": request},
        )
        return Response(response_serializer.data, status=201)


class LocationMapDeactivateView(APIView):
    permission_classes = [IsAdministrator]

    @extend_schema(responses={204: None})
    @transaction.atomic
    def delete(self, request, pk):
        location_map = get_object_or_404(
            LocationMap.objects.select_for_update().select_related("location"),
            pk=pk,
        )
        if location_map.active:
            location_map.active = False
            location_map.save(update_fields=("active",))
            record_audit(
                request=request,
                action="LOCATION_MAP_REMOVED",
                entity="LocationMap",
                entity_id=location_map.id,
                before={
                    "location_id": str(location_map.location_id),
                    "version": location_map.version,
                    "active": True,
                },
                after={
                    "location_id": str(location_map.location_id),
                    "version": location_map.version,
                    "active": False,
                },
            )
        return Response(status=status.HTTP_204_NO_CONTENT)


class LocationMapImageView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(responses={(200, "image/*"): OpenApiTypes.BINARY})
    def get(self, request, pk):
        location_map = get_object_or_404(LocationMap, pk=pk)
        filename = Path(location_map.image.name).name
        content_type = IMAGE_CONTENT_TYPES.get(Path(filename).suffix.lower())
        if not content_type:
            raise NotFound("El formato de la imagen no está permitido.")
        try:
            image_file = location_map.image.open("rb")
        except (FileNotFoundError, OSError, ValueError) as exc:
            raise NotFound("La imagen del ambiente no está disponible.") from exc

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
        patch_vary_headers(response, ("Authorization",))
        return response
