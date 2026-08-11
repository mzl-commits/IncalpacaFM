import hashlib
import json

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.assets.models import Asset, AssetAssignment, AssignableResponsible, Location
from apps.assets.location_map_serializers import LocationMapSummarySerializer
from apps.privacy.services import record_privacy_event

from .models import AssignmentOperation, DeliveryAct, DeliveryEvidence, DeliverySignature


class EvidenceInputSerializer(serializers.Serializer):
    category = serializers.CharField(max_length=30)
    name = serializers.CharField(max_length=180)
    mime_type = serializers.CharField(max_length=100)
    size = serializers.IntegerField(min_value=0)
    description = serializers.CharField(required=False, allow_blank=True)
    content_data_url = serializers.CharField(required=False, allow_blank=True)


class SignatureInputSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=DeliverySignature.Role.choices)
    method = serializers.ChoiceField(choices=DeliverySignature.Method.choices)
    signer_name = serializers.CharField(max_length=160)
    signer_role = serializers.CharField(max_length=120)
    consent = serializers.BooleanField()
    signature_data_url = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        if not attrs['consent']:
            raise serializers.ValidationError('El firmante debe aceptar el consentimiento.')
        if attrs['method'] == DeliverySignature.Method.DRAWN and not attrs.get('signature_data_url'):
            raise serializers.ValidationError('La firma dibujada es obligatoria.')
        return attrs


class AssignmentSerializer(serializers.ModelSerializer):
    asset = serializers.SerializerMethodField()
    responsible = serializers.SerializerMethodField()
    location = serializers.SerializerMethodField()
    delivery_status = serializers.SerializerMethodField()
    act = serializers.SerializerMethodField()
    responsible_history = serializers.SerializerMethodField()
    repair_history = serializers.SerializerMethodField()
    observations = serializers.SerializerMethodField()

    class Meta:
        model = AssetAssignment
        fields = ('id', 'asset', 'responsible', 'location', 'start_date', 'end_date',
                  'status', 'change_reason', 'observations', 'delivery_status', 'act',
                  'responsible_history', 'repair_history')

    def get_asset(self, obj) -> dict:
        return {'id': str(obj.asset_id), 'code': obj.asset.code,
                'display_code': obj.asset.fm_code or obj.asset.code, 'name': obj.asset.name,
                'brand': obj.asset.brand, 'model': obj.asset.model, 'condition': obj.asset.condition,
                'assignment_status': obj.asset.assignment_status}

    def get_responsible(self, obj) -> dict:
        return {'id': str(obj.responsible_id), 'reference': obj.responsible.external_reference,
                'type': obj.responsible.type, 'name': obj.responsible.display_name,
                'area': obj.responsible.area_name}

    def get_location(self, obj) -> dict | None:
        if not obj.location:
            return None
        reference_map = getattr(obj.asset, 'location_map', None)
        if reference_map is None:
            reference_map = obj.location.reference_maps.filter(active=True).first()
        marker = None
        if reference_map is not None and obj.asset.location_map_id == reference_map.id:
            if obj.asset.location_marker_x is not None and obj.asset.location_marker_y is not None:
                marker = {'x': str(obj.asset.location_marker_x), 'y': str(obj.asset.location_marker_y)}
        return {'id': str(obj.location_id), 'zone': obj.location.zone, 'building': obj.location.building,
                'area': obj.location.area, 'room': obj.location.room,
                'specific_location': obj.location.specific_location,
                'reference_map': LocationMapSummarySerializer(reference_map, context=self.context).data if reference_map else None,
                'marker': marker}

    def get_delivery_status(self, obj) -> str:
        if obj.asset.assignment_status == 'En traslado':
            return 'EN_TRASLADO'
        if obj.asset.assignment_status == 'Devuelto':
            return 'DEVUELTO'
        if hasattr(obj, 'delivery_act'):
            return 'ENTREGADO' if obj.delivery_act.status == DeliveryAct.Status.ISSUED else 'ASIGNADO'
        return 'ASIGNADO'

    def get_observations(self, obj) -> str:
        act = getattr(obj, 'delivery_act', None)
        return act.observations if act else ''

    def get_act(self, obj) -> dict | None:
        if not hasattr(obj, 'delivery_act'):
            return None
        act = obj.delivery_act
        return {'id': str(act.id), 'code': act.code, 'status': act.status,
                'hash_sha256': act.hash_sha256, 'issued_at': act.issued_at}

    def get_responsible_history(self, obj) -> list[dict]:
        assignments = obj.asset.assignments.select_related('responsible', 'location').order_by('-start_date')
        return [{
            'id': str(item.id), 'responsible': item.responsible.display_name,
            'responsible_type': item.responsible.type, 'area': item.responsible.area_name,
            'location': (
                f'{item.location.zone} / {item.location.building} / {item.location.area} / {item.location.room}'
                if item.location else ''
            ),
            'start_date': item.start_date, 'end_date': item.end_date,
            'status': item.status, 'reason': item.change_reason,
        } for item in assignments]

    def get_repair_history(self, obj) -> list[dict]:
        return [{
            'id': str(item.id), 'work_order': item.work_order, 'type': item.type,
            'status': item.status, 'reported_at': item.reported_at,
            'completed_at': item.completed_at, 'issue': item.issue,
            'work_performed': item.work_performed, 'technician_name': item.technician_name,
            'provider': item.provider, 'cost': str(item.cost),
            'resulting_condition': item.resulting_condition,
        } for item in obj.asset.repair_records.all()]


