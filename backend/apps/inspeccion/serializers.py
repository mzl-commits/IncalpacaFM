from rest_framework import serializers
from django.db import transaction

from apps.inspeccion.models import (
    PlantillaCriterio, Criterio, Inspeccion, RespuestaCriterio,
    PlanInspeccionAnual, ProgramacionInspeccion,
)

from django.contrib.auth import get_user_model

User = get_user_model()

class CriterioSerializer(serializers.ModelSerializer):
    class Meta:
        model = Criterio
        fields = ["id", "plantilla", "texto", "orden"]

class PlantillaCriterioSerializer(serializers.ModelSerializer):
    criterios = CriterioSerializer(many=True, read_only=True)

    class Meta:
        model = PlantillaCriterio
        fields = ["id", "nombre", "criterios"]

class RespuestaCriterioSerializer(serializers.ModelSerializer):
    criterio_texto = serializers.CharField(source="criterio.texto", read_only=True)

    class Meta:
        model = RespuestaCriterio
        fields = ["id", "criterio", "criterio_texto", "valor", "observacion"]

class RespuestaCriterioCrearSerializer(serializers.Serializer):
    criterio_id = serializers.IntegerField()
    valor = serializers.ChoiceField(choices=RespuestaCriterio.VALOR_CHOICES)
    observacion = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")

    def validate_criterio_id(self, value):
        if not Criterio.objects.filter(pk=value).exists():
            raise serializers.ValidationError(f"El criterio con id {value} no existe.")
        return value

class InspeccionSerializer(serializers.ModelSerializer):
    material_codigo = serializers.CharField(source="material.codigo", read_only=True)
    material_nombre = serializers.CharField(source="material.nombre", read_only=True)
    pieza_codigo = serializers.CharField(source="pieza.codigo", read_only=True, default=None)
    inspector_nombre = serializers.SerializerMethodField()
    plantilla_nombre = serializers.CharField(source="plantilla.nombre", read_only=True)
    respuestas = RespuestaCriterioSerializer(many=True, read_only=True)
    # NUEVO: la periodicidad real del material dueño (o del material del
    # contenedor, si esta inspección es de una pieza). TrimestreBadge la
    # necesita para calcular vigencia (vencida/próxima/al día); antes solo
    # vivía en el Material, no llegaba junto con la Inspeccion.
    material_periodicidad_inspeccion_dias = serializers.SerializerMethodField()

    class Meta:
        model = Inspeccion
        fields = [
            "id", "tipo", "material", "material_codigo", "material_nombre",
            "pieza", "pieza_codigo", "piezas_lote", "plantilla", "plantilla_nombre",
            "fecha", "proxima_inspeccion", "inspector", "inspector_nombre",
            "cantidad_inspeccionada", "cantidad_apta", "cantidad_no_apta",
            "resultado_general", "accion_tomada", "observaciones", "respuestas",
            "material_periodicidad_inspeccion_dias",
        ]

    def get_inspector_nombre(self, obj):
        if obj.inspector:
            return obj.inspector.get_full_name() or obj.inspector.username
        return "N/A"

    def get_material_periodicidad_inspeccion_dias(self, obj):
        material = obj.pieza.material if obj.pieza else obj.material
        return material.periodicidad_inspeccion_dias if material else None

