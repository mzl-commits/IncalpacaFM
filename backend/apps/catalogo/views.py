from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.db.models import Q

from apps.catalogo.models import Categoria, Subcategoria, Material, Pieza
from apps.catalogo.serializers import (
    CategoriaSerializer,
    SubcategoriaSerializer,
    MaterialSerializer,
    MaterialDetalleSerializer,
    PiezaSerializer,
    AltaPiezasSueltasSerializer,
    AltaEstucheInlineSerializer,
    AjustarStockSerializer,
    ReemplazarHijaSerializer,
    AgregarHijaInlineSerializer,
)


class CategoriaViewSet(viewsets.ModelViewSet):
    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer
    permission_classes = [AllowAny]


class SubcategoriaViewSet(viewsets.ModelViewSet):
    queryset = Subcategoria.objects.select_related("categoria").all()
    serializer_class = SubcategoriaSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        categoria_id = self.request.query_params.get("categoria")
        if categoria_id:
            qs = qs.filter(categoria_id=categoria_id)
        return qs


class MaterialViewSet(viewsets.ModelViewSet):
    queryset = Material.objects.select_related("subcategoria__categoria").all()
    serializer_class = MaterialSerializer
    permission_classes = [AllowAny]

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
        incluir_componentes = self.request.query_params.get("incluir_componentes")

        # Por defecto, ocultar materiales que son componentes internos de estuches
        if not (incluir_componentes and incluir_componentes.lower() == "true"):
            qs = qs.filter(es_componente=False)

        if subcategoria_id:
            qs = qs.filter(subcategoria_id=subcategoria_id)
        if categoria_id:
            qs = qs.filter(subcategoria__categoria_id=categoria_id)
        if control_individual is not None:
            qs = qs.filter(control_individual=control_individual.lower() == "true")
        if busqueda:
            qs = qs.filter(
                Q(nombre__icontains=busqueda)
                | Q(codigo__icontains=busqueda)
                | Q(marca__icontains=busqueda)
                | Q(modelo__icontains=busqueda)
                # Buscar por código de pieza directa
                | Q(piezas__codigo__icontains=busqueda)
                # Buscar por código de pieza hija (dentro de estuches)
                # Esto devuelve el MATERIAL ESTUCHE cuando se busca un código de pieza hija
                | Q(piezas__piezas_hijas__codigo__icontains=busqueda)
            ).distinct()
        return qs

    def destroy(self, request, *args, **kwargs):
        """Protegido: solo falla si hay datos sin confirmar. Usar /eliminar-forzado/ para cascade."""
        material = self.get_object()
        tiene_datos = (
            material.piezas.exists()
            or material.movimientos.exists()
            or material.inspecciones.exists()
        )
        if tiene_datos:
            return Response(
                {
                    "detail": "Este material tiene piezas, movimientos o inspecciones asociadas. "
                              "Usa el endpoint /eliminar-forzado/ para eliminar todo.",
                    "tiene_datos": True,
                },
                status=status.HTTP_409_CONFLICT,
            )
        material.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["delete"], url_path="eliminar-forzado")
    def eliminar_forzado(self, request, pk=None):
        """
        Elimina el material junto con TODAS sus piezas, movimientos e inspecciones.
        Requiere confirmación explícita: body { "confirmar": true }
        DELETE /materiales/{id}/eliminar-forzado/
        """
        if not request.data.get("confirmar"):
            return Response(
                {"detail": "Debes enviar { \"confirmar\": true } para confirmar la eliminación."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        material = self.get_object()
        nombre = str(material)
        with transaction.atomic():
            # 1. Eliminar respuestas de criterio de inspecciones
            from apps.inspeccion.models import RespuestaCriterio, Inspeccion
            from apps.inventario.models import Movimiento
            RespuestaCriterio.objects.filter(inspeccion__material=material).delete()
            Inspeccion.objects.filter(material=material).delete()
            # 2. Limpiar referencias de movimientos a piezas antes de borrar piezas
            Movimiento.objects.filter(material=material).delete()
            # 3. Borrar piezas (incluyendo hijas via CASCADE o SET_NULL)
            material.piezas.all().delete()
            # 4. Borrar el material
            material.delete()
        return Response(
            {"detail": f"Material '{nombre}' eliminado correctamente junto con todos sus datos."},
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"], url_path="alta-piezas-sueltas")
    def alta_piezas_sueltas(self, request):
        serializer = AltaPiezasSueltasSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        piezas = serializer.save()
        return Response(
            PiezaSerializer(piezas, many=True).data,
            status=status.HTTP_201_CREATED,
        )



    @action(detail=False, methods=["post"], url_path="ajustar-stock")
    def ajustar_stock_action(self, request):
        serializer = AjustarStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        material = serializer.save()
        return Response(MaterialSerializer(material).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="alta-estuche-inline")
    def alta_estuche_inline(self, request):
        """
        Crea estuches con piezas hijas definidas inline (nombre+medida+cantidad).
        Si el material hijo no existe en la subcategoría, se crea automáticamente.
        POST /materiales/alta-estuche-inline/
        """
        serializer = AltaEstucheInlineSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        piezas = serializer.save()
        return Response(
            PiezaSerializer(piezas, many=True).data,
            status=status.HTTP_201_CREATED,
        )


class PiezaViewSet(viewsets.ModelViewSet):
    queryset = Pieza.objects.select_related("material", "padre").all()
    serializer_class = PiezaSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        material_id = self.request.query_params.get("material")
        estado = self.request.query_params.get("estado")
        sin_padre = self.request.query_params.get("sin_padre")
        padre_id = self.request.query_params.get("padre")

        if material_id:
            qs = qs.filter(Q(material_id=material_id) | Q(padre__material_id=material_id))
        if estado:
            qs = qs.filter(estado=estado)
        if sin_padre is not None and sin_padre.lower() == "true":
            qs = qs.filter(padre__isnull=True)
        if padre_id:
            qs = qs.filter(padre_id=padre_id)
        return qs

    @action(detail=True, methods=["post"], url_path="reemplazar-hija")
    def reemplazar_hija(self, request, pk=None):
        """
        Reemplaza una pieza hija rota/baja con una pieza suelta disponible
        del mismo material.
        URL: POST /piezas/{id}/reemplazar-hija/
        Body: { "pieza_suelta_id": <int> }
        """
        hija = self.get_object()
        serializer = ReemplazarHijaSerializer(
            data=request.data,
            context={"hija": hija, "request": request},
        )
        serializer.is_valid(raise_exception=True)
        nueva_hija = serializer.save()
        return Response(PiezaSerializer(nueva_hija).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="agregar-hija-inline")
    def agregar_hija_inline(self, request, pk=None):
        """
        Agrega una o más piezas hijas a un estuche ya existente.
        Si el material hijo no existe en la subcategoría, se crea automáticamente.
        URL: POST /piezas/{id}/agregar-hija-inline/
        Body: { "nombre": "...", "medida": "...", "cantidad": 1 }
        """
        contenedor = self.get_object()
        serializer = AgregarHijaInlineSerializer(
            data=request.data,
            context={"contenedor": contenedor},
        )
        serializer.is_valid(raise_exception=True)
        nuevas = serializer.save()
        return Response(PiezaSerializer(nuevas, many=True).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="desvincular")
    def desvincular(self, request, pk=None):
        """
        Quita una pieza hija de su estuche (padre=null).
        La pieza pasa a ser pieza suelta del mismo material.
        URL: POST /piezas/{id}/desvincular/
        """
        pieza = self.get_object()
        if pieza.padre is None:
            return Response(
                {"detail": "Esta pieza no pertenece a ningún estuche."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Marcar el material de esta pieza como componente (era parte de un estuche)
        # Esto evita que aparezca en el catálogo si el usuario la desvinculó
        if not pieza.material.es_componente:
            pieza.material.es_componente = True
            pieza.material.save(update_fields=["es_componente"])
        pieza.padre = None
        pieza.save(update_fields=["padre"])
        pieza.material.recalcular_cantidad()
        return Response(PiezaSerializer(pieza).data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        """
        Elimina una pieza (suelta o estuche).
        Si es estuche, elimina también todas sus piezas hijas y sus movimientos.
        Marca los materiales de las piezas hijas como es_componente=True para
        que no aparezcan en el catálogo si quedan otros registros de ese material.
        """
        from apps.inventario.models import Movimiento
        pieza = self.get_object()
        material = pieza.material
        with transaction.atomic():
            # Recoger materiales de hijas antes de eliminarlas
            materiales_hijas = set()
            for hija in list(pieza.piezas_hijas.all()):
                materiales_hijas.add(hija.material_id)
                Movimiento.objects.filter(pieza=hija).delete()
                hija.delete()

            # Marcar los materiales de hijas como componentes (evita que aparezcan en catalogo)
            if materiales_hijas:
                Material.objects.filter(
                    id__in=materiales_hijas,
                    es_componente=False,
                ).update(es_componente=True)

            # Si esta pieza era una hija (tiene padre), marcar su material como componente
            if pieza.padre is not None and not material.es_componente:
                material.es_componente = True
                material.save(update_fields=["es_componente"])

            # Eliminar movimientos de la pieza principal
            Movimiento.objects.filter(pieza=pieza).delete()
            pieza.delete()
            material.recalcular_cantidad()
        return Response(status=status.HTTP_204_NO_CONTENT)
