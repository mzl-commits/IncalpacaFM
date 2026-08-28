from rest_framework import serializers
from django.db import transaction

from apps.inspeccion.models import (
     PlantillaCriterio, Criterio, Inspeccion, RespuestaCriterio,
     PlanInspeccionAnual, ProgramacionInspeccion, DocumentoInspeccion,
     ObservacionInspeccion,
)

from django.contrib.auth import get_user_model

User = get_user_model()

class ObservacionInspeccionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ObservacionInspeccion
        fields = [
            "id", "inspeccion", "codigo", "nombre",
            "observacion_encontrada", "accion_recomendada", "estado",
        ]
        read_only_fields = ["id", "inspeccion"]

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
    items_con_observacion = ObservacionInspeccionSerializer(many=True, read_only=True)
    # la periodicidad real del material dueño (o del material del contenedor, si esta inspección es de una pieza). 
    # TrimestreBadge la necesita para calcular vigencia (vencida/próxima/al día); antes solo
    # vivía en el Material, no llegaba junto con la Inspeccion.
    material_periodicidad_inspeccion_dias = serializers.SerializerMethodField()
    almacen_nombre = serializers.CharField(source="almacen.nombre", read_only=True)
    piezas_lote_codigos = serializers.SerializerMethodField()

    class Meta:
        model = Inspeccion
        fields = [
            "id", "codigo_inspeccion", "tipo", "tipo_inspeccion", "modalidad", "frecuencia",
            "area", "area_trabajo", "referencia_orden", "tipos_herramientas",
            "material", "material_codigo", "material_nombre",
            "pieza", "pieza_codigo", "piezas_lote", "piezas_lote_codigos",
            "plantilla", "plantilla_nombre",
            "fecha", "proxima_inspeccion", "inspector", "inspector_nombre",
            "cantidad_inspeccionada", "cantidad_apta", "cantidad_no_apta",
            "resultado_general", "accion_tomada", "observaciones", "respuestas",
            "items_con_observacion",
            "material_periodicidad_inspeccion_dias", "almacen", "almacen_nombre",
        ]

    def get_inspector_nombre(self, obj) -> str:
        if obj.inspector:
            return obj.inspector.get_full_name() or obj.inspector.username
        return "N/A"

    def get_material_periodicidad_inspeccion_dias(self, obj) -> int | None:
        material = obj.pieza.material if obj.pieza else obj.material
        return material.periodicidad_inspeccion_dias if material else None

    def get_piezas_lote_codigos(self, obj) -> list[str]:
        return list(obj.piezas_lote.values_list("codigo", flat=True))

class DocumentoInspeccionSerializer(serializers.ModelSerializer):
    subido_por_nombre = serializers.SerializerMethodField()
    archivo_url = serializers.SerializerMethodField()

    class Meta:
        model = DocumentoInspeccion
        fields = [
            "id", "inspeccion", "archivo", "archivo_url", "nombre", "tipo",
            "subido_por", "subido_por_nombre", "fecha_subida",
        ]
        read_only_fields = ["subido_por", "fecha_subida"]

    def get_subido_por_nombre(self, obj) -> str:
        if obj.subido_por:
            return obj.subido_por.get_full_name() or obj.subido_por.username
        return "N/A"

    def get_archivo_url(self, obj) -> str | None:
        request = self.context.get("request")
        if obj.archivo and request:
            return request.build_absolute_uri(obj.archivo.url)
        return obj.archivo.url if obj.archivo else None

    def create(self, validated_data):
        # Mismo patrón que InspeccionCrearSerializer.create(): si no viene
        # subido_por explícito, se usa el usuario autenticado.
        if not validated_data.get("subido_por"):
            request = self.context.get("request")
            if request and hasattr(request, "user") and request.user.is_authenticated:
                validated_data["subido_por"] = request.user
            else:
                raise serializers.ValidationError({
                    "subido_por": "Se requiere un usuario autenticado para subir un documento."
                })
        return super().create(validated_data)

class ItemConObservacionCrearSerializer(serializers.Serializer):
    codigo = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    nombre = serializers.CharField(max_length=200)
    observacion_encontrada = serializers.CharField()
    accion_recomendada = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    estado = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")

