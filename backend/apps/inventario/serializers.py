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
    material_codigo_ekipu = serializers.CharField(source="material.codigo_ekipu", read_only=True, default=None)
    material_nombre = serializers.CharField(source="material.nombre", read_only=True)
    material_ubicacion = serializers.CharField(source="material.ubicacion_fisica", read_only=True, default="")
    material_stock_minimo = serializers.IntegerField(source="material.stock_minimo", read_only=True, default=0)
    material_cantidad_total = serializers.IntegerField(source="material.cantidad_total", read_only=True, default=0)
    pieza_codigo = serializers.CharField(source="pieza.codigo", read_only=True, default=None)
    responsable_nombre = serializers.SerializerMethodField()
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)
    almacen_nombre = serializers.CharField(source="almacen.nombre", read_only=True)

    class Meta:
        model = Movimiento
        fields = [
            "id", "material", "material_codigo", "material_codigo_ekipu", "material_nombre",
            "material_ubicacion", "material_stock_minimo", "material_cantidad_total",
            "pieza", "pieza_codigo", "tipo", "tipo_display", "cantidad",
            "cantidad_cajas",
            "fecha", "responsable", "responsable_nombre", "referencia_externa",
            "lote_id", "observaciones", "almacen", "almacen_nombre",
        ]

    def get_responsable_nombre(self, obj) -> str:
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

def _validar_almacen_forzado(self, objeto, campo):
    """
    valida el almacén ANTES de guardar, en vez de crear el
    Movimiento y recién después comprobar con check_almacen_objeto (patrón
    viejo: rollback post-save en la vista). 'objeto' es un Material o una
    Pieza — si es Pieza, se valida el almacén de su propio material (el
    material real de ESA pieza, no el de un eventual contenedor).
    'self.context["almacen_forzado"]' lo pasa la vista: es None para
    Administrador, y el id del almacén asignado para Almacenero/Inspector.
    """
    almacen_forzado = self.context.get("almacen_forzado")
    if almacen_forzado is None:
        return
    almacen_id = objeto.almacen_id if hasattr(objeto, "almacen_id") else objeto.material.almacen_id
    if almacen_id != almacen_forzado:
        raise serializers.ValidationError({
            campo: "No puedes registrar movimientos fuera de tu almacén asignado."
        })

