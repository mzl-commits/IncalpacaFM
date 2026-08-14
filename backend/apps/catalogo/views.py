from django.db import transaction
from django.db.models import ProtectedError
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.db.models import Q, Exists, OuterRef

from rest_framework.exceptions import PermissionDenied

from apps.accounts.models import AccountProfile
from apps.accounts.permissions import (
    IsAlmaceneroOrAdministratorWrite,
    IsAlmaceneroAdminOrInspectorWrite,
)
from apps.catalogo.models import (
    Categoria, Subcategoria, Material, Pieza, Almacen, UnidadMedida, TipoManejoStock,
)

from apps.catalogo.serializers import (
    CategoriaSerializer,
    SubcategoriaSerializer,
    MaterialSerializer,
    MaterialDetalleSerializer,
    MaterialFrecuenciaInspeccionSerializer,
    PiezaSerializer,
    AltaPiezasSueltasSerializer,
    AltaEstucheSerializer,
    AltaEstucheInlineSerializer,
    AjustarStockSerializer,
    ReemplazarHijaSerializer,
    AgregarHijaInlineSerializer,
    AlmacenSerializer,
    UnidadMedidaSerializer,
    TipoManejoStockSerializer,
)


class AlmacenScopedMixin:
    """Fuerza almacén del perfil para Almacenero/Inspector, ignorando ?almacen=.
    Cada ViewSet define `almacen_lookup` (path ORM hasta Almacen)."""

    almacen_lookup = "almacen"

    def _perfil(self):
        return getattr(self.request.user, "account_profile", None)

    def _almacen_forzado(self):
        perfil = self._perfil()
        if perfil is None:
            return None
        if perfil.role in (AccountProfile.Role.ALMACENERO, AccountProfile.Role.INSPECTOR):
            return perfil.almacen_id
        return None

    def get_queryset(self):
        qs = super().get_queryset()
        almacen_forzado = self._almacen_forzado()
        if almacen_forzado is not None:
            qs = qs.filter(**{self.almacen_lookup: almacen_forzado})
        return qs

    def check_almacen_objeto(self, almacen_id):
        """403 si el almacén forzado no coincide con almacen_id."""
        almacen_forzado = self._almacen_forzado()
        if almacen_forzado is not None and almacen_id != almacen_forzado:
            raise PermissionDenied(
                "No tienes permiso para operar sobre un almacén distinto al asignado a tu cuenta."
            )


class AlmacenViewSet(AlmacenScopedMixin, viewsets.ModelViewSet):
    queryset = Almacen.objects.all()
    serializer_class = AlmacenSerializer
    permission_classes = [IsAlmaceneroOrAdministratorWrite]
    almacen_lookup = "pk"  # Almacen.pk ES el almacén


class _CatalogoEditableViewSet(viewsets.ModelViewSet):
    """Base para catálogos editables (unidades de medida, tipos de manejo de
    stock): permite crear/editar/eliminar, pero si un material ya usa el
    registro (on_delete=PROTECT), devuelve un error claro en vez de un 500."""
    permission_classes = [IsAlmaceneroOrAdministratorWrite]

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"detail": "No se puede eliminar: hay materiales que usan este registro. "
                           "Desactívalo en su lugar si ya no debe ofrecerse para nuevos materiales."},
                status=status.HTTP_400_BAD_REQUEST,
            )


class UnidadMedidaViewSet(_CatalogoEditableViewSet):
    queryset = UnidadMedida.objects.all()
    serializer_class = UnidadMedidaSerializer


class TipoManejoStockViewSet(_CatalogoEditableViewSet):
    queryset = TipoManejoStock.objects.all()
    serializer_class = TipoManejoStockSerializer


class CategoriaViewSet(AlmacenScopedMixin, viewsets.ModelViewSet):
    queryset = Categoria.objects.all()
    serializer_class = CategoriaSerializer
    permission_classes = [IsAlmaceneroOrAdministratorWrite]
    almacen_lookup = "almacen"

    def get_queryset(self):
        qs = super().get_queryset()
        almacen_id = self.request.query_params.get("almacen")
        if almacen_id and self._almacen_forzado() is None:
            qs = qs.filter(almacen_id=almacen_id)
        return qs

    def perform_create(self, serializer):
        almacen_forzado = self._almacen_forzado()
        if almacen_forzado is not None:
            serializer.save(almacen_id=almacen_forzado)
        else:
            serializer.save()

    def perform_update(self, serializer):
        self.check_almacen_objeto(serializer.instance.almacen_id)
        nuevo_almacen = serializer.validated_data.get("almacen")
        if nuevo_almacen is not None:
            self.check_almacen_objeto(nuevo_almacen.id)
        serializer.save()

