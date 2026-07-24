from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

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
        last = Asset.objects.order_by('-created_at').first()
        sequence = (int(last.code.rsplit('-', 1)[-1]) + 1) if last else 188
        user, _ = get_user_model().objects.get_or_create(username='facility.demo', defaults={'first_name': 'Facility', 'last_name': 'Management'})
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