class SalidaMaterialSerializer(serializers.Serializer):
    material_id = serializers.PrimaryKeyRelatedField(queryset=Material.objects.all())
    cantidad = serializers.IntegerField(min_value=1, required=False)
    cantidad_cajas = serializers.IntegerField(min_value=1, required=False, allow_null=True, default=None)
    responsable_id = serializers.PrimaryKeyRelatedField(queryset=User.objects.all())
    referencia_externa = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    observaciones = serializers.CharField(required=False, allow_blank=True, default="")
    lote_id = serializers.CharField(max_length=40, required=False, allow_blank=True, default="")

    def validate(self, attrs):
        attrs = _resolver_cantidad_por_caja(attrs)
        if not attrs.get("cantidad"):
            raise serializers.ValidationError({"cantidad": "Indica la cantidad o la cantidad de cajas."})
        _validar_almacen_forzado(self, attrs["material_id"], "material_id")
        return attrs

    def create(self, validated_data):
        return registrar_salida_material(
            material=validated_data["material_id"],
            cantidad=validated_data["cantidad"],
            responsable=validated_data["responsable_id"],
            referencia_externa=validated_data["referencia_externa"],
            observaciones=validated_data["observaciones"],
            cantidad_cajas=validated_data.get("cantidad_cajas"),
            lote_id=validated_data.get("lote_id", ""),
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

    def validate(self, attrs):
        _validar_almacen_forzado(self, attrs["pieza_id"], "pieza_id")
        return attrs

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
        _validar_almacen_forzado(self, attrs["material_id"], "material_id")
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

    def validate(self, attrs):
        _validar_almacen_forzado(self, attrs["pieza_id"], "pieza_id")
        return attrs

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
        _validar_almacen_forzado(self, attrs["material_id"], "material_id")
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

    def validate(self, attrs):
        _validar_almacen_forzado(self, attrs["pieza_id"], "pieza_id")
        return attrs

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

# ─── Solicitudes de movimiento (flujo de aprobación) ─────────────────────────

from apps.inventario.models import SolicitudMovimiento 


class SolicitudMovimientoSerializer(serializers.ModelSerializer):
    """Serializer de lectura completo para un administrador."""
    tipo_display = serializers.CharField(source="get_tipo_display", read_only=True)
    estado_display = serializers.CharField(source="get_estado_display", read_only=True)
    material_nombre = serializers.CharField(source="material.nombre", read_only=True, default=None)
    material_codigo = serializers.CharField(source="material.codigo", read_only=True, default=None)
    pieza_codigo = serializers.CharField(source="pieza.codigo", read_only=True, default=None)
    # Nombre del tipo de material al que pertenece la pieza (ej. "Martillo")
    pieza_nombre = serializers.CharField(source="pieza.material.nombre", read_only=True, default=None)
    # Detalle específico de la pieza individual (ej. "Martillo de Juan", "Estuche azul")
    pieza_detalle = serializers.CharField(source="pieza.detalle", read_only=True, default=None)
    solicitado_por_nombre = serializers.SerializerMethodField()
    resuelto_por_nombre = serializers.SerializerMethodField()

    class Meta:
        model = SolicitudMovimiento
        fields = [
            "id", "tipo", "tipo_display", "estado", "estado_display",
            "material", "material_nombre", "material_codigo",
            "pieza", "pieza_codigo", "pieza_nombre", "pieza_detalle", "piezas_hijas_ids",
            "cantidad", "cantidad_cajas",
            "referencia_externa", "observaciones",
            "solicitado_por", "solicitado_por_nombre",
            "creado_en", "resuelto_en",
            "resuelto_por", "resuelto_por_nombre",
            "motivo_rechazo", "motivo_no_entrega", "movimiento",
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
        elif tipo in (SolicitudMovimiento.Tipo.SALIDA_PIEZA, SolicitudMovimiento.Tipo.BAJA_PIEZA):
            if not pieza:
                raise serializers.ValidationError({"pieza": "Requerido para este tipo de solicitud."})
        return attrs


class AprobarSolicitudSerializer(serializers.Serializer):
    """Payload vacío — la aprobación no requiere datos adicionales del admin."""
    pass


class RechazarSolicitudSerializer(serializers.Serializer):
    motivo_rechazo = serializers.CharField(required=False, allow_blank=True, default="")


# ─── Grupos de Solicitudes (Objetivo 1) ──────────────────────────────────────

from apps.inventario.models import GrupoSolicitud  # noqa: E402
from apps.workorders.models import WorkOrder  # noqa: E402


class GrupoSolicitudItemInputSerializer(serializers.Serializer):
    """Representa un item individual dentro del payload de creación de un grupo."""
    TIPOS_PERMITIDOS_V1 = ["salida_material"]

    tipo = serializers.ChoiceField(choices=SolicitudMovimiento.Tipo.choices)
    material = serializers.IntegerField()  # obligatorio en v1 (no pieza)
    cantidad = serializers.IntegerField(required=False, min_value=1, allow_null=True, default=None)
    cantidad_cajas = serializers.IntegerField(required=False, allow_null=True, min_value=1, default=None)
    observaciones = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_tipo(self, value):
        if value not in self.TIPOS_PERMITIDOS_V1:
            raise serializers.ValidationError(
                "Por ahora los grupos de solicitud solo admiten salida_material. "
                "Para piezas, usa el flujo de solicitud individual existente."
            )
        return value


class GrupoSolicitudCreateSerializer(serializers.Serializer):
    """Serializer para crear un GrupoSolicitud con N items de un solo POST."""
    work_order = serializers.PrimaryKeyRelatedField(
        queryset=WorkOrder.objects.all(), required=False, allow_null=True, default=None
    )
    observaciones = serializers.CharField(required=False, allow_blank=True, default="")
    items = serializers.ListField(
        child=GrupoSolicitudItemInputSerializer(),
        allow_empty=False,
        help_text="Lista de materiales solicitados en este grupo (mínimo 1).",
    )


class GrupoSolicitudDetailSerializer(serializers.ModelSerializer):
    """Serializer de lectura para un GrupoSolicitud y sus items."""
    solicitado_por_nombre = serializers.SerializerMethodField()
    work_order_code = serializers.CharField(source="work_order.code", read_only=True, default=None)
    work_order_detail = serializers.SerializerMethodField()
    estado = serializers.CharField(read_only=True)
    items = SolicitudMovimientoSerializer(many=True, read_only=True)

    class Meta:
        model = GrupoSolicitud
        fields = [
            "id", "solicitado_por", "solicitado_por_nombre",
            "work_order", "work_order_code", "work_order_detail", "observaciones",
            "creado_en", "estado", "items",
        ]

    def get_solicitado_por_nombre(self, obj):
        if obj.solicitado_por:
            return obj.solicitado_por.get_full_name() or obj.solicitado_por.username
        return None

    def get_work_order_detail(self, obj):
        if not obj.work_order:
            return None
        ot = obj.work_order
        tech_principal = (
            ot.technician.get_full_name() or ot.technician.username
            if ot.technician else "N/A"
        )
        tech_apoyo = [
            u.get_full_name() or u.username
            for u in ot.supporting_technicians.all()
        ]
        return {
            "id": str(ot.id),
            "code": ot.code,
            "status": ot.status,
            "status_display": ot.get_status_display(),
            "technician_name": tech_principal,
            "supporting_technicians": tech_apoyo,
        }

class ResolverParcialItemSerializer(serializers.Serializer):
    """Representa la decisión del administrador para un item individual del grupo."""
    solicitud_id = serializers.IntegerField()
    aprobado = serializers.BooleanField()
    motivo_no_entrega = serializers.CharField(required=False, allow_blank=True, default="")

    def validate(self, attrs):
        if not attrs.get("aprobado") and not attrs.get("motivo_no_entrega", "").strip():
            raise serializers.ValidationError({
                "motivo_no_entrega": "El motivo de no entrega es obligatorio si el material no es aprobado."
            })
        return attrs

class ResolverParcialGrupoSerializer(serializers.Serializer):
    """Payload para aprobación/rechazo parcial de un grupo."""
    items = serializers.ListField(
        child=ResolverParcialItemSerializer(),
        allow_empty=False,
        help_text="Decisión para cada item del grupo.",
    )