class SubcategoriaViewSet(AlmacenScopedMixin, viewsets.ModelViewSet):
    queryset = Subcategoria.objects.select_related("categoria").all()
    serializer_class = SubcategoriaSerializer
    permission_classes = [IsAlmaceneroOrAdministratorWrite]
    almacen_lookup = "categoria__almacen"

    def get_queryset(self):
        qs = super().get_queryset()
        categoria_id = self.request.query_params.get("categoria")
        almacen_id = self.request.query_params.get("almacen")
        if categoria_id:
            qs = qs.filter(categoria_id=categoria_id)
        if almacen_id and self._almacen_forzado() is None:
            qs = qs.filter(categoria__almacen_id=almacen_id)
        return qs

    def perform_create(self, serializer):
        categoria = serializer.validated_data.get("categoria")
        if categoria is not None:
            self.check_almacen_objeto(categoria.almacen_id)
        serializer.save()

    def perform_update(self, serializer):
        self.check_almacen_objeto(serializer.instance.categoria.almacen_id)
        nueva_categoria = serializer.validated_data.get("categoria")
        if nueva_categoria is not None:
            self.check_almacen_objeto(nueva_categoria.almacen_id)
        serializer.save()

class MaterialViewSet(AlmacenScopedMixin, viewsets.ModelViewSet):
    queryset = Material.objects.select_related("subcategoria__categoria").all()
    serializer_class = MaterialSerializer
    permission_classes = [IsAlmaceneroOrAdministratorWrite]
    almacen_lookup = "almacen"

    def perform_create(self, serializer):
        almacen_forzado = self._almacen_forzado()
        if almacen_forzado is not None:
            subcategoria = serializer.validated_data.get("subcategoria")
            if subcategoria is not None and subcategoria.categoria.almacen_id != almacen_forzado:
                raise PermissionDenied(
                    "La subcategoría elegida pertenece a un almacén distinto al asignado a tu cuenta."
                )
            serializer.save(almacen_id=almacen_forzado)
        else:
            serializer.save()

    def perform_update(self, serializer):
        self.check_almacen_objeto(serializer.instance.almacen_id)
        nuevo_almacen = serializer.validated_data.get("almacen")
        if nuevo_almacen is not None:
            self.check_almacen_objeto(nuevo_almacen.id)
        serializer.save()

    def get_serializer_class(self):
        if self.action == "retrieve":
            return MaterialDetalleSerializer
        return MaterialSerializer

    @action(
        detail=True,
        methods=["patch"],
        url_path="frecuencia-inspeccion",
        permission_classes=[IsAlmaceneroAdminOrInspectorWrite],
    )
    def frecuencia_inspeccion(self, request, pk=None):
        material = self.get_object()
        serializer = MaterialFrecuenciaInspeccionSerializer(
            material, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def get_queryset(self):
        qs = super().get_queryset()
        subcategoria_id = self.request.query_params.get("subcategoria")
        categoria_id = self.request.query_params.get("categoria")
        control_individual = self.request.query_params.get("control_individual")
        busqueda = self.request.query_params.get("q")
        incluir_componentes = self.request.query_params.get("incluir_componentes")
        inspeccionable = self.request.query_params.get("inspeccionable")
        activo = self.request.query_params.get("activo")
        almacen_id = self.request.query_params.get("almacen")

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
        if almacen_id and self._almacen_forzado() is None:
            qs = qs.filter(almacen_id=almacen_id)

        if busqueda:
            qs = qs.filter(
                Q(nombre__icontains=busqueda)
                | Q(codigo__icontains=busqueda)
                | Q(marca__icontains=busqueda)
                | Q(modelo__icontains=busqueda)
                | Q(piezas__codigo__icontains=busqueda)
                | Q(piezas__detalle__icontains=busqueda)
                | Q(piezas__piezas_hijas__codigo__icontains=busqueda)
                | Q(piezas__piezas_hijas__detalle__icontains=busqueda)
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
        """Elimina el material y TODAS sus piezas, movimientos e inspecciones. Requiere body {"confirmar": true}."""
        if not request.data.get("confirmar"):
            return Response(
                {"detail": "Debes enviar { \"confirmar\": true } para confirmar la eliminación."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        material = self.get_object()
        nombre = str(material)
        with transaction.atomic():
            from apps.inspeccion.models import RespuestaCriterio, Inspeccion, ProgramacionInspeccion
            from apps.inventario.models import Movimiento, SolicitudMovimiento
            from apps.workorders.models import WorkOrderMaterial

            # Recopilar todas las piezas (directas + hijas) del material
            piezas_directas = list(material.piezas.values_list("id", flat=True))
            from apps.catalogo.models import Pieza
            piezas_hijas = list(
                Pieza.objects.filter(padre_id__in=piezas_directas).values_list("id", flat=True)
            )
            todas_piezas_ids = piezas_directas + piezas_hijas

            # 1. Respuestas de criterio de inspecciones ligadas al material o sus piezas
            RespuestaCriterio.objects.filter(inspeccion__material=material).delete()
            RespuestaCriterio.objects.filter(inspeccion__pieza_id__in=todas_piezas_ids).delete()

            # 2. Inspecciones del material y de sus piezas
            Inspeccion.objects.filter(material=material).delete()
            Inspeccion.objects.filter(pieza_id__in=todas_piezas_ids).delete()

            # 3. Programaciones de inspección
            ProgramacionInspeccion.objects.filter(material=material).delete()
            ProgramacionInspeccion.objects.filter(pieza_id__in=todas_piezas_ids).delete()

            # 4. Movimientos de inventario
            Movimiento.objects.filter(material=material).delete()
            Movimiento.objects.filter(pieza_id__in=todas_piezas_ids).delete()

            # 5. Solicitudes de movimiento
            SolicitudMovimiento.objects.filter(material=material).delete()
            SolicitudMovimiento.objects.filter(pieza_id__in=todas_piezas_ids).delete()

            # 6. Materiales de órdenes de trabajo (WorkOrderMaterial)
            WorkOrderMaterial.objects.filter(material=material).delete()

            # 7. Piezas hijas primero, luego piezas directas
            Pieza.objects.filter(id__in=piezas_hijas).delete()
            Pieza.objects.filter(id__in=piezas_directas).delete()

            # 8. Finalmente el material
            material.delete()

        return Response(
            {"detail": f"Material '{nombre}' eliminado correctamente junto con todos sus datos."},
            status=status.HTTP_200_OK,
        )

    # No tengo el código de estos 4 serializers (AltaPiezasSueltas, AltaEstuche,
    # AjustarStock, AltaEstucheInline), así que valido DESPUÉS del save y hago
    # rollback si el resultado quedó fuera del almacén forzado. Ideal: mover
    # esta validación a los serializers, antes de guardar.
    @action(detail=False, methods=["post"], url_path="alta-piezas-sueltas")
    @transaction.atomic
    def alta_piezas_sueltas(self, request):
        serializer = AltaPiezasSueltasSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        piezas = serializer.save()
        for pieza in piezas:
            self.check_almacen_objeto(pieza.material.almacen_id)
        return Response(
            PiezaSerializer(piezas, many=True).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["post"], url_path="alta-estuche")
    @transaction.atomic
    def alta_estuche(self, request):
        serializer = AltaEstucheSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        piezas = serializer.save()
        for pieza in piezas:
            self.check_almacen_objeto(pieza.material.almacen_id)
        return Response(
            PiezaSerializer(piezas, many=True).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["post"], url_path="ajustar-stock")
    @transaction.atomic
    def ajustar_stock_action(self, request):
        serializer = AjustarStockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        material = serializer.save()
        self.check_almacen_objeto(material.almacen_id)
        return Response(MaterialSerializer(material).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="alta-estuche-inline")
    @transaction.atomic
    def alta_estuche_inline(self, request):
        """Crea estuches con piezas hijas inline (nombre+medida+cantidad); crea el material hijo si no existe."""
        serializer = AltaEstucheInlineSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        piezas = serializer.save()
        for pieza in piezas:
            self.check_almacen_objeto(pieza.material.almacen_id)
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


class PiezaViewSet(AlmacenScopedMixin, viewsets.ModelViewSet):
    # Antes sin ningún filtro de almacén. Ahora scoped vía material__almacen.
    queryset = Pieza.objects.select_related("material", "padre").all()
    serializer_class = PiezaSerializer
    permission_classes = [IsAlmaceneroOrAdministratorWrite]
    almacen_lookup = "material__almacen"

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
            # Incluye hijas del material (para que sean seleccionables en inspeccion/movimiento)
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
                | Q(detalle__icontains=busqueda)
                | Q(material__nombre__icontains=busqueda)
                | Q(material__codigo__icontains=busqueda)
            )
        return qs

    def perform_create(self, serializer):
        material = serializer.validated_data.get("material")
        if material is not None:
            self.check_almacen_objeto(material.almacen_id)
        serializer.save()

    def perform_update(self, serializer):
        self.check_almacen_objeto(serializer.instance.material.almacen_id)
        nuevo_material = serializer.validated_data.get("material")
        if nuevo_material is not None:
            self.check_almacen_objeto(nuevo_material.almacen_id)
        serializer.save()

    @action(detail=True, methods=["post"], url_path="reemplazar-hija")
    @transaction.atomic
    def reemplazar_hija(self, request, pk=None):
        """Reemplaza una pieza hija rota/baja con una pieza suelta disponible del mismo material."""
        hija = self.get_object()
        serializer = ReemplazarHijaSerializer(
            data=request.data,
            context={"hija": hija, "request": request},
        )
        serializer.is_valid(raise_exception=True)
        nueva_hija = serializer.save()
        self.check_almacen_objeto(nueva_hija.material.almacen_id)
        return Response(PiezaSerializer(nueva_hija).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="agregar-hija-inline")
    def agregar_hija_inline(self, request, pk=None):
        """Agrega piezas hijas a un estuche existente; crea el material hijo si no existe."""
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
        """Quita una pieza hija de su estuche (padre=null); pasa a ser pieza suelta del mismo material."""
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
        """Elimina una pieza (suelta o estuche, con sus hijas y movimientos). Marca los materiales
        de las hijas como es_componente=True para que no aparezcan sueltos en el catálogo."""
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