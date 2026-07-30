from rest_framework import serializers

from apps.catalogo.models import Categoria, Subcategoria, Material, Pieza
from apps.catalogo.services import crear_piezas_sueltas, crear_estuche_con_piezas


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
    class Meta:
        model = Pieza
        fields = ["id", "material", "codigo", "estado", "foto", "padre", "creado_en"]
        read_only_fields = ["codigo", "creado_en"]

class PiezaAnidadaSerializer(serializers.ModelSerializer):
    """Versión resumida para mostrar piezas dentro del detalle de un Material."""
    piezas_hijas = serializers.SerializerMethodField()
    total_hijas = serializers.SerializerMethodField()
    hijas_disponibles = serializers.SerializerMethodField()

    class Meta:
        model = Pieza
        fields = ["id", "codigo", "estado", "foto", "total_hijas", "hijas_disponibles", "piezas_hijas"]

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

    class Meta:
        model = Material
        fields = [
            "id", "subcategoria", "subcategoria_nombre", "categoria_nombre",
            "codigo", "nombre", "marca", "modelo", "medida", "foto",
            "grosor_mm", "largo_mm", "ubicacion_fisica",
            "tipo_control", "control_individual", "cantidad_total",
            "activo", "creado_en",
        ]
        read_only_fields = ["codigo", "cantidad_total", "creado_en"]

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