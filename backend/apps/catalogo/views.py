from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.db.models import Q, Exists, OuterRef

from apps.accounts.permissions import IsAlmaceneroOrAdministratorWrite
from apps.catalogo.models import Categoria, Subcategoria, Material, Pieza
from apps.catalogo.serializers import (
    CategoriaSerializer,
    SubcategoriaSerializer,
    MaterialSerializer,
    MaterialDetalleSerializer,
    PiezaSerializer,
    AltaPiezasSueltasSerializer,
    AltaEstucheSerializer,
    AltaEstucheInlineSerializer,
    AjustarStockSerializer,
    ReemplazarHijaSerializer,
    AgregarHijaInlineSerializer,
)


class CategoriaViewSet(viewsets.ModelViewSet):
    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer
    permission_classes = [IsAlmaceneroOrAdministratorWrite]


class SubcategoriaViewSet(viewsets.ModelViewSet):
    queryset = Subcategoria.objects.select_related("categoria").all()
    serializer_class = SubcategoriaSerializer
    permission_classes = [IsAlmaceneroOrAdministratorWrite]

    def get_queryset(self):
        qs = super().get_queryset()
        categoria_id = self.request.query_params.get("categoria")
        if categoria_id:
            qs = qs.filter(categoria_id=categoria_id)
        return qs


class MaterialViewSet(viewsets.ModelViewSet):
    queryset = Material.objects.select_related("subcategoria__categoria").all()
    serializer_class = MaterialSerializer
    permission_classes = [IsAlmaceneroOrAdministratorWrite]

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
        inspeccionable = self.request.query_params.get("inspeccionable")
        activo = self.request.query_params.get("activo")

        # Por defecto, ocultar materiales que son componentes internos de estuches
        if not (incluir_componentes and incluir_componentes.lower() == "true"):
            qs = qs.filter(es_componente=False)

        if subcategoria_id:
            qs = qs.filter(subcategoria_id=subcategoria_id)
        if categoria_id:
            qs = qs.filter(subcategoria__categoria_id=categoria_id)
        if control_individual is not None:
            qs = qs.filter(control_individual=control_individual.lower() == "true")
        if activo is not None:
            qs = qs.filter(activo=activo.lower() == "true")
        if inspeccionable is not None and inspeccionable.lower() == "true":
            qs = qs.filter(
                activo=True,
                subcategoria__activo=True,
                subcategoria__categoria__activo=True,
                subcategoria__categoria__requiere_inspeccion=True,
                subcategoria__plantilla_inspeccion__isnull=False,
                tipo_control="retornable",
            )
        if busqueda:
            qs = qs.filter(
                Q(nombre__icontains=busqueda)
                | Q(codigo__icontains=busqueda)
                | Q(marca__icontains=busqueda)
                | Q(modelo__icontains=busqueda)
                | Q(piezas__codigo__icontains=busqueda)
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
            from apps.inspeccion.models import RespuestaCriterio, Inspeccion
            from apps.inventario.models import Movimiento
            RespuestaCriterio.objects.filter(inspeccion__material=material).delete()
            Inspeccion.objects.filter(material=material).delete()
            Movimiento.objects.filter(material=material).delete()
            material.piezas.all().delete()
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

    @action(detail=False, methods=["post"], url_path="alta-estuche")
    def alta_estuche(self, request):
        serializer = AltaEstucheSerializer(data=request.data)
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

    @action(detail=True, methods=["get"], url_path="materiales-hijas")
    def materiales_hijas(self, request, pk=None):
        """
        Devuelve los materiales "hijos" (tipos de piezas individuales) que
        pertenecen a este material contenedor (estuche), para poder
        registrarlos por separado en vez de usar el estuche completo.
        GET /materiales/{id}/materiales-hijas/
        """
        material = self.get_object()
        hijas_material_ids = (
            Pieza.objects.filter(padre__material_id=material.id)
            .values_list("material_id", flat=True)
            .distinct()
        )
        materiales = Material.objects.filter(id__in=hijas_material_ids)
        return Response(MaterialSerializer(materiales, many=True).data)


class PiezaViewSet(viewsets.ModelViewSet):
    queryset = Pieza.objects.select_related("material", "padre").all()
    serializer_class = PiezaSerializer
    permission_classes = [IsAlmaceneroOrAdministratorWrite]

    def get_queryset(self):
        qs = super().get_queryset().annotate(
            tiene_hijas=Exists(
                Pieza.objects.filter(padre=OuterRef("pk"))
            )
        )
        material_id = self.request.query_params.get("material")
        estado = self.request.query_params.get("estado")
        sin_padre = self.request.query_params.get("sin_padre")
        padre_id = self.request.query_params.get("padre")
        busqueda = self.request.query_params.get("q")

        if material_id:
            # OR con padre__material_id: incluye piezas hijas del material
            # (necesario para que sean seleccionables en inspeccion/movimiento)
            qs = qs.filter(Q(material_id=material_id) | Q(padre__material_id=material_id))
        if estado:
            qs = qs.filter(estado=estado)
        if sin_padre is not None and sin_padre.lower() == "true":
            qs = qs.filter(padre__isnull=True)
        if padre_id:
            qs = qs.filter(padre_id=padre_id)
        if busqueda:
            qs = qs.filter(
                Q(codigo__icontains=busqueda)
                | Q(material__nombre__icontains=busqueda)
                | Q(material__codigo__icontains=busqueda)
            )
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
            materiales_hijas = set()
            for hija in list(pieza.piezas_hijas.all()):
                materiales_hijas.add(hija.material_id)
                Movimiento.objects.filter(pieza=hija).delete()
                hija.delete()

            if materiales_hijas:
                Material.objects.filter(
                    id__in=materiales_hijas,
                    es_componente=False,
                ).update(es_componente=True)

            if pieza.padre is not None and not material.es_componente:
                material.es_componente = True
                material.save(update_fields=["es_componente"])

            Movimiento.objects.filter(pieza=pieza).delete()
            pieza.delete()
            material.recalcular_cantidad()
        return Response(status=status.HTTP_204_NO_CONTENT)