from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Q
from rest_framework import serializers

from apps.audit.services import record_audit
from .file_validation import validate_uploaded_file
from apps.taxonomy.services import (
    allocate_fm_identifier,
    allocate_internal_code,
    assign_fm_identifier,
)

from .models import Asset, Location, LocationMap, Taxonomy


class AssetSerializer(serializers.ModelSerializer):
    entry_type_label = serializers.CharField(source='get_entry_type_display', read_only=True)
    photo = serializers.ImageField(write_only=True, required=False, allow_null=True)

    def validate_photo(self, value):
        return validate_uploaded_file(value) if value else value
    registered_by_name = serializers.SerializerMethodField()
    public_url = serializers.SerializerMethodField()
    photo_url = serializers.SerializerMethodField()
    display_code = serializers.SerializerMethodField()
    taxonomy_id = serializers.PrimaryKeyRelatedField(
        source='taxonomy', queryset=Taxonomy.objects.all(), required=False,
        allow_null=True, write_only=True,
    )
    taxonomy_detail = serializers.SerializerMethodField()
    location_id = serializers.PrimaryKeyRelatedField(
        source='location',
        queryset=Location.objects.filter(active=True),
        required=False,
        allow_null=True,
        write_only=True,
    )
    location_map_id = serializers.PrimaryKeyRelatedField(
        source='location_map',
        queryset=LocationMap.objects.all(),
        required=False,
        allow_null=True,
        write_only=True,
    )
    location_marker_x = serializers.DecimalField(
        max_digits=9,
        decimal_places=8,
        min_value=0,
        max_value=1,
        required=False,
        allow_null=True,
        write_only=True,
    )
    location_marker_y = serializers.DecimalField(
        max_digits=9,
        decimal_places=8,
        min_value=0,
        max_value=1,
        required=False,
        allow_null=True,
        write_only=True,
    )
    location_detail = serializers.SerializerMethodField()

    class Meta:
        model = Asset
        fields = ('id', 'code', 'fm_code', 'display_code', 'public_token', 'public_url',
                  'photo', 'photo_url',
                  'entry_type', 'entry_type_label', 'name',
                  'description', 'brand', 'model', 'serial_number', 'condition', 'criticality', 'administrative_status',
                  'operational_status', 'assignment_status', 'taxonomy_id', 'taxonomy_detail',
                  'location_id', 'location_map_id', 'location_marker_x',
                  'location_marker_y', 'location_detail', 'registered_by_name',
                  'created_at', 'entry_payload')
        read_only_fields = ('id', 'code', 'fm_code', 'display_code', 'public_token', 'public_url', 'photo_url', 'administrative_status',
                            'operational_status', 'assignment_status', 'registered_by_name', 'created_at')

    def get_registered_by_name(self, obj) -> str:
        return obj.registered_by.get_full_name() or obj.registered_by.username

    def get_public_url(self, obj) -> str:
        request = self.context.get('request')
        path = f'/q/{obj.public_token}'
        origin = request.headers.get('X-Frontend-Origin', 'http://localhost:5173') if request else 'http://localhost:5173'
        return f'{origin.rstrip("/")}{path}'

    def get_photo_url(self, obj) -> str | None:
        if not obj.photo:
            return None
        request = self.context.get('request')
        path = f'/api/v1/public/assets/{obj.public_token}/photo/'
        return request.build_absolute_uri(path) if request else path

    def validate_photo(self, value):
        if value.size > 8 * 1024 * 1024:
            raise serializers.ValidationError('La fotografía no puede superar 8 MB.')
        if value.image.format not in {'JPEG', 'PNG', 'WEBP'}:
            raise serializers.ValidationError('Usa una imagen JPG, PNG o WEBP.')
        width, height = value.image.size
        if width < 320 or height < 240:
            raise serializers.ValidationError('La fotografía debe tener al menos 320 × 240 px.')
        if width * height > 25_000_000:
            raise serializers.ValidationError('La resolución de la fotografía es demasiado alta.')
        return value

    def get_display_code(self, obj) -> str:
        return obj.fm_code or obj.code

    def get_taxonomy_detail(self, obj) -> dict | None:
        if not obj.taxonomy:
            return None
        return {
            'id': str(obj.taxonomy.id),
            'prefix': obj.taxonomy.prefix,
            'name': obj.taxonomy.name,
            'asset_type': obj.taxonomy.asset_type,
            'category': obj.taxonomy.category,
            'subcategory': obj.taxonomy.subcategory,
            'specialty': obj.taxonomy.specialty,
        }

    def get_location_detail(self, obj) -> dict | None:
        if not obj.location:
            return None
        marker = None
        if obj.location_map_id:
            marker = {
                'map_id': str(obj.location_map_id),
                'map_version': obj.location_map.version,
                'x': str(obj.location_marker_x),
                'y': str(obj.location_marker_y),
            }
        return {
            'id': str(obj.location.id),
            'zone': obj.location.zone,
            'building': obj.location.building,
            'area': obj.location.area,
            'room': obj.location.room,
            'specific_location': obj.entry_payload.get(
                'specificLocation',
                obj.location.specific_location,
            ),
            'marker': marker,
        }

    def validate(self, attrs):
        if self.instance and 'taxonomy' in attrs:
            requested = attrs['taxonomy']
            if requested != self.instance.taxonomy:
                raise serializers.ValidationError({
                    'taxonomy_id': (
                        'Usa la acción de clasificación para cambiar una taxonomía pendiente.'
                    )
                })
        payload = attrs.get('entry_payload', {})
        if payload.get('locationPending'):
            attrs['location'] = None
            attrs['location_map'] = None
            attrs['location_marker_x'] = None
            attrs['location_marker_y'] = None
            return attrs

        location = attrs.get('location')
        location_map = attrs.get('location_map')
        marker_x = attrs.get('location_marker_x')
        marker_y = attrs.get('location_marker_y')
        if location_map and location is None:
            raise serializers.ValidationError({
                'location_id': 'Selecciona el ambiente al que pertenece el mapa.'
            })
        if location is not None:
            active_map = location.reference_maps.filter(active=True).first()
            errors = {}
            if active_map and location_map is None:
                errors['location_map_id'] = (
                    'Este ambiente tiene una imagen referencial. Coloca el marcador.'
                )
            if location_map and location_map.location_id != location.id:
                errors['location_map_id'] = 'El mapa no pertenece al ambiente seleccionado.'
            if location_map and not location_map.active:
                errors['location_map_id'] = (
                    'La imagen del ambiente cambió. Actualiza la ubicación y vuelve a marcarla.'
                )
            if location_map and (marker_x is None or marker_y is None):
                errors['location_marker'] = 'Coloca el marcador sobre la imagen del ambiente.'
            if not location_map and (marker_x is not None or marker_y is not None):
                errors['location_marker'] = 'No se puede guardar un marcador sin mapa.'
            if errors:
                raise serializers.ValidationError(errors)
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        payload = validated_data.pop('entry_payload', {})
        taxonomy = validated_data.pop('taxonomy', None)
        location = validated_data.pop('location', None)
        location_map = validated_data.pop('location_map', None)
        marker_x = validated_data.pop('location_marker_x', None)
        marker_y = validated_data.pop('location_marker_y', None)
        request = self.context.get('request')
        user = request.user if request and request.user.is_authenticated else get_user_model().objects.get(username='facility.demo')
        classification_pending = payload.get('classificationPending', taxonomy is None)
        if classification_pending:
            taxonomy = None
        if taxonomy is None and not classification_pending:
            prefix = str(payload.get('taxonomyPrefix', '')).strip().upper()
            candidates = Taxonomy.objects.filter(active=True)
            if prefix:
                candidates = candidates.filter(prefix=prefix)
            else:
                candidates = candidates.filter(
                    asset_type=payload.get('assetType', ''),
                    category=payload.get('category', ''),
                    subcategory=payload.get('subcategory', ''),
                )
            if candidates.count() != 1:
                raise serializers.ValidationError({
                    'taxonomy_id': 'Selecciona una taxonomía válida del catálogo maestro.'
                })
            taxonomy = candidates.first()
        if taxonomy and (
            not taxonomy.active
            or not taxonomy.issuance_enabled
            or taxonomy.review_status != Taxonomy.ReviewStatus.VALIDATED
        ):
            raise serializers.ValidationError({
                'taxonomy_id': 'La taxonomía seleccionada no está habilitada para emitir códigos.'
            })
        if not payload.get('locationPending'):
            if location is None:
                location, _ = Location.objects.get_or_create(
                    zone=payload.get('zone', ''), building=payload.get('building', ''),
                    area=payload.get('locationArea', ''), room=payload.get('room', ''),
                    defaults={'specific_location': payload.get('specificLocation', '')},
                )
            payload['locationId'] = str(location.id)
        else:
            location = None
            location_map = None
            marker_x = None
            marker_y = None
        code = allocate_internal_code()
        fm_code = None
        fm_sequence_value = None
        if taxonomy:
            fm_code, fm_sequence_value = allocate_fm_identifier(taxonomy)
            validated_data.setdefault('criticality', taxonomy.default_criticality)
            payload.update({
                'classificationPending': False,
                'taxonomyId': str(taxonomy.id),
                'taxonomyPrefix': taxonomy.prefix,
                'assetType': taxonomy.asset_type,
                'category': taxonomy.category,
                'subcategory': taxonomy.subcategory,
                'technicalSpecialty': taxonomy.specialty,
            })
        asset = Asset.objects.create(
            code=code, fm_code=fm_code, fm_sequence_value=fm_sequence_value,
            registered_by=user, taxonomy=taxonomy, location=location,
            location_map=location_map,
            location_marker_x=marker_x,
            location_marker_y=marker_y,
            entry_payload=payload, **validated_data,
        )
        if request:
            record_audit(
                request=request,
                action='ASSET_CREATED',
                entity='Asset',
                entity_id=asset.id,
                after={
                    'code': asset.code,
                    'fm_code': asset.fm_code,
                    'taxonomy_id': str(asset.taxonomy_id or ''),
                },
            )
        return asset

    @transaction.atomic
    def update(self, instance, validated_data):
        request = self.context["request"]
        before = {
            field: getattr(instance, field)
            for field in (
                "name",
                "description",
                "brand",
                "model",
                "serial_number",
                "condition",
                "criticality",
            )
        }
        asset = super().update(instance, validated_data)
        record_audit(
            request=request,
            action="ASSET_UPDATED",
            entity="Asset",
            entity_id=asset.id,
            before=before,
            after={
                field: getattr(asset, field)
                for field in before
            },
        )
        return asset


class PublicAssetSerializer(serializers.ModelSerializer):
    code = serializers.SerializerMethodField()
    classification = serializers.SerializerMethodField()
    general_location = serializers.SerializerMethodField()
    display_code = serializers.SerializerMethodField()
    photo_url = serializers.SerializerMethodField()
    report_url = serializers.SerializerMethodField()
    service_tracking = serializers.SerializerMethodField()

    class Meta:
        model = Asset
        fields = ('code', 'display_code', 'name', 'brand', 'model', 'condition', 'administrative_status',
                  'operational_status', 'classification', 'general_location', 'photo_url',
                  'report_url', 'service_tracking', 'updated_at')

    def get_code(self, obj) -> str:
        return obj.fm_code or obj.code

    def get_display_code(self, obj) -> str:
        return obj.fm_code or obj.code

    def get_classification(self, obj) -> str:
        return 'Por confirmar' if not obj.taxonomy else f'{obj.taxonomy.asset_type} · {obj.taxonomy.subcategory}'

    def get_general_location(self, obj) -> str:
        return 'Por confirmar' if not obj.location else f'{obj.location.building} · {obj.location.area}'


    def get_photo_url(self, obj) -> str | None:
        if not obj.photo:
            return None
        request = self.context.get('request')
        path = f'/api/v1/public/assets/{obj.public_token}/photo/'
        return request.build_absolute_uri(path) if request else path

    def get_report_url(self, obj) -> str:
        request = self.context.get('request')
        origin = request.headers.get('X-Frontend-Origin', 'http://localhost:5173') if request else 'http://localhost:5173'
        return f'{origin.rstrip("/")}/reportar/{obj.public_token}'

    def get_service_tracking(self, obj) -> dict | None:
        request = self.context.get('request')
        incident = (
            obj.incidents.exclude(status='RECHAZADA')
            .filter(~Q(status='CERRADA') | Q(work_order__isnull=False))
            .select_related('work_order')
            .order_by('-updated_at')
            .first()
        )
        if not incident:
            return None

        order = getattr(incident, 'work_order', None)
        if order and order.status == 'CANCELADA':
            return None

        work_status = order.status if order else ''
        current_stage = 'received'
        current_label = 'Recibimos tu reporte'
        if incident.status == 'EN_REVISION':
            current_stage, current_label = 'evaluation', 'Estamos revisando el reporte'
        elif order:
            work_state_labels = {
                'PROGRAMADA': ('assigned', 'Un técnico fue asignado'),
                'EN_PROCESO': ('repair', 'Estamos trabajando en el bien'),
                'PENDIENTE_DE_SUPERVISION': ('review', 'El trabajo está en revisión'),
                'PENDIENTE_DE_VALIDACION': ('review', 'El trabajo está en revisión'),
                'PENDIENTE_DE_CONFORMIDAD': ('review', 'Esperamos la confirmación final'),
                'DEVUELTA': ('repair', 'Se solicitó una corrección'),
            }
            work_state_labels.update({
                'CERRADA': ('completed', 'La atención fue finalizada'),
                'PENDIENTE_DE_CONFORMIDAD': ('completed', 'La atención fue finalizada'),
            })
            current_stage, current_label = work_state_labels.get(
                work_status,
                ('assigned', 'La atención fue programada'),
            )
        elif incident.status == 'APROBADA':
            current_stage, current_label = 'assigned', 'La atención fue aprobada'

        stage_order = ['sent', 'received', 'evaluation', 'assigned', 'repair', 'review', 'completed']
        current_index = stage_order.index(current_stage)
        labels = {
            'sent': 'Reporte enviado',
            'received': 'Reporte recibido',
            'evaluation': 'Revisión inicial',
            'assigned': 'Técnico asignado',
            'repair': 'Trabajo en curso',
            'review': 'Revisión final',
        }
        labels['review'] = 'Validación administrativa'
        labels['completed'] = 'Atención finalizada'
        steps = []
        for index, stage in enumerate(stage_order):
            state = 'complete' if index < current_index else 'current' if index == current_index else 'pending'
            timestamp = None
            if stage == 'sent' or (stage == 'received' and index <= current_index):
                timestamp = incident.created_at.isoformat()
            elif stage == 'repair' and order and order.started_at and index <= current_index:
                timestamp = order.started_at.isoformat()
            elif stage == 'review' and order and order.finished_at and index <= current_index:
                timestamp = order.finished_at.isoformat()
            elif stage == 'completed' and order and order.closed_at and index <= current_index:
                timestamp = order.closed_at.isoformat()
            elif stage in {'evaluation', 'assigned'} and index <= current_index:
                timestamp = incident.updated_at.isoformat()
            steps.append({
                'id': stage,
                'label': labels[stage],
                'state': state,
                'at': timestamp,
            })

        return {
            'case_code': incident.code,
            'current_stage': current_stage,
            'current_label': current_label,
            'updated_at': (order.updated_at if order else incident.updated_at).isoformat(),
            'steps': steps,
            'satisfaction': {
                'available': bool(order and order.status in {'CERRADA', 'PENDIENTE_DE_CONFORMIDAD'} and not getattr(order, 'satisfaction', None)),
                'completed': bool(order and getattr(order, 'satisfaction', None)),
                'url': f'{request.headers.get("X-Frontend-Origin", "http://localhost:5173").rstrip("/")}/seguimiento-solicitud/{incident.code}' if request else f'/seguimiento-solicitud/{incident.code}',
            },
        }


