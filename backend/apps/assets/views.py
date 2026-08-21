import mimetypes
import uuid

from django.db.models import Q
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions, serializers
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import AccountProfile
from apps.accounts.permissions import IsAdministrator, IsAuthenticatedReadAdministratorWrite, user_role
from apps.audit.services import record_audit
from config.schema import UserDashboardResponseSerializer

from .models import Asset, AssignableResponsible
from .serializers import AssetClassificationSerializer, AssetDetailSerializer, AssetSerializer, PublicAssetSerializer


class AssetListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticatedReadAdministratorWrite]
    serializer_class = AssetSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
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
        queryset = Asset.objects.select_related('registered_by', 'taxonomy', 'location', 'location_map')
        if user_role(self.request.user) == AccountProfile.Role.TECHNICIAN:
            queryset = queryset.filter(incidents__work_order__technician=self.request.user).distinct()
        search = self.request.query_params.get('search', '').strip()
        if search:
            queryset = queryset.filter(Q(code__icontains=search) | Q(fm_code__icontains=search) | Q(name__icontains=search) | Q(serial_number__icontains=search))
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
        if not ordering or ordering.removeprefix('-') not in self.allowed_ordering_fields:
            raise ValidationError({'ordering': 'Ordenamiento no permitido. Usa created_at, fm_code, code o name, opcionalmente con prefijo -.'})
        return queryset.order_by(ordering)


class PublicAssetView(generics.RetrieveAPIView):
    permission_classes = [permissions.AllowAny]
    serializer_class = PublicAssetSerializer
    lookup_field = 'public_token'
    lookup_url_kwarg = 'token'
    queryset = Asset.objects.select_related('taxonomy', 'location')


class PublicAssetPhotoView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(responses={(200, 'image/*'): OpenApiTypes.BINARY})
    def get(self, request, token):
        asset = get_object_or_404(Asset, public_token=token)
        if not asset.photo:
            from rest_framework.exceptions import NotFound
            raise NotFound('El bien no tiene una fotografía disponible.')
        response = FileResponse(asset.photo.open('rb'), content_type=mimetypes.guess_type(asset.photo.name)[0] or 'application/octet-stream')
        response['Cache-Control'] = 'private, max-age=300'
        response['X-Content-Type-Options'] = 'nosniff'
        response['Content-Security-Policy'] = "default-src 'none'; sandbox"
        response['Referrer-Policy'] = 'no-referrer'
        response['Cross-Origin-Resource-Policy'] = 'cross-origin'
        return response


class AssetDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticatedReadAdministratorWrite]
    serializer_class = AssetDetailSerializer

    def get_queryset(self):
        queryset = Asset.objects.select_related('registered_by', 'taxonomy', 'location', 'location_map').prefetch_related('assignments__responsible', 'repair_records')
        if user_role(self.request.user) == AccountProfile.Role.TECHNICIAN:
            queryset = queryset.filter(incidents__work_order__technician=self.request.user).distinct()
        return queryset


class AssetPdfView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        from io import BytesIO
        from .reporting import build_asset_pdf
        asset = get_object_or_404(
            Asset.objects.select_related("taxonomy", "location").prefetch_related("incidents__work_order__technician"),
            pk=pk
        )
        report_type = request.GET.get('type', 'completo')
        content = build_asset_pdf(asset, report_type).getvalue()
        return FileResponse(
            BytesIO(content),
            content_type="application/pdf",
            as_attachment=True,
            filename=f"ficha-{report_type}-{asset.fm_code or asset.code}.pdf",
        )


class AssetClassificationView(APIView):
    permission_classes = [IsAdministrator]

    @extend_schema(request=AssetClassificationSerializer, responses={200: AssetDetailSerializer})
    def post(self, request, pk):
        asset = get_object_or_404(Asset.objects.select_related('registered_by', 'taxonomy', 'location', 'location_map'), pk=pk)
        before = {'taxonomy_id': str(asset.taxonomy_id or ''), 'fm_code': asset.fm_code}
        serializer = AssetClassificationSerializer(data=request.data, context={'asset': asset, 'request': request})
        serializer.is_valid(raise_exception=True)
        asset = serializer.save()
        after = {'taxonomy_id': str(asset.taxonomy_id or ''), 'fm_code': asset.fm_code}
        if before != after:
            record_audit(request=request, action='ASSET_CLASSIFIED', entity='Asset', entity_id=asset.id, before=before, after=after)
        return Response(AssetDetailSerializer(asset, context={'request': request}).data)


