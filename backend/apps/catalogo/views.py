from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.catalogo.models import Categoria, Subcategoria, Material, Pieza
from apps.catalogo.serializers import (
    CategoriaSerializer,
    SubcategoriaSerializer,
    MaterialSerializer,
    MaterialDetalleSerializer,
    PiezaSerializer,
    AltaPiezasSueltasSerializer,
    AltaEstucheSerializer,
)

class CategoriaViewSet(viewsets.ModelViewSet):
    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer

class SubcategoriaViewSet(viewsets.ModelViewSet):
    queryset = Subcategoria.objects.select_related("categoria").all()
    serializer_class = SubcategoriaSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        categoria_id = self.request.query_params.get("categoria")
        if categoria_id:
            qs = qs.filter(categoria_id=categoria_id)
        return qs

class MaterialViewSet(viewsets.ModelViewSet):
    queryset = Material.objects.select_related("subcategoria__categoria").all()
    serializer_class = MaterialSerializer

    def get_serializer_class(self):
        if self.action == "retrieve":
            return MaterialDetalleSerializer
        return MaterialSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        subcategoria_id = self.request.query_params.get("subcategoria")
        categoria_id = self.request.query_params.get("categoria")
        control_individual = self.request.query_params.get("control_individual")
        busqueda = self.request.query_params.get("q")

        if subcategoria_id:
            qs = qs.filter(subcategoria_id=subcategoria_id)
        if categoria_id:
            qs = qs.filter(subcategoria__categoria_id=categoria_id)
        if control_individual is not None:
            qs = qs.filter(control_individual=control_individual.lower() == "true")
        if busqueda:
            qs = qs.filter(nombre__icontains=busqueda)
        return qs

    @action(detail=False, methods=["post"], url_path="alta-piezas-sueltas")
    def alta_piezas_sueltas(self, request):
        serializer = AltaPiezasSueltasSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        piezas = serializer.save()
        return Response(
            PiezaSerializer(piezas, many=True).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["post"], url_path="alta-estuche")
    def alta_estuche(self, request):
        serializer = AltaEstucheSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        piezas = serializer.save()
        return Response(
            PiezaSerializer(piezas, many=True).data,
            status=status.HTTP_201_CREATED,
        )


class PiezaViewSet(viewsets.ModelViewSet):
    queryset = Pieza.objects.select_related("material", "padre").all()
    serializer_class = PiezaSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        material_id = self.request.query_params.get("material")
        estado = self.request.query_params.get("estado")
        sin_padre = self.request.query_params.get("sin_padre")

        if material_id:
            qs = qs.filter(material_id=material_id)
        if estado:
            qs = qs.filter(estado=estado)
        if sin_padre is not None and sin_padre.lower() == "true":
            qs = qs.filter(padre__isnull=True)
        return qs
