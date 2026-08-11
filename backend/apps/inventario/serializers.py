from rest_framework import serializers
from apps.inventario.models import Movimiento
from apps.catalogo.models import Material, Pieza
from django.contrib.auth import get_user_model
from apps.inventario.services import (
    registrar_salida_material,
    registrar_salida_pieza,
    registrar_entrada_material,
    registrar_entrada_pieza,
    registrar_baja_material,
    registrar_baja_pieza,
)

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
            "cantidad_cajas",
            "fecha", "responsable", "responsable_nombre", "referencia_externa",
            "lote_id", "observaciones",
        ]

    def get_responsable_nombre(self, obj) -> str:
        if obj.responsable:
            return obj.responsable.get_full_name() or obj.responsable.username
        return "N/A"


def _resolver_cantidad_por_caja(attrs):
    """
    Si se envió 'cantidad_cajas', recalcula 'cantidad' (en unidades) del lado
    del servidor como cantidad_cajas * material.unidades_por_caja, en vez de
    confiar en un total en unidades enviado manualmente. Devuelve attrs
    modificado in-place. Lanza ValidationError si el material no se maneja
    por caja. 'material_id' ya viene resuelto a instancia de Material gracias
    a PrimaryKeyRelatedField. No valida que 'cantidad' quede presente al
    final: eso lo hace cada serializer en su propio validate().
    """
    cantidad_cajas = attrs.get("cantidad_cajas")
    if cantidad_cajas:
        material = attrs.get("material_id")
        if material and (material.unidad_manejo != "caja" or not material.unidades_por_caja):
            raise serializers.ValidationError({
                "cantidad_cajas": f"'{material.nombre}' no se maneja por caja."
            })
        attrs["cantidad"] = cantidad_cajas * material.unidades_por_caja
    return attrs


class SalidaMaterialSerializer(serializers.Serializer):
    material_id = serializers.PrimaryKeyRelatedField(queryset=Material.objects.all())
    cantidad = serializers.IntegerField(min_value=1, required=False)
    cantidad_cajas = serializers.IntegerField(min_value=1, required=False, allow_null=True, default=None)
    responsable_id = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    referencia_externa = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    observaciones = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        attrs = _resolver_cantidad_por_caja(attrs)
        if not attrs.get("cantidad"):
            raise serializers.ValidationError({"cantidad": "Indica la cantidad o la cantidad de cajas."})
        return attrs

    def create(self, validated_data):
        return registrar_salida_material(
            material=validated_data["material_id"],
            cantidad=validated_data["cantidad"],
            responsable=validated_data["responsable_id"],
            referencia_externa=validated_data["referencia_externa"],
            observaciones=validated_data["observaciones"],
            cantidad_cajas=validated_data.get("cantidad_cajas"),
        )


class SalidaPiezaSerializer(serializers.Serializer):
    pieza_id = serializers.PrimaryKeyRelatedField(queryset=Pieza.objects.all())
    responsable_id = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    referencia_externa = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    observaciones = serializers.CharField(required=False, allow_blank=True, default="")
    # None = todas las hijas disponibles; [] = solo el contenedor; [ids] = solo esas hijas
    piezas_hijas_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        allow_empty=True,
        default=None,
    )

    def create(self, validated_data):
        return registrar_salida_pieza(
            pieza=validated_data["pieza_id"],
            responsable=validated_data["responsable_id"],
            referencia_externa=validated_data["referencia_externa"],
            observaciones=validated_data["observaciones"],
            piezas_hijas_ids=validated_data["piezas_hijas_ids"],
        )

class EntradaMaterialSerializer(serializers.Serializer):
    material_id = serializers.PrimaryKeyRelatedField(queryset=Material.objects.all())
    cantidad = serializers.IntegerField(min_value=1, required=False)
    cantidad_cajas = serializers.IntegerField(min_value=1, required=False, allow_null=True, default=None)
    responsable_id = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    observaciones = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        attrs = _resolver_cantidad_por_caja(attrs)
        if not attrs.get("cantidad"):
            raise serializers.ValidationError({"cantidad": "Indica la cantidad o la cantidad de cajas."})
        return attrs

    def create(self, validated_data):
        return registrar_entrada_material(
            material=validated_data["material_id"],
            cantidad=validated_data["cantidad"],
            responsable=validated_data["responsable_id"],
            observaciones=validated_data["observaciones"],
            cantidad_cajas=validated_data.get("cantidad_cajas"),
        )

class EntradaPiezaSerializer(serializers.Serializer):
    pieza_id = serializers.PrimaryKeyRelatedField(queryset=Pieza.objects.all())
    responsable_id = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    observaciones = serializers.CharField(required=False, allow_blank=True, default="")

    def create(self, validated_data):
        return registrar_entrada_pieza(
            pieza=validated_data["pieza_id"],
            responsable=validated_data["responsable_id"],
            observaciones=validated_data["observaciones"],
        )

class BajaMaterialSerializer(serializers.Serializer):
    material_id = serializers.PrimaryKeyRelatedField(queryset=Material.objects.all())
    cantidad = serializers.IntegerField(min_value=1, required=False)
    cantidad_cajas = serializers.IntegerField(min_value=1, required=False, allow_null=True, default=None)
    responsable_id = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    observaciones = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        attrs = _resolver_cantidad_por_caja(attrs)
        if not attrs.get("cantidad"):
            raise serializers.ValidationError({"cantidad": "Indica la cantidad o la cantidad de cajas."})
        return attrs

    def create(self, validated_data):
        return registrar_baja_material(
            material=validated_data["material_id"],
            cantidad=validated_data["cantidad"],
            responsable=validated_data["responsable_id"],
            observaciones=validated_data["observaciones"],
            cantidad_cajas=validated_data.get("cantidad_cajas"),
        )

class BajaPiezaSerializer(serializers.Serializer):
    pieza_id = serializers.PrimaryKeyRelatedField(queryset=Pieza.objects.all())
    responsable_id = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    observaciones = serializers.CharField(required=False, allow_blank=True, default="")

    def create(self, validated_data):
        return registrar_baja_pieza(
            pieza=validated_data["pieza_id"],
            responsable=validated_data["responsable_id"],
            observaciones=validated_data["observaciones"],
        )

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

    def get_ultimo_movimiento(self, obj) -> dict | None:
        ultimo = obj.movimientos.filter(tipo="salida").order_by("-fecha").first()
        if ultimo:
            return {
                "fecha": ultimo.fecha,
                "responsable": ultimo.responsable.get_full_name() or ultimo.responsable.username if ultimo.responsable else "N/A",
                "referencia_externa": ultimo.referencia_externa,
                "lote_id": ultimo.lote_id,
            }
        return None
