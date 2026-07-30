from rest_framework import serializers
from apps.inventario.models import Movimiento
from apps.catalogo.models import Material, Pieza
from django.contrib.auth import get_user_model

User = get_user_model()


class MovimientoSerializer(serializers.ModelSerializer):
    material_codigo = serializers.CharField(source="material.codigo", read_only=True)
    material_nombre = serializers.CharField(source="material.nombre", read_only=True)
    pieza_codigo = serializers.CharField(source="pieza.codigo", read_only=True, default=None)
    responsable_nombre = serializers.SerializerMethodField()
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)

    class Meta:
        model = Movimiento
        fields = [
            "id", "material", "material_codigo", "material_nombre",
            "pieza", "pieza_codigo", "tipo", "tipo_display", "cantidad",
            "fecha", "responsable", "responsable_nombre", "referencia_externa",
            "lote_id", "observaciones",
        ]

    def get_responsable_nombre(self, obj):
        if obj.responsable:
            return obj.responsable.get_full_name() or obj.responsable.username
        return "N/A"


class SalidaMaterialSerializer(serializers.Serializer):
    material_id = serializers.IntegerField()
    cantidad = serializers.IntegerField(min_value=1)
    responsable_id = serializers.IntegerField()
    referencia_externa = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    observaciones = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_material_id(self, value):
        if not Material.objects.filter(pk=value).exists():
            raise serializers.ValidationError("El material especificado no existe.")
        return value

    def validate_responsable_id(self, value):
        if not User.objects.filter(pk=value).exists():
            raise serializers.ValidationError("El usuario responsable especificado no existe.")
        return value


class SalidaPiezaSerializer(serializers.Serializer):
    pieza_id = serializers.IntegerField()
    responsable_id = serializers.IntegerField()
    referencia_externa = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    observaciones = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_pieza_id(self, value):
        if not Pieza.objects.filter(pk=value).exists():
            raise serializers.ValidationError("La pieza especificada no existe.")
        return value

    def validate_responsable_id(self, value):
        if not User.objects.filter(pk=value).exists():
            raise serializers.ValidationError("El usuario responsable especificado no existe.")
        return value


class EntradaMaterialSerializer(serializers.Serializer):
    material_id = serializers.IntegerField()
    cantidad = serializers.IntegerField(min_value=1)
    responsable_id = serializers.IntegerField()
    observaciones = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_material_id(self, value):
        if not Material.objects.filter(pk=value).exists():
            raise serializers.ValidationError("El material especificado no existe.")
        return value

    def validate_responsable_id(self, value):
        if not User.objects.filter(pk=value).exists():
            raise serializers.ValidationError("El usuario responsable especificado no existe.")
        return value


class EntradaPiezaSerializer(serializers.Serializer):
    pieza_id = serializers.IntegerField()
    responsable_id = serializers.IntegerField()
    observaciones = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_pieza_id(self, value):
        if not Pieza.objects.filter(pk=value).exists():
            raise serializers.ValidationError("La pieza especificada no existe.")
        return value

    def validate_responsable_id(self, value):
        if not User.objects.filter(pk=value).exists():
            raise serializers.ValidationError("El usuario responsable especificado no existe.")
        return value


class BajaMaterialSerializer(serializers.Serializer):
    material_id = serializers.IntegerField()
    cantidad = serializers.IntegerField(min_value=1)
    responsable_id = serializers.IntegerField()
    observaciones = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_material_id(self, value):
        if not Material.objects.filter(pk=value).exists():
            raise serializers.ValidationError("El material especificado no existe.")
        return value

    def validate_responsable_id(self, value):
        if not User.objects.filter(pk=value).exists():
            raise serializers.ValidationError("El usuario responsable especificado no existe.")
        return value


class BajaPiezaSerializer(serializers.Serializer):
    pieza_id = serializers.IntegerField()
    responsable_id = serializers.IntegerField()
    observaciones = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_pieza_id(self, value):
        if not Pieza.objects.filter(pk=value).exists():
            raise serializers.ValidationError("La pieza especificada no existe.")
        return value

    def validate_responsable_id(self, value):
        if not User.objects.filter(pk=value).exists():
            raise serializers.ValidationError("El usuario responsable especificado no existe.")
        return value


class PiezaPrestadaSerializer(serializers.ModelSerializer):
    material_codigo = serializers.CharField(source="material.codigo", read_only=True)
    material_nombre = serializers.CharField(source="material.nombre", read_only=True)
    padre_codigo = serializers.CharField(source="padre.codigo", read_only=True, default=None)
    ultimo_movimiento = serializers.SerializerMethodField()

    class Meta:
        model = Pieza
        fields = [
            "id", "codigo", "estado", "material", "material_codigo", "material_nombre",
            "padre", "padre_codigo", "ultimo_movimiento",
        ]

    def get_ultimo_movimiento(self, obj):
        ultimo = obj.movimientos.filter(tipo="salida").order_by("-fecha").first()
        if ultimo:
            return {
                "fecha": ultimo.fecha,
                "responsable": ultimo.responsable.get_full_name() or ultimo.responsable.username if ultimo.responsable else "N/A",
                "referencia_externa": ultimo.referencia_externa,
                "lote_id": ultimo.lote_id,
            }
        return None