class AssetDetailSerializer(AssetSerializer):
    location_detail = serializers.SerializerMethodField()
    responsible_history = serializers.SerializerMethodField()
    repair_history = serializers.SerializerMethodField()

    class Meta(AssetSerializer.Meta):
        fields = AssetSerializer.Meta.fields + (
            'location_detail', 'responsible_history', 'repair_history',
        )

    def get_location_detail(self, obj) -> dict | None:
        if not obj.location:
            return None
        return {
            'zone': obj.location.zone, 'building': obj.location.building,
            'area': obj.location.area, 'room': obj.location.room,
            'specific_location': obj.location.specific_location,
        }

    def get_responsible_history(self, obj) -> list[dict]:
        return [{
            'id': str(item.id), 'responsible': item.responsible.display_name,
            'type': item.responsible.type, 'area': item.responsible.area_name,
            'start_date': item.start_date, 'end_date': item.end_date,
            'status': item.status, 'reason': item.change_reason,
        } for item in obj.assignments.select_related('responsible').order_by('-start_date')]

    def get_repair_history(self, obj) -> list[dict]:
        return [{
            'id': str(item.id), 'work_order': item.work_order, 'type': item.type,
            'status': item.status, 'reported_at': item.reported_at,
            'completed_at': item.completed_at, 'issue': item.issue,
            'work_performed': item.work_performed, 'technician_name': item.technician_name,
            'provider': item.provider, 'cost': str(item.cost),
            'resulting_condition': item.resulting_condition,
        } for item in obj.repair_records.all()]


class AssetClassificationSerializer(serializers.Serializer):
    taxonomy_id = serializers.PrimaryKeyRelatedField(
        source='taxonomy', queryset=Taxonomy.objects.all(),
    )

    def save(self, **kwargs):
        return assign_fm_identifier(
            self.context['asset'],
            self.validated_data['taxonomy'],
        )
