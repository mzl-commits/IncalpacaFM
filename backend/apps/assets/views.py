
import uuid

from django.db.models import Q
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import (
    IsAdministrator,
    IsAuthenticatedReadAdministratorWrite,
)
from apps.audit.services import record_audit

from .models import Asset
from .serializers import (
    AssetClassificationSerializer,
    AssetDetailSerializer,
    AssetSerializer,
    PublicAssetSerializer,
)


class AssetListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticatedReadAdministratorWrite]
    serializer_class = AssetSerializer
    allowed_ordering_fields = {'created_at', 'fm_code', 'code', 'name'}

    def _boolean_query_param(self, name):
        value = self.request.query_params.get(name)
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized == 'true':
            return True
        if normalized == 'false':
            return False
        raise ValidationError({name: 'Usa true o false.'})

    def get_queryset(self):
        queryset = Asset.objects.select_related(
            'registered_by', 'taxonomy', 'location', 'location_map',
        )
        search = self.request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(
                Q(code__icontains=search)
                | Q(fm_code__icontains=search)
                | Q(name__icontains=search)
                | Q(serial_number__icontains=search)
            )

        classification_pending = self._boolean_query_param('classification_pending')
        if classification_pending is not None:
            queryset = queryset.filter(fm_code__isnull=classification_pending)

        has_fm_code = self._boolean_query_param('has_fm_code')
        if has_fm_code is not None:
            queryset = queryset.filter(fm_code__isnull=not has_fm_code)

        taxonomy_id = self.request.query_params.get('taxonomy_id')
        if taxonomy_id is not None:
            try:
                taxonomy_id = uuid.UUID(taxonomy_id.strip())
            except (AttributeError, TypeError, ValueError):
                raise ValidationError({'taxonomy_id': 'Ingresa un UUID válido.'}) from None
            queryset = queryset.filter(taxonomy_id=taxonomy_id)

        ordering = self.request.query_params.get('ordering', '-created_at').strip()
        field_name = ordering.removeprefix('-')
        if not ordering or field_name not in self.allowed_ordering_fields:
            raise ValidationError({
                'ordering': (
                    'Ordenamiento no permitido. Usa created_at, fm_code, code o name, '
                    'opcionalmente con prefijo -.'
                )
            })
        return queryset.order_by(ordering)


class PublicAssetView(generics.RetrieveAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = PublicAssetSerializer
    lookup_field = 'public_token'
    lookup_url_kwarg = 'token'
    queryset = Asset.objects.select_related('taxonomy', 'location')


class AssetDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticatedReadAdministratorWrite]
    serializer_class = AssetDetailSerializer
    queryset = Asset.objects.select_related(
        'registered_by', 'taxonomy', 'location', 'location_map',
    ).prefetch_related('assignments__responsible', 'repair_records')


class AssetClassificationView(APIView):
    permission_classes = [IsAdministrator]

    @extend_schema(
        request=AssetClassificationSerializer,
        responses={200: AssetDetailSerializer},
    )
    def post(self, request, pk):
        asset = get_object_or_404(
            Asset.objects.select_related(
                'registered_by', 'taxonomy', 'location', 'location_map',
            ),
            pk=pk,
        )
        before = {
            'taxonomy_id': str(asset.taxonomy_id or ''),
            'fm_code': asset.fm_code,
        }
        serializer = AssetClassificationSerializer(
            data=request.data,
            context={'asset': asset, 'request': request},
        )
        serializer.is_valid(raise_exception=True)
        asset = serializer.save()
        after = {
            'taxonomy_id': str(asset.taxonomy_id or ''),
            'fm_code': asset.fm_code,
        }
        if before != after:
            record_audit(
                request=request,
                action='ASSET_CLASSIFIED',
                entity='Asset',
                entity_id=asset.id,
                before=before,
                after=after,
            )
        return Response(AssetDetailSerializer(asset, context={'request': request}).data)