class CatalogSerializer(serializers.Serializer):
    responsibles = serializers.ListField()
    locations = serializers.ListField()
    assets = serializers.ListField()


class DeliveryCreateSerializer(serializers.Serializer):
    asset_id = serializers.UUIDField()
    responsible_id = serializers.UUIDField()
    location_id = serializers.UUIDField()
    assignment_reason = serializers.CharField()
    condition = serializers.CharField(max_length=40)
    accessories = serializers.CharField(required=False, allow_blank=True)
    observations = serializers.CharField(required=False, allow_blank=True)
    checklist = serializers.DictField()
    privacy_accepted = serializers.BooleanField()
    evidence = EvidenceInputSerializer(many=True)
    signatures = SignatureInputSerializer(many=True)

    def validate(self, attrs):
        if not attrs['privacy_accepted']:
            raise serializers.ValidationError({'privacy_accepted': 'Debes aceptar el aviso de privacidad.'})
        required_checks = ('inspected', 'qr_legible', 'accessories_complete', 'no_unreported_damage')
        if not all(attrs['checklist'].get(key) for key in required_checks):
            raise serializers.ValidationError({'checklist': 'Completa todas las verificaciones obligatorias.'})
        roles = {item['role'] for item in attrs['signatures']}
        if roles != {DeliverySignature.Role.DELIVERER, DeliverySignature.Role.RECEIVER}:
            raise serializers.ValidationError({'signatures': 'Se requieren las dos conformidades.'})
        categories = {item['category'] for item in attrs['evidence']}
        if not {'general', 'qr'}.issubset(categories):
            raise serializers.ValidationError({'evidence': 'Adjunta una foto general y una del QR.'})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        evidence = validated_data.pop('evidence')
        signatures = validated_data.pop('signatures')
        asset = Asset.objects.select_for_update().get(id=validated_data.pop('asset_id'))
        responsible = AssignableResponsible.objects.get(id=validated_data.pop('responsible_id'), active=True)
        location = Location.objects.get(id=validated_data.pop('location_id'), active=True)
        request = self.context.get('request')
        user = request.user if request and request.user.is_authenticated else get_user_model().objects.get(username='facility.demo')

        active = AssetAssignment.objects.filter(asset=asset, status='ACTIVA').first()
        if active and active.responsible_id == responsible.id and hasattr(active, 'delivery_act'):
            raise serializers.ValidationError('Este bien ya fue entregado a ese responsable.')
        if active:
            active.status = 'FINALIZADA'
            active.end_date = timezone.now()
            active.save(update_fields=('status', 'end_date'))

        assignment = AssetAssignment.objects.create(
            asset=asset, responsible=responsible, location=location, start_date=timezone.now(),
            change_reason=validated_data.pop('assignment_reason'), registered_by=user)
        next_number = DeliveryAct.objects.count() + 1
        act = DeliveryAct.objects.create(
            assignment=assignment, code=f'ACT-ENT-{timezone.localdate().year}-{next_number:06d}',
            created_by=user, **validated_data)
        for item in evidence:
            content = item.get('content_data_url', '')
            DeliveryEvidence.objects.create(
                act=act, hash_sha256=hashlib.sha256(content.encode()).hexdigest(), **item)
        for item in signatures:
            DeliverySignature.objects.create(act=act, session_reference=str(self.context.get('request_id', '')), **item)
        record_privacy_event(request=request, context="EVIDENCIA", subject_reference=act.code)
        record_privacy_event(request=request, context="FIRMA", subject_reference=act.code)

        canonical = {
            'act': act.code, 'assignment': str(assignment.id), 'asset': asset.code,
            'responsible': responsible.external_reference, 'location': str(location.id),
            'condition': act.condition, 'checklist': act.checklist,
            'signatures': sorted(item['role'] for item in signatures),
        }
        act.hash_sha256 = hashlib.sha256(
            json.dumps(canonical, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        act.status = DeliveryAct.Status.ISSUED
        act.issued_at = timezone.now()
        act.save(update_fields=('hash_sha256', 'status', 'issued_at'))
        asset.location = location
        asset.assignment_status = 'Entregado'
        asset.save(update_fields=('location', 'assignment_status'))
        return assignment


class AssignmentOperationSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=AssignmentOperation.Type.choices)
    reason = serializers.CharField()
    responsible_id = serializers.UUIDField(required=False)
    location_id = serializers.UUIDField(required=False)
    condition = serializers.CharField(required=False, allow_blank=True)
    observations = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        operation = attrs['type']
        if operation == AssignmentOperation.Type.REASSIGN and not attrs.get('responsible_id'):
            raise serializers.ValidationError({'responsible_id': 'Selecciona el nuevo responsable.'})
        if operation in (AssignmentOperation.Type.REASSIGN, AssignmentOperation.Type.TRANSFER) and not attrs.get('location_id'):
            raise serializers.ValidationError({'location_id': 'Selecciona la ubicación destino.'})
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        assignment = AssetAssignment.objects.select_for_update().select_related('asset').get(
            id=self.context['assignment_id'], status='ACTIVA')
        user, _ = get_user_model().objects.get_or_create(username='facility.demo')
        operation = validated_data['type']
        previous = assignment.asset.assignment_status
        resulting = previous
        if operation == AssignmentOperation.Type.TRANSFER:
            location = Location.objects.get(id=validated_data['location_id'], active=True)
            assignment.location = location
            assignment.save(update_fields=('location',))
            assignment.asset.location = location
            assignment.asset.assignment_status = 'En traslado'
            assignment.asset.save(update_fields=('location', 'assignment_status'))
            resulting = 'EN_TRASLADO'
        elif operation == AssignmentOperation.Type.RETURN:
            assignment.status = 'FINALIZADA'
            assignment.end_date = timezone.now()
            assignment.save(update_fields=('status', 'end_date'))
            assignment.asset.assignment_status = 'Devuelto'
            assignment.asset.save(update_fields=('assignment_status',))
            resulting = 'DEVUELTO'
        else:
            responsible = AssignableResponsible.objects.get(id=validated_data['responsible_id'], active=True)
            location = Location.objects.get(id=validated_data['location_id'], active=True)
            assignment.status = 'FINALIZADA'
            assignment.end_date = timezone.now()
            assignment.save(update_fields=('status', 'end_date'))
            new_assignment = AssetAssignment.objects.create(
                asset=assignment.asset, responsible=responsible, location=location,
                start_date=timezone.now(), change_reason=validated_data['reason'], registered_by=user)
            assignment.asset.location = location
            assignment.asset.assignment_status = 'Asignado'
            assignment.asset.save(update_fields=('location', 'assignment_status'))
            resulting = 'ASIGNADO'
            validated_data['new_assignment_id'] = str(new_assignment.id)
        audit_payload = {
            key: str(value) if key.endswith('_id') else value
            for key, value in validated_data.items()
        }
        AssignmentOperation.objects.create(
            assignment=assignment, type=operation, reason=validated_data['reason'],
            previous_state=previous, resulting_state=resulting, payload=audit_payload, registered_by=user)
        return assignment
