from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.catalogo.models import Material, Pieza
from apps.inventario.models import Movimiento
from apps.inventario.services import (
    registrar_baja_material,
    registrar_baja_pieza,
    registrar_entrada_material,
    registrar_entrada_pieza,
    registrar_salida_material,
    registrar_salida_pieza,
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

    def get_responsable_nombre(self, obj):
        if obj.responsable:
            return obj.responsable.get_full_name() or obj.responsable.username
        return "N/A"


def _resolver_cantidad_por_caja(attrs):
    """
    Si se envió 'cantidad_cajas', recalcula 'cantidad' (en unidades) del lado
    del servidor como cantidad_cajas * material.unidades_por_caja. Soporta
    cualquier unidad_manejo que no sea "unidad" (caja, bolsa, paquete, saco,
    millar, etc.) — opción A genérica de empaque.
    Devuelve attrs modificado in-place. Lanza ValidationError si el material
    no tiene unidades_por_caja configuradas o si su unidad_manejo es "unidad".
    """
    cantidad_cajas = attrs.get("cantidad_cajas")
    if cantidad_cajas:
        material = attrs.get("material_id")
        if material:
            if material.unidad_manejo == "unidad":
                raise serializers.ValidationError({
                    "cantidad_cajas": (
                        f"'{material.nombre}' se maneja por unidad suelta; "
                        f"indica la cantidad directamente, no por empaque."
                    )
                })
            if not material.unidades_por_caja:
                raise serializers.ValidationError({
                    "cantidad_cajas": (
                        f"'{material.nombre}' no tiene configuradas las unidades "
                        f"por empaque ({material.get_unidad_manejo_display()}). "
                        f"Edita el material antes de usar este campo."
                    )
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


# ─── Solicitudes de movimiento (flujo de aprobación) ─────────────────────────

from apps.inventario.models import SolicitudMovimiento  # noqa: E402


class SolicitudMovimientoSerializer(serializers.ModelSerializer):
    """Serializer de lectura completo para un administrador."""
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)
    material_nombre = serializers.CharField(source="material.nombre", read_only=True, default=None)
    material_codigo = serializers.CharField(source="material.codigo", read_only=True, default=None)
    pieza_codigo = serializers.CharField(source="pieza.codigo", read_only=True, default=None)
    solicitado_por_nombre = serializers.SerializerMethodField()
    resuelto_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = SolicitudMovimiento
        fields = [
            "id", "tipo", "tipo_display", "estado", "estado_display",
            "material", "material_nombre", "material_codigo",
            "pieza", "pieza_codigo", "piezas_hijas_ids",
            "cantidad", "cantidad_cajas",
            "referencia_externa", "observaciones",
            "solicitado_por", "solicitado_por_nombre",
            "creado_en", "resuelto_en",
            "resuelto_por", "resuelto_por_nombre",
            "motivo_rechazo", "movimiento",
        ]

    def get_solicitado_por_nombre(self, obj):
        if obj.solicitado_por:
            return obj.solicitado_por.get_full_name() or obj.solicitado_por.username
        return None

    def get_resuelto_por_nombre(self, obj):
        if obj.resuelto_por:
            return obj.resuelto_por.get_full_name() or obj.resuelto_por.username
        return None


class SolicitudMovimientoCreateSerializer(serializers.ModelSerializer):
    """Serializer de escritura — usado por el ALMACENERO al crear una solicitud."""
    material = serializers.PrimaryKeyRelatedField(
        queryset=Material.objects.all(), required=False, allow_null=True,
    )
    pieza = serializers.PrimaryKeyRelatedField(
        queryset=Pieza.objects.all(), required=False, allow_null=True,
    )

    class Meta:
        model = SolicitudMovimiento
        fields = [
            "tipo", "material", "pieza", "piezas_hijas_ids",
            "cantidad", "cantidad_cajas",
            "referencia_externa", "observaciones",
        ]

    def validate(self, attrs):
        tipo = attrs.get("tipo")
        material = attrs.get("material")
        pieza = attrs.get("pieza")

        if tipo in (SolicitudMovimiento.Tipo.SALIDA_MATERIAL, SolicitudMovimiento.Tipo.BAJA_MATERIAL):
            if not material:
                raise serializers.ValidationError({"material": "Requerido para este tipo de solicitud."})
        elif (
            tipo in (SolicitudMovimiento.Tipo.SALIDA_PIEZA, SolicitudMovimiento.Tipo.BAJA_PIEZA)
            and not pieza
        ):
            raise serializers.ValidationError({"pieza": "Requerido para este tipo de solicitud."})
        return attrs


class AprobarSolicitudSerializer(serializers.Serializer):
    """Payload vacío — la aprobación no requiere datos adicionales del admin."""
    pass


class RechazarSolicitudSerializer(serializers.Serializer):
    motivo_rechazo = serializers.CharField(required=False, allow_blank=True, default="")