class InspeccionCrearSerializer(serializers.ModelSerializer):
    respuestas = RespuestaCriterioCrearSerializer(many=True, write_only=True, required=False, default=[])
    inspector = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), required=False, allow_null=True, default=None
    )

    class Meta:
        model = Inspeccion
        fields = [
            "id", "tipo", "material", "pieza", "piezas_lote", "plantilla",
            "proxima_inspeccion", "inspector", "cantidad_inspeccionada",
            "cantidad_apta", "cantidad_no_apta", "resultado_general",
            "accion_tomada", "observaciones", "respuestas",
        ]

    def validate(self, data):
        # Inspección individual siempre debe apuntar a una pieza específica
        if data.get("tipo") == "individual" and not data.get("pieza"):
            raise serializers.ValidationError({
                "pieza": "Una inspección individual debe especificar una pieza."
            })

        # Las cantidades de la inspección grupal deben cuadrar entre sí
        apta = data.get("cantidad_apta")
        no_apta = data.get("cantidad_no_apta")
        inspeccionada = data.get("cantidad_inspeccionada")
        if apta is not None and no_apta is not None and inspeccionada is not None:
            if apta + no_apta != inspeccionada:
                raise serializers.ValidationError({
                    "cantidad_inspeccionada": (
                        f"No cuadra: {apta} aptas + {no_apta} no aptas "
                        f"debería ser igual a {inspeccionada}."
                    )
                })

        # La inspeccionabilidad la decide la categoría/subcategoría (requiere_inspeccion +
        # plantilla_inspeccion), no tipo_control: un material no_retornable pero instalado
        # de forma permanente (ej. luminarias de emergencia) también puede requerir inspección.
        material = data.get("material")
        plantilla = data.get("plantilla")
        if material:
            categoria = material.subcategoria.categoria
            plantilla_esperada = material.subcategoria.plantilla_inspeccion

            if not categoria.requiere_inspeccion or not plantilla_esperada:
                raise serializers.ValidationError({
                    "material": (
                        f"Los materiales de la categoría '{categoria.nombre}' "
                        "no requieren inspección."
                    )
                })
            if not material.activo or not material.subcategoria.activo or not categoria.activo:
                raise serializers.ValidationError({
                    "material": "No se puede realizar una inspección de un material, subcategoría o categoría inactiva."
                })
            if plantilla and plantilla != plantilla_esperada:
                raise serializers.ValidationError({
                    "plantilla": (
                        f"Esta subcategoría requiere la plantilla '{plantilla_esperada.nombre}'."
                    )
                })

        # La pieza debe pertenecer al material, o ser hija de un estuche de ese material
        pieza = data.get("pieza")
        material = data.get("material")
        if pieza and material:
            pieza_material_ok = pieza.material_id == material.id
            # Caso estuche: se inspeccionan las hijas → el material es el del contenedor
            hija_de_este_material = (
                pieza.padre is not None and pieza.padre.material_id == material.id
            )
            if not pieza_material_ok and not hija_de_este_material:
                raise serializers.ValidationError({
                    "pieza": (
                        f"La pieza {pieza.codigo} no pertenece al material especificado "
                        "ni es hija de un estuche de ese material."
                    )
                })

        return data

    def create(self, validated_data):
        respuestas_data = validated_data.pop("respuestas", [])
        piezas_lote_data = validated_data.pop("piezas_lote", [])

        # Si no viene inspector explícito, usar el usuario autenticado. Sin ninguno de los dos, error.
        if not validated_data.get("inspector"):
            request = self.context.get("request")
            if request and hasattr(request, "user") and request.user.is_authenticated:
                validated_data["inspector"] = request.user
            else:
                raise serializers.ValidationError({
                    "inspector": "Se requiere un inspector (no hay usuario autenticado)."
                })

        # Si no se asigna proxima_inspeccion, calcular automáticamente desde la
        # periodicidad real del material (o del material dueño, si es una pieza).
        if not validated_data.get("proxima_inspeccion"):
            from datetime import date, timedelta
            objetivo = validated_data.get("pieza") or validated_data.get("material")
            material = objetivo.material if hasattr(objetivo, "material") else objetivo
            validated_data["proxima_inspeccion"] = date.today() + timedelta(
                days=material.periodicidad_inspeccion_dias
            )

        with transaction.atomic():
            inspeccion = Inspeccion.objects.create(**validated_data)
            if piezas_lote_data:
                inspeccion.piezas_lote.set(piezas_lote_data)
            elif inspeccion.tipo == "individual" and inspeccion.pieza:
                # Si la pieza es un contenedor, sus hijas activas entran también a piezas_lote
                from apps.catalogo.models import Pieza
                hijas_ids = list(
                    Pieza.objects.filter(padre=inspeccion.pieza)
                    .exclude(estado="Baja")
                    .values_list("id", flat=True)
                )
                if hijas_ids:
                    inspeccion.piezas_lote.set(hijas_ids)

            for resp in respuestas_data:
                criterio = Criterio.objects.get(pk=resp["criterio_id"])
                RespuestaCriterio.objects.create(
                    inspeccion=inspeccion,
                    criterio=criterio,
                    valor=resp["valor"],
                    observacion=resp.get("observacion", ""),
                )

            # Sincroniza el estado de la pieza según la acción: mantenimiento es directo;
            # baja/reemplazo pasa por inventario.services para dejar rastro en Movimiento.
            if inspeccion.pieza and inspeccion.accion_tomada:
                pieza = inspeccion.pieza
                accion = inspeccion.accion_tomada
                if accion in ["enviar_reparacion", "retirar_servicio"]:
                    pieza.estado = "Mantenimiento"
                    pieza.save(update_fields=["estado"])
                elif accion in ["dar_baja", "reemplazar"]:
                    from apps.inventario.services import registrar_baja_pieza
                    registrar_baja_pieza(
                        pieza=pieza,
                        responsable=inspeccion.inspector,
                        observaciones=f"Baja derivada de inspección #{inspeccion.id}: {accion}",
                    )
                elif accion == "continua_servicio":
                    if pieza.estado == "Mantenimiento":
                        pieza.estado = "Disponible"
                        pieza.save(update_fields=["estado"])

            from apps.inspeccion.planificacion import registrar_inspeccion_completada
            objetivo_filtro = {"pieza": inspeccion.pieza} if inspeccion.pieza else {"material": inspeccion.material}
            programacion = ProgramacionInspeccion.objects.filter(
                estado="pendiente", **objetivo_filtro
            ).order_by("fecha_programada").first()
            if programacion:
                es_baja_definitiva = inspeccion.accion_tomada in ("dar_baja", "reemplazar")
                registrar_inspeccion_completada(programacion, inspeccion, generar_siguiente=not es_baja_definitiva)

        return inspeccion

class ProgramacionInspeccionSerializer(serializers.ModelSerializer):
    material_codigo = serializers.CharField(source="material.codigo", read_only=True, default=None)
    pieza_codigo = serializers.CharField(source="pieza.codigo", read_only=True, default=None)
    estado_calculado = serializers.CharField(read_only=True)
    subcategoria_nombre = serializers.SerializerMethodField()
    objeto_nombre = serializers.SerializerMethodField()

    class Meta:
        model = ProgramacionInspeccion
        fields = [
            "id", "plan", "material", "material_codigo", "pieza", "pieza_codigo",
            "subcategoria_nombre", "objeto_nombre", "periodicidad_dias", "fecha_programada",
            "estado", "estado_calculado", "inspeccion",
        ]

    def _material_resuelto(self, obj):
        # La programación apunta a material (sin control individual) o a pieza
        # (con control individual); en ambos casos el material real cuelga de ahí.
        return obj.material or (obj.pieza.material if obj.pieza else None)

    def get_subcategoria_nombre(self, obj):
        material = self._material_resuelto(obj)
        return material.subcategoria.nombre if material else None

    def get_objeto_nombre(self, obj):
        material = self._material_resuelto(obj)
        return material.nombre if material else None

class PlanInspeccionAnualSerializer(serializers.ModelSerializer):
    class Meta:
        model = PlanInspeccionAnual
        fields = ["id", "anio", "fecha_inicio", "fecha_fin", "estado"]