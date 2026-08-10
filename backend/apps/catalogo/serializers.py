from rest_framework import serializers

from apps.catalogo.models import Categoria, Subcategoria, Material, Pieza
from apps.catalogo.services import crear_piezas_sueltas, crear_estuche_con_piezas, ajustar_stock

class CategoriaSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categoria
        fields = ["id", "nombre", "prefijo", "descripcion", "activo"]

class SubcategoriaSerializer(serializers.ModelSerializer):
    categoria_nombre = serializers.CharField(source="categoria.nombre", read_only=True)
    plantilla_inspeccion_nombre = serializers.CharField(
        source="plantilla_inspeccion.nombre", read_only=True, default=None
    )

    class Meta:
        model = Subcategoria
        fields = [
            "id", "categoria", "categoria_nombre", "nombre",
            "plantilla_inspeccion", "plantilla_inspeccion_nombre", "activo",
        ]
        
class PiezaSerializer(serializers.ModelSerializer):
    material_nombre = serializers.CharField(source="material.nombre", read_only=True)
    material_medida = serializers.CharField(source="material.medida", read_only=True, default="")
    tiene_hijas = serializers.BooleanField(read_only=True, default=False)

    class Meta:
        model = Pieza
        fields = [
            "id", "material", "material_nombre", "material_medida",
            "codigo", "estado", "foto", "padre", "creado_en", "tiene_hijas",
        ]
        read_only_fields = ["codigo", "creado_en", "material_nombre", "material_medida", "tiene_hijas"]
        
class PiezaAnidadaSerializer(serializers.ModelSerializer):
    """Versión resumida para mostrar piezas dentro del detalle de un Material."""
    piezas_hijas = serializers.SerializerMethodField()
    total_hijas = serializers.SerializerMethodField()
    hijas_disponibles = serializers.SerializerMethodField()
    material_nombre = serializers.CharField(source="material.nombre", read_only=True)
    material_medida = serializers.CharField(source="material.medida", read_only=True, default="")

    class Meta:
        model = Pieza
        fields = ["id", "codigo", "estado", "foto", "material_nombre", "material_medida", "total_hijas", "hijas_disponibles", "piezas_hijas"]

    def get_piezas_hijas(self, obj):
        hijas = obj.piezas_hijas.all()
        return PiezaSerializer(hijas, many=True).data

    def get_total_hijas(self, obj):
        return obj.piezas_hijas.count()

    def get_hijas_disponibles(self, obj):
        return obj.piezas_hijas.filter(estado="Disponible").count()

class MaterialSerializer(serializers.ModelSerializer):
    subcategoria_nombre = serializers.CharField(source="subcategoria.nombre", read_only=True)
    categoria_nombre = serializers.CharField(source="subcategoria.categoria.nombre", read_only=True)
    subcategoria_plantilla_inspeccion = serializers.PrimaryKeyRelatedField(source="subcategoria.plantilla_inspeccion", read_only=True)
    subcategoria_plantilla_inspeccion_nombre = serializers.CharField(source="subcategoria.plantilla_inspeccion.nombre", read_only=True, default=None)

    class Meta:
        model = Material
        fields = [
            "id", "subcategoria", "subcategoria_nombre", "categoria_nombre",
            "subcategoria_plantilla_inspeccion", "subcategoria_plantilla_inspeccion_nombre",
            "codigo", "nombre", "marca", "modelo", "medida", "foto",
            "grosor_mm", "largo_mm", "ubicacion_fisica", "precio",
            "tipo_control", "control_individual", "cantidad_total",
            "unidad_manejo", "unidades_por_caja",
            "activo", "creado_en",
        ]
        # cantidad_total YA NO va aquí — ahora es editable
        read_only_fields = ["codigo", "creado_en"]

    def validate(self, attrs):
        control_individual = attrs.get(
            "control_individual",
            getattr(self.instance, "control_individual", False),
        )
        # Si el material tiene control individual, ignoramos cualquier
        # cantidad_total enviada: siempre se calcula solo desde las piezas.
        # Tampoco aplica el manejo por caja (es exclusivo de consumibles).
        if control_individual:
            attrs.pop("cantidad_total", None)
            attrs["unidad_manejo"] = "unidad"
            attrs["unidades_por_caja"] = None
            return attrs

        unidad_manejo = attrs.get(
            "unidad_manejo",
            getattr(self.instance, "unidad_manejo", "unidad"),
        )
        unidades_por_caja = attrs.get(
            "unidades_por_caja",
            getattr(self.instance, "unidades_por_caja", None),
        )
        if unidad_manejo == "caja":
            if not unidades_por_caja or unidades_por_caja < 1:
                raise serializers.ValidationError({
                    "unidades_por_caja": "Indica cuántas unidades trae cada caja para este consumible."
                })
        else:
            attrs["unidades_por_caja"] = None
        return attrs

class MaterialDetalleSerializer(MaterialSerializer):
    """Incluye las piezas propias del material (solo las que no son hijas de otra)."""
    piezas = serializers.SerializerMethodField()

    class Meta(MaterialSerializer.Meta):
        fields = MaterialSerializer.Meta.fields + ["piezas"]

    def get_piezas(self, obj):
        piezas_raiz = obj.piezas.filter(padre__isnull=True)
        return PiezaAnidadaSerializer(piezas_raiz, many=True).data

class AltaPiezasSueltasSerializer(serializers.Serializer):
    material_id = serializers.IntegerField()
    cantidad = serializers.IntegerField(min_value=1)

    def validate_material_id(self, value):
        material = Material.objects.filter(pk=value).first()
        if not material:
            raise serializers.ValidationError("Material no existe.")
        if not material.control_individual:
            raise serializers.ValidationError(
                "Este material no tiene control individual; no se le pueden crear piezas."
            )
        return value

    def create(self, validated_data):
        material = Material.objects.get(pk=validated_data["material_id"])
        return crear_piezas_sueltas(material, validated_data["cantidad"])


class PiezaHijaSpecSerializer(serializers.Serializer):
    material_id = serializers.IntegerField()
    cantidad = serializers.IntegerField(min_value=1)

    def validate_material_id(self, value):
        if not Material.objects.filter(pk=value).exists():
            raise serializers.ValidationError("Material no existe.")
        return value


class AltaEstucheSerializer(serializers.Serializer):
    material_contenedor_id = serializers.IntegerField()
    piezas_hijas = PiezaHijaSpecSerializer(many=True)
    num_estuches = serializers.IntegerField(min_value=1, default=1)

    def validate_material_contenedor_id(self, value):
        material = Material.objects.filter(pk=value).first()
        if not material:
            raise serializers.ValidationError("Material contenedor no existe.")
        if not material.control_individual:
            raise serializers.ValidationError(
                "El material contenedor debe tener control individual."
            )
        return value

    def validate_piezas_hijas(self, value):
        for spec in value:
            material = Material.objects.get(pk=spec["material_id"])
            if not material.control_individual:
                raise serializers.ValidationError(
                    f"El material '{material.nombre}' no tiene control individual; "
                    "no puede usarse como pieza hija."
                )
        return value

    def create(self, validated_data):
        contenedor = Material.objects.get(pk=validated_data["material_contenedor_id"])
        piezas_spec = [
            {"material": Material.objects.get(pk=p["material_id"]), "cantidad": p["cantidad"]}
            for p in validated_data["piezas_hijas"]
        ]
        return crear_estuche_con_piezas(
            material_contenedor=contenedor,
            piezas_hijas_spec=piezas_spec,
            num_estuches=validated_data["num_estuches"],
        )

class AjustarStockSerializer(serializers.Serializer):
    material_id = serializers.IntegerField()
    cantidad = serializers.IntegerField(help_text="Positivo para sumar, negativo para descontar.")

    def validate_material_id(self, value):
        material = Material.objects.filter(pk=value).first()
        if not material:
            raise serializers.ValidationError("Material no existe.")
        if material.control_individual:
            raise serializers.ValidationError(
                "Este material tiene control individual; usa el alta de piezas en su lugar."
            )
        return value

    def create(self, validated_data):
        material = Material.objects.get(pk=validated_data["material_id"])
        return ajustar_stock(material, validated_data["cantidad"])


class PiezaHijaInlineSpecSerializer(serializers.Serializer):
    """Especificación inline de piezas hijas: nombre + medida (opcional) + cantidad."""
    nombre = serializers.CharField(max_length=150)
    medida = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    cantidad = serializers.IntegerField(min_value=1, default=1)


class AltaEstucheInlineSerializer(serializers.Serializer):
    """
    Crea estuches con piezas hijas definidas inline (nombre + medida + cantidad).
    Si ya existe un material con el mismo nombre y medida en la misma subcategoría
    del contenedor, lo reutiliza. Si no, lo crea automáticamente con control_individual=True.
    """
    material_contenedor_id = serializers.IntegerField()
    piezas_hijas = PiezaHijaInlineSpecSerializer(many=True)
    num_estuches = serializers.IntegerField(min_value=1, default=1)

    def validate_material_contenedor_id(self, value):
        material = Material.objects.filter(pk=value).first()
        if not material:
            raise serializers.ValidationError("Material contenedor no existe.")
        if not material.control_individual:
            raise serializers.ValidationError(
                "El material contenedor debe tener control individual."
            )
        self._contenedor = material
        return value

    def validate_piezas_hijas(self, value):
        if not value:
            raise serializers.ValidationError("Debes definir al menos una pieza hija.")
        return value

    def create(self, validated_data):
        from django.db import transaction
        contenedor = self._contenedor
        subcategoria = contenedor.subcategoria

        piezas_spec = []
        with transaction.atomic():
            for spec in validated_data["piezas_hijas"]:
                nombre = spec["nombre"].strip()
                medida = spec.get("medida", "").strip()

                # Buscar material existente con mismo nombre+medida en la misma subcategor\u00eda
                qs = Material.objects.filter(
                    nombre__iexact=nombre,
                    subcategoria=subcategoria,
                    control_individual=True,
                )
                if medida:
                    qs = qs.filter(medida__iexact=medida)
                else:
                    qs = qs.filter(medida="")

                mat_hija = qs.first()
                if not mat_hija:
                    # Crear el material hijo autom\u00e1ticamente
                    # es_componente=True: se oculta del cat\u00e1logo general
                    mat_hija = Material.objects.create(
                        subcategoria=subcategoria,
                        nombre=nombre,
                        medida=medida,
                        tipo_control=contenedor.tipo_control,
                        control_individual=True,
                        ubicacion_fisica=contenedor.ubicacion_fisica,
                        es_componente=True,
                    )
                elif not mat_hija.es_componente:
                    # Si ya exist\u00eda pero no estaba marcado como componente, marcarlo
                    mat_hija.es_componente = True
                    mat_hija.save(update_fields=["es_componente"])

                piezas_spec.append({
                    "material": mat_hija,
                    "cantidad": spec["cantidad"],
                })

        return crear_estuche_con_piezas(
            material_contenedor=contenedor,
            piezas_hijas_spec=piezas_spec,
            num_estuches=validated_data["num_estuches"],
        )



class ReemplazarHijaSerializer(serializers.Serializer):
    """
    Reemplaza una pieza hija rota/baja dentro de un estuche
    con una pieza suelta disponible del mismo material.

    Reglas:
    - La pieza a reemplazar (la hija) debe tener padre y estar en Baja o Mantenimiento.
    - La pieza suelta de reemplazo debe ser del mismo material, no tener padre
      y estar Disponible.
    """
    pieza_suelta_id = serializers.IntegerField(
        help_text="ID de la pieza suelta disponible que tomará el lugar de la hija."
    )

    def validate_pieza_suelta_id(self, value):
        try:
            suelta = Pieza.objects.select_related("material").get(pk=value)
        except Pieza.DoesNotExist:
            raise serializers.ValidationError("La pieza suelta especificada no existe.")
        if suelta.padre is not None:
            raise serializers.ValidationError(
                f"La pieza {suelta.codigo} ya pertenece a un estuche (padre: {suelta.padre.codigo})."
            )
        if suelta.estado != "Disponible":
            raise serializers.ValidationError(
                f"La pieza {suelta.codigo} no está disponible (estado: {suelta.estado})."
            )
        # Guardar la instancia para usarla en validate()
        self._suelta = suelta
        return value

    def validate(self, attrs):
        hija = self.context["hija"]  # inyectado desde la vista
        suelta = self._suelta

        if hija.padre is None:
            raise serializers.ValidationError(
                f"La pieza {hija.codigo} no pertenece a ningún estuche."
            )
        if hija.estado not in ("Baja", "Mantenimiento"):
            raise serializers.ValidationError(
                f"La pieza {hija.codigo} no está en Baja ni en Mantenimiento; "
                "no es necesario reemplazarla."
            )
        if hija.material_id != suelta.material_id:
            raise serializers.ValidationError(
                f"La pieza suelta ({suelta.material.nombre}) no es del mismo material "
                f"que la pieza a reemplazar ({hija.material.nombre})."
            )
        attrs["_suelta"] = suelta
        return attrs

    def save(self, **kwargs):
        from django.db import transaction
        hija = self.context["hija"]
        suelta = self.validated_data["_suelta"]
        padre = hija.padre

        with transaction.atomic():
            # Asignar el padre de la hija rota a la pieza suelta
            Pieza.objects.filter(pk=suelta.pk).update(padre=padre)
        return suelta


# ─── Feature: Agregar pieza hija a estuche existente ──────────────────────────

class AgregarHijaInlineSerializer(serializers.Serializer):
    """
    Agrega una o más piezas hijas a un estuche ya existente (pieza contenedora).
    Reutiliza la misma lógica de lookup/creación de AltaEstucheInlineSerializer:
    si el material hijo ya existe en la misma subcategoría, lo reutiliza;
    si no, lo crea marcado como es_componente=True.
    POST /piezas/{id}/agregar-hija-inline/
    Body: { "nombre": "...", "medida": "...", "cantidad": 1 }
    """
    nombre   = serializers.CharField(max_length=150)
    medida   = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    cantidad = serializers.IntegerField(min_value=1, default=1)

    def create(self, validated_data):
        from django.db import transaction
        contenedor = self.context["contenedor"]   # Pieza padre (estuche)
        subcategoria = contenedor.material.subcategoria

        nombre  = validated_data["nombre"].strip()
        medida  = validated_data.get("medida", "").strip()
        cantidad = validated_data["cantidad"]

        with transaction.atomic():
            # Buscar material existente con mismo nombre/medida en la subcategoría
            qs = Material.objects.filter(
                nombre__iexact=nombre,
                subcategoria=subcategoria,
                control_individual=True,
            )
            if medida:
                qs = qs.filter(medida__iexact=medida)
            else:
                qs = qs.filter(medida="")

            mat_hija = qs.first()
            if not mat_hija:
                mat_hija = Material.objects.create(
                    subcategoria=subcategoria,
                    nombre=nombre,
                    medida=medida,
                    tipo_control=contenedor.material.tipo_control,
                    control_individual=True,
                    ubicacion_fisica=contenedor.material.ubicacion_fisica,
                    es_componente=True,
                )
            elif not mat_hija.es_componente:
                mat_hija.es_componente = True
                mat_hija.save(update_fields=["es_componente"])

            # Crear N piezas hijas vinculadas al contenedor
            creadas = []
            for _ in range(cantidad):
                hija = Pieza.objects.create(material=mat_hija, padre=contenedor)
                creadas.append(hija)

            mat_hija.recalcular_cantidad()
            contenedor.material.recalcular_cantidad()

        return creadas