class TaxonomyModelListView(APIView):
    permission_classes = [IsAuthenticatedReadAdministratorWrite]

    @extend_schema(responses={200: serializers.ListSerializer(child=serializers.CharField())})
    def get(self, request):
        taxonomy_id = request.query_params.get('taxonomy_id')
        if not taxonomy_id:
            return Response([])
        try:
            taxonomy_id = uuid.UUID(taxonomy_id.strip())
        except ValueError:
            return Response([])
        return Response(sorted(Asset.objects.filter(taxonomy_id=taxonomy_id).exclude(model__exact='').values_list('model', flat=True).distinct()))


def _assets_for_responsibles(responsibles):
    """Return current assets assigned to any of the account's responsible records."""
    assets = Asset.objects.filter(
        assignments__responsible__in=responsibles,
        assignments__status='ACTIVA',
    ).select_related('taxonomy', 'location').prefetch_related('incidents').distinct()
    result = []
    for asset in assets:
        incident = next((item for item in asset.incidents.all() if item.status not in ['CERRADA', 'RECHAZADA']), None)
        result.append({
            'id': str(asset.id), 'code': asset.code, 'fm_code': asset.fm_code, 'name': asset.name,
            'taxonomy': asset.taxonomy.name if asset.taxonomy else None, 'condition': asset.condition,
            'operational_status': asset.operational_status,
            'repair_status': incident.get_status_display() if incident else None,
            'location_id': str(asset.location_id) if asset.location_id else None,
            'location': f'{asset.location.building} - {asset.location.room}' if asset.location else 'Desconocida',
            'photo_url': asset.photo.url if asset.photo else None,
        })
    return result


def _responsibles_for_user(user):
    """Resolve the different legacy references used when a person was assigned.

    Assignments created before the user import can reference the worker code,
    account-profile UUID, Django user UUID, username, or e-mail.  All of those
    identifiers belong to the same signed-in person and must be considered so
    the self-service dashboard never silently hides their assets.
    """
    profile = getattr(user, 'account_profile', None)
    identifiers = {
        value.strip()
        for value in (
            str(user.pk),
            user.username or '',
            user.email or '',
            str(profile.pk) if profile else '',
            profile.worker_code if profile else '',
        )
        if value and value.strip()
    }
    return AssignableResponsible.objects.filter(
        external_reference__in=identifiers,
        active=True,
    )


class UserDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(responses={200: UserDashboardResponseSerializer})
    def get(self, request):
        try:
            profile = request.user.account_profile
            worker_code = profile.worker_code.strip()
        except AccountProfile.DoesNotExist:
            return Response({'detail': 'Perfil de cuenta no encontrado.'}, status=404)
        responsibles = _responsibles_for_user(request.user)
        responsible = responsibles.first()
        return Response({
            'profile': {
                'id': str(profile.id),
                'display_name': responsible.display_name if responsible else (request.user.get_full_name() or request.user.username),
                'area_name': responsible.area_name if responsible else '',
                'worker_code': worker_code,
            },
            'assigned_assets': _assets_for_responsibles(responsibles),
        })


class UserProfileView(APIView):
    permission_classes = [IsAdministrator]

    @extend_schema(responses={200: UserDashboardResponseSerializer})
    def get(self, request, pk):
        responsible = get_object_or_404(AssignableResponsible, pk=pk, active=True)
        return Response({'profile': {'id': str(responsible.id), 'display_name': responsible.display_name, 'area_name': responsible.area_name, 'worker_code': responsible.external_reference}, 'assigned_assets': _assets_for_responsibles([responsible])})