class InspeccionCrearSerializer(serializers.ModelSerializer):
    respuestas = RespuestaCriterioCrearSerializer(many=True, write_only=True, required=False, default=[])
    codigo_inspeccion = serializers.CharField(read_only=True)
    items_con_observacion = ItemConObservacionCrearSerializer(many=True, write_only=True, required=False, default=[])
    inspector = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.all(), required=False, allow_null=True, default=None, 
    )

    class Meta:
        model = Inspeccion
        fields = [
            "id", "codigo_inspeccion", "tipo", "tipo_inspeccion", "modalidad",
            "area", "area_trabajo", "referencia_orden", "tipos_herramientas",
            "material", "pieza", "piezas_lote", "plantilla",
            "proxima_inspeccion", "inspector",
            "cantidad_inspeccionada", "cantidad_apta", "cantidad_no_apta",
            "resultado_general", "accion_tomada", "observaciones", "respuestas",
            "items_con_observacion",
        ]


    def validate(self, data):
        tipo = data.get("tipo", getattr(self.instance, "tipo", None))
        pieza = data.get("pieza", getattr(self.instance, "pieza", None))
        material = data.get("material", getattr(self.instance, "material", None))

        # Inspección individual siempre debe apuntar a una pieza específica
        if tipo == "individual" and not pieza:
            raise serializers.ValidationError({
                "pieza": "Una inspección individual debe especificar una pieza."
            })

        # Si el usuario logueado es Inspector/Almacenero con almacén asignado,
        # el material debe pertenecer a ese almacén. Se valida ANTES de guardar.
        almacen_forzado = self.context.get("almacen_forzado")
        if almacen_forzado is not None:
            if material and material.almacen_id != almacen_forzado:
                raise serializers.ValidationError({
                    "material": "No puedes registrar o editar inspecciones fuera de tu almacén asignado."
                })

        # Las cantidades de la inspección grupal deben cuadrar entre sí
        apta = data.get("cantidad_apta", getattr(self.instance, "cantidad_apta", None))
        no_apta = data.get("cantidad_no_apta", getattr(self.instance, "cantidad_no_apta", None))
        inspeccionada = data.get("cantidad_inspeccionada", getattr(self.instance, "cantidad_inspeccionada", None))
        if apta is not None and no_apta is not None and inspeccionada is not None:
            if apta + no_apta != inspeccionada:
                raise serializers.ValidationError({
                    "cantidad_inspeccionada": (
                        f"No cuadra: {apta} aptas + {no_apta} no aptas "
                        f"debería ser igual a {inspeccionada}."
                    )
                })

        plantilla = data.get("plantilla", getattr(self.instance, "plantilla", None))
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
            if not self.instance and (not material.activo or not material.subcategoria.activo or not categoria.activo):
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
        if pieza and material:
            pieza_material_ok = pieza.material_id == material.id
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
        items_con_observacion_data = validated_data.pop("items_con_observacion", [])
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
            # siempre viene informado y ya está validado arriba contra la pieza (directa o vía padre), 
            # así que el almacén se deriva siempre de ahí — nunca de pieza.material, que puede ser un
            # material-componente con almacén propio distinto del contenedor.
            validated_data["almacen"] = validated_data["material"].almacen
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

            for item_data in items_con_observacion_data:
                ObservacionInspeccion.objects.create(
                    inspeccion=inspeccion,
                    codigo=item_data.get("codigo", ""),
                    nombre=item_data.get("nombre", ""),
                    observacion_encontrada=item_data.get("observacion_encontrada", ""),
                    accion_recomendada=item_data.get("accion_recomendada", ""),
                    estado=item_data.get("estado", ""),
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

    def update(self, instance, validated_data):
        respuestas_data = validated_data.pop("respuestas", None)
        items_con_observacion_data = validated_data.pop("items_con_observacion", None)
        piezas_lote_data = validated_data.pop("piezas_lote", None)

        with transaction.atomic():
            for attr, value in validated_data.items():
                setattr(instance, attr, value)
            instance.save()

            if piezas_lote_data is not None:
                instance.piezas_lote.set(piezas_lote_data)

            if respuestas_data is not None:
                instance.respuestas.all().delete()
                for resp in respuestas_data:
                    criterio = Criterio.objects.get(pk=resp["criterio_id"])
                    RespuestaCriterio.objects.create(
                        inspeccion=instance,
                        criterio=criterio,
                        valor=resp["valor"],
                        observacion=resp.get("observacion", ""),
                    )

            if items_con_observacion_data is not None:
                instance.items_con_observacion.all().delete()
                for item_data in items_con_observacion_data:
                    ObservacionInspeccion.objects.create(
                        inspeccion=instance,
                        codigo=item_data.get("codigo", ""),
                        nombre=item_data.get("nombre", ""),
                        observacion_encontrada=item_data.get("observacion_encontrada", ""),
                        accion_recomendada=item_data.get("accion_recomendada", ""),
                        estado=item_data.get("estado", ""),
                    )

            if instance.pieza and instance.accion_tomada:
                pieza = instance.pieza
                accion = instance.accion_tomada
                if accion in ["enviar_reparacion", "retirar_servicio"]:
                    pieza.estado = "Mantenimiento"
                    pieza.save(update_fields=["estado"])
                elif accion in ["dar_baja", "reemplazar"]:
                    from apps.inventario.services import registrar_baja_pieza
                    registrar_baja_pieza(
                        pieza=pieza,
                        responsable=instance.inspector,
                        observaciones=f"Baja derivada de edición de inspección #{instance.id}: {accion}",
                    )
                elif accion == "continua_servicio":
                    if pieza.estado == "Mantenimiento":
                        pieza.estado = "Disponible"
                        pieza.save(update_fields=["estado"])

        return instance

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

    def get_subcategoria_nombre(self, obj) -> str | None:
        material = self._material_resuelto(obj)
        return material.subcategoria.nombre if material else None

    def get_objeto_nombre(self, obj) -> str | None:
        material = self._material_resuelto(obj)
        return material.nombre if material else None

class PlanInspeccionAnualSerializer(serializers.ModelSerializer):
    almacen_nombre = serializers.CharField(source="almacen.nombre", read_only=True, default=None)

    class Meta:
        model = PlanInspeccionAnual
        fields = ["id", "anio", "almacen", "almacen_nombre", "fecha_inicio", "fecha_fin", "estado"]
