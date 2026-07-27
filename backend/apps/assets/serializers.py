from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.audit.services import record_audit

from .models import Asset, Location, Taxonomy


class AssetSerializer(serializers.ModelSerializer):
    entry_type_label = serializers.CharField(source='get_entry_type_display', read_only=True)
    registered_by_name = serializers.SerializerMethodField()
    public_url = serializers.SerializerMethodField()

    class Meta:
        model = Asset
        fields = ('id', 'code', 'public_token', 'public_url', 'entry_type', 'entry_type_label', 'name',
                  'description', 'brand', 'model', 'serial_number', 'condition', 'criticality', 'administrative_status',
                  'operational_status', 'assignment_status', 'registered_by_name', 'created_at', 'entry_payload')
        read_only_fields = ('id', 'code', 'public_token', 'public_url', 'administrative_status',
                            'operational_status', 'assignment_status', 'registered_by_name', 'created_at')

    def get_registered_by_name(self, obj):
        return obj.registered_by.get_full_name() or obj.registered_by.username

    def get_public_url(self, obj):
        request = self.context.get('request')
        path = f'/q/{obj.public_token}'
        origin = request.headers.get('X-Frontend-Origin', 'http://localhost:5173') if request else 'http://localhost:5173'
        return f'{origin.rstrip("/")}{path}'

    @transaction.atomic
    def create(self, validated_data):
        payload = validated_data.pop('entry_payload', {})
        existing_sequences = (
            int(code.rsplit('-', 1)[-1])
            for code in Asset.objects.values_list('code', flat=True)
            if code.rsplit('-', 1)[-1].isdigit()
        )
        sequence = max(existing_sequences, default=187) + 1
        request = self.context.get('request')
        user = request.user if request and request.user.is_authenticated else get_user_model().objects.get(username='facility.demo')
        taxonomy = None
        if not payload.get('classificationPending'):
            taxonomy, _ = Taxonomy.objects.get_or_create(
                asset_type=payload.get('assetType', ''), category=payload.get('category', ''),
                subcategory=payload.get('subcategory', ''),
                defaults={'specialty': payload.get('technicalSpecialty', 'No aplica')},
            )
        location = None
        if not payload.get('locationPending'):
            location, _ = Location.objects.get_or_create(
                zone=payload.get('zone', ''), building=payload.get('building', ''),
                area=payload.get('locationArea', ''), room=payload.get('room', ''),
                defaults={'specific_location': payload.get('specificLocation', '')},
            )
        asset = Asset.objects.create(
            code=f'INC-BIEN-{timezone.localdate().year}-{sequence:06d}', registered_by=user,
            taxonomy=taxonomy, location=location, entry_payload=payload, **validated_data,
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
    classification = serializers.SerializerMethodField()
    general_location = serializers.SerializerMethodField()

    class Meta:
        model = Asset
        fields = ('code', 'name', 'brand', 'model', 'condition', 'administrative_status',
                  'operational_status', 'classification', 'general_location', 'updated_at')

    def get_classification(self, obj):
        return 'Por confirmar' if not obj.taxonomy else f'{obj.taxonomy.asset_type} · {obj.taxonomy.subcategory}'

    def get_general_location(self, obj):
        return 'Por confirmar' if not obj.location else f'{obj.location.building} · {obj.location.area}'


class AssetDetailSerializer(AssetSerializer):
    taxonomy_detail = serializers.SerializerMethodField()
    location_detail = serializers.SerializerMethodField()
    responsible_history = serializers.SerializerMethodField()
    repair_history = serializers.SerializerMethodField()

    class Meta(AssetSerializer.Meta):
        fields = AssetSerializer.Meta.fields + (
            'taxonomy_detail', 'location_detail', 'responsible_history', 'repair_history',
        )

    def get_taxonomy_detail(self, obj):
        if not obj.taxonomy:
            return None
        return {
            'asset_type': obj.taxonomy.asset_type, 'category': obj.taxonomy.category,
            'subcategory': obj.taxonomy.subcategory, 'specialty': obj.taxonomy.specialty,
        }

    def get_location_detail(self, obj):
        if not obj.location:
            return None
        return {
            'zone': obj.location.zone, 'building': obj.location.building,
            'area': obj.location.area, 'room': obj.location.room,
            'specific_location': obj.location.specific_location,
        }

    def get_responsible_history(self, obj):
        return [{
            'id': str(item.id), 'responsible': item.responsible.display_name,
            'type': item.responsible.type, 'area': item.responsible.area_name,
            'start_date': item.start_date, 'end_date': item.end_date,
            'status': item.status, 'reason': item.change_reason,
        } for item in obj.assignments.select_related('responsible').order_by('-start_date')]

    def get_repair_history(self, obj):
        return [{
            'id': str(item.id), 'work_order': item.work_order, 'type': item.type,
            'status': item.status, 'reported_at': item.reported_at,
            'completed_at': item.completed_at, 'issue': item.issue,
            'work_performed': item.work_performed, 'technician_name': item.technician_name,
            'provider': item.provider, 'cost': str(item.cost),
            'resulting_condition': item.resulting_condition,
        } for item in obj.repair_records.all()]
