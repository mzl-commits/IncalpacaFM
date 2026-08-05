from rest_framework import serializers
from django.db import transaction

from apps.inspeccion.models import PlantillaCriterio, Criterio, Inspeccion, RespuestaCriterio

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


class InspeccionSerializer(serializers.ModelSerializer):
    material_codigo = serializers.CharField(source="material.codigo", read_only=True)
    material_nombre = serializers.CharField(source="material.nombre", read_only=True)
    pieza_codigo = serializers.CharField(source="pieza.codigo", read_only=True, default=None)
    inspector_nombre = serializers.SerializerMethodField()
    plantilla_nombre = serializers.CharField(source="plantilla.nombre", read_only=True)
    respuestas = RespuestaCriterioSerializer(many=True, read_only=True)

    class Meta:
        model = Inspeccion
        fields = [
            "id", "tipo", "material", "material_codigo", "material_nombre",
            "pieza", "pieza_codigo", "piezas_lote", "plantilla", "plantilla_nombre",
            "fecha", "proxima_inspeccion", "inspector", "inspector_nombre",
            "cantidad_inspeccionada", "cantidad_apta", "cantidad_no_apta",
            "resultado_general", "accion_tomada", "observaciones", "respuestas",
        ]

    def get_inspector_nombre(self, obj):
        if obj.inspector:
            return obj.inspector.get_full_name() or obj.inspector.username
        return "N/A"


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

        # La plantilla usada debe coincidir con la plantilla asignada a la subcategoría del material
        material = data.get("material")
        plantilla = data.get("plantilla")
        if material and plantilla:
            plantilla_esperada = material.subcategoria.plantilla_inspeccion
            if plantilla_esperada and plantilla != plantilla_esperada:
                raise serializers.ValidationError({
                    "plantilla": (
                        f"Esta subcategoría requiere la plantilla '{plantilla_esperada.nombre}'."
                    )
                })

        # La pieza debe pertenecer al material especificado,
        # o ser una pieza hija cuyo estuche padre sí pertenece al material.
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

        with transaction.atomic():
            inspeccion = Inspeccion.objects.create(**validated_data)
            if piezas_lote_data:
                inspeccion.piezas_lote.set(piezas_lote_data)

            for resp in respuestas_data:
                criterio = Criterio.objects.get(pk=resp["criterio_id"])
                RespuestaCriterio.objects.create(
                    inspeccion=inspeccion,
                    criterio=criterio,
                    valor=resp["valor"],
                    observacion=resp.get("observacion", ""),
                )

            # Sincronizar estado de la pieza individual según la acción tomada.
            # Mantenimiento/disponible: cambio de estado directo (reversible, no
            # afecta stock). Baja/reemplazo: pasa por inventario.services para
            # dejar rastro en la bitácora de Movimiento, ya que sí afecta cantidad_total.
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

        return inspeccion