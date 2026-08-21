from rest_framework import viewsets, status
from datetime import timedelta, date

from datetime import timedelta, date
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from apps.catalogo.models import Material
from apps.catalogo.views import AlmacenScopedMixin
from django.db.models import Q

from django.http import HttpResponse
from apps.inspeccion.exporters import generar_excel_inspeccion, generar_pdf_inspeccion, generar_excel_inspecciones_generales

from apps.inspeccion.models import (
    PlantillaCriterio, Criterio, Inspeccion, RespuestaCriterio,
    PlanInspeccionAnual, ProgramacionInspeccion, DocumentoInspeccion,
)

from apps.inspeccion.planificacion import generar_plan_anual, construir_materiales_config
from apps.inspeccion.serializers import (
    PlantillaCriterioSerializer,
    CriterioSerializer,
    InspeccionSerializer,
    InspeccionCrearSerializer,
    RespuestaCriterioSerializer,
    ProgramacionInspeccionSerializer,
    PlanInspeccionAnualSerializer,
    DocumentoInspeccionSerializer,
)

from django.db.models import ProtectedError
from apps.accounts.permissions import IsInspectorOrAdministratorWrite

class PlantillaCriterioViewSet(viewsets.ModelViewSet):
    queryset = PlantillaCriterio.objects.prefetch_related("criterios").all()
    serializer_class = PlantillaCriterioSerializer
    permission_classes = [IsInspectorOrAdministratorWrite]

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {
                    "detail": "No se puede eliminar esta plantilla porque está asignada a una subcategoría de materiales o tiene inspecciones asociadas."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )


class CriterioViewSet(viewsets.ModelViewSet):
    queryset = Criterio.objects.select_related("plantilla").all()
    serializer_class = CriterioSerializer
    permission_classes = [IsInspectorOrAdministratorWrite]

    def get_queryset(self):
        qs = super().get_queryset()
        plantilla_id = self.request.query_params.get("plantilla")
        if plantilla_id:
            qs = qs.filter(plantilla_id=plantilla_id)
        return qs

    @action(detail=False, methods=["post"], url_path="reordenar")
    def reordenar(self, request):
        """
        Body: [{"id": 1, "orden": 1}, {"id": 2, "orden": 2}, ...]
        """
        items = request.data
        if not isinstance(items, list):
            return Response(
                {"detail": "Se esperaba una lista de objetos con 'id' y 'orden'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ids = [item.get("id") for item in items if isinstance(item, dict) and "id" in item]
        criterios_dict = {c.id: c for c in Criterio.objects.filter(id__in=ids)}
        updated = []
        for item in items:
            cid = item.get("id")
            nuevo_orden = item.get("orden")
            if cid in criterios_dict and isinstance(nuevo_orden, int):
                c = criterios_dict[cid]
                c.orden = nuevo_orden
                updated.append(c)

        if updated:
            Criterio.objects.bulk_update(updated, ["orden"])

        return Response({"status": "ok", "actualizados": len(updated)})

# Antes este viewset no forzaba nada: un Inspector podía ver/editar/exportar 
# inspecciones de cualquier almacén, incluso sin mandar el query param ?almacen=.

class InspeccionViewSet(AlmacenScopedMixin, viewsets.ModelViewSet):
    queryset = Inspeccion.objects.select_related(
        "material", "pieza", "plantilla", "inspector"
    ).prefetch_related("respuestas__criterio", "piezas_lote").all()
    permission_classes = [IsInspectorOrAdministratorWrite]
    almacen_lookup = "almacen"

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return InspeccionCrearSerializer
        return InspeccionSerializer
    # El almacén forzado va en el context, igual que en
    # MovimientoViewSet, y la validación ocurre en validate() ANTES de
    # guardar nada — is_valid(raise_exception=True) corta el request sin
    # llegar a tocar la base de datos.
    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["almacen_forzado"] = self._almacen_forzado()
        return context

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            inspeccion = serializer.save()
        return Response(InspeccionSerializer(inspeccion).data, status=status.HTTP_201_CREATED)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            inspeccion = serializer.save()
            self.check_almacen_objeto(inspeccion.almacen_id)
        return Response(InspeccionSerializer(inspeccion).data, status=status.HTTP_201_CREATED)

    def get_queryset(self):
        qs = super().get_queryset()  # AlmacenScopedMixin ya fuerza por almacen_forzado acá
        material_id = self.request.query_params.get("material")
        pieza_id = self.request.query_params.get("pieza")
        tipo = self.request.query_params.get("tipo")
        resultado = self.request.query_params.get("resultado")
        q = self.request.query_params.get("q")
        almacen_id = self.request.query_params.get("almacen")

        # el query param solo se respeta si NO hay almacén forzado
        # (si lo hay, el mixin ya filtró arriba y no debe poder pisarse
        # mandando otro ?almacen= en la URL).
        if almacen_id and self._almacen_forzado() is None:
            qs = qs.filter(almacen_id=almacen_id)

        if material_id:
            qs = qs.filter(material_id=material_id)
        if pieza_id:
            qs = qs.filter(pieza_id=pieza_id)
        if tipo:
            qs = qs.filter(tipo=tipo)
        if resultado:
            qs = qs.filter(resultado_general=resultado)
        if q:
            qs = qs.filter(
                Q(material__nombre__icontains=q)
                | Q(material__codigo__icontains=q)
                | Q(pieza__codigo__icontains=q)
                | Q(inspector__full_name__icontains=q)
            ).distinct()
        return qs
    
    @action(detail=False, methods=["get"], url_path="vencidas")
    def vencidas(self, request):

        materiales_inspeccionables = Material.objects.inspeccionables()

        # FIX: antes recorría TODOS los materiales inspeccionables del
        # sistema sin importar almacén. Ahora se acota igual que en
        # get_queryset — es el endpoint que consume InspectorDashboardPage.
        almacen_forzado = self._almacen_forzado()
        if almacen_forzado is not None:
            materiales_inspeccionables = materiales_inspeccionables.filter(almacen_id=almacen_forzado)
        else:
            almacen_id = request.query_params.get("almacen")
            if almacen_id:
                materiales_inspeccionables = materiales_inspeccionables.filter(almacen_id=almacen_id)

        resultado = []

        for material in materiales_inspeccionables.filter(control_individual=True):
            limite = timezone.now() - timedelta(days=material.periodicidad_inspeccion_dias)
            piezas_hoja = material.piezas.exclude(estado="Baja").filter(piezas_hijas__isnull=True)
            pendientes = []
            for pieza in piezas_hoja:
                # Busca la inspección más reciente: individual (FK) O por lote (M2M piezas_lote)
                ultima_ind  = pieza.inspecciones.order_by("-fecha").first()
                ultima_lote = pieza.inspecciones_grupales.order_by("-fecha").first()
                if ultima_ind and ultima_lote:
                    ultima = ultima_ind if ultima_ind.fecha >= ultima_lote.fecha else ultima_lote
                else:
                    ultima = ultima_ind or ultima_lote

                if not ultima or ultima.fecha < limite:
                    pendientes.append({"pieza_id": pieza.id, "pieza_codigo": pieza.codigo})

            if pendientes:
                resultado.append({
                    "material_id": material.id,
                    "material_codigo": material.codigo,
                    "material_nombre": material.nombre,
                    "plantilla": material.subcategoria.plantilla_inspeccion.nombre,
                    "cantidad_pendiente": len(pendientes),
                    "piezas_pendientes": pendientes,
                })

        for material in materiales_inspeccionables.filter(control_individual=False):
            limite = timezone.now() - timedelta(days=material.periodicidad_inspeccion_dias)
            ultima = material.inspecciones.order_by("-fecha").first()
            if not ultima or ultima.fecha < limite:
                resultado.append({
                    "material_id": material.id,
                    "material_codigo": material.codigo,
                    "material_nombre": material.nombre,
                    "plantilla": material.subcategoria.plantilla_inspeccion.nombre,
                    "cantidad_pendiente": None,
                    "piezas_pendientes": [],
                })

        return Response(resultado)

    @action(detail=True, methods=["get"], url_path="exportar-excel")
    def exportar_excel(self, request, pk=None):
        # get_object() ya usa get_queryset() de arriba -> protegido por el
        # mismo scoping. Un Inspector no puede exportar una inspección de
        # otro almacén ni sabiendo el pk (devuelve 404 en vez de 200).
        inspeccion = self.get_object()
        buffer = generar_excel_inspeccion(inspeccion)
        response = HttpResponse(
            buffer.read(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = f'attachment; filename="inspeccion_{inspeccion.id}.xlsx"'
        return response

    @action(detail=True, methods=["get"], url_path="exportar-pdf")
    def exportar_pdf(self, request, pk=None):
        inspeccion = self.get_object()
        buffer = generar_pdf_inspeccion(inspeccion)
        response = HttpResponse(buffer.read(), content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="inspeccion_{inspeccion.id}.pdf"'
        return response

    @action(detail=False, methods=["get"], url_path="exportar-excel")
    def exportar_excel_general(self, request):
        """
        Exporta un reporte Excel general y consolidado para todo el almacén:
        Resumen por estado, Por Mes, Vencidas, Top Materiales no conformes + BarChart.
        """
        almacen_id = getattr(request, "almacen_id", None)
        if almacen_id is None:
            almacen_id = request.query_params.get("almacen")

        buffer, filename = generar_excel_inspecciones_generales(almacen_id=almacen_id)
        response = HttpResponse(
            buffer.read(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response

    @action(detail=True, methods=["get"], url_path="documentos")
    def documentos(self, request, pk=None):
        # get_object() ya usa get_queryset() de arriba -> mismo scoping por
        # almacén que el resto del viewset (un Inspector no puede listar
        # documentos de una inspección de otro almacén).
        inspeccion = self.get_object()
        documentos = inspeccion.documentos.select_related("subido_por").all()
        serializer = DocumentoInspeccionSerializer(documentos, many=True, context={"request": request})
        return Response(serializer.data)

class DocumentoInspeccionViewSet(viewsets.ModelViewSet):
    """CRUD de documentos adjuntos (PDF/Excel/Word) por inspección.
    El listado normal para la UI de detalle es GET /inspecciones/{id}/documentos/
    (arriba, en InspeccionViewSet); este viewset existe sobre todo para
    crear (subir) y eliminar, y opcionalmente filtrar por ?inspeccion=."""
    queryset = DocumentoInspeccion.objects.select_related("inspeccion", "subido_por").all()
    serializer_class = DocumentoInspeccionSerializer
    permission_classes = [IsInspectorOrAdministratorWrite]

    def get_queryset(self):
        qs = super().get_queryset()
        inspeccion_id = self.request.query_params.get("inspeccion")
        if inspeccion_id:
            qs = qs.filter(inspeccion_id=inspeccion_id)
        return qs

class RespuestaCriterioViewSet(viewsets.ModelViewSet):
    queryset = RespuestaCriterio.objects.select_related("inspeccion", "criterio").all()
    serializer_class = RespuestaCriterioSerializer
    permission_classes = [IsInspectorOrAdministratorWrite]

    def get_queryset(self):
        qs = super().get_queryset()
        inspeccion_id = self.request.query_params.get("inspeccion")
        if inspeccion_id:
            qs = qs.filter(inspeccion_id=inspeccion_id)
        return qs

class ProgramacionInspeccionViewSet(AlmacenScopedMixin, viewsets.ReadOnlyModelViewSet):
    queryset = ProgramacionInspeccion.objects.select_related(
        "material__subcategoria", "pieza__material__subcategoria", "plan"
    ).all()
    serializer_class = ProgramacionInspeccionSerializer
    permission_classes = [IsInspectorOrAdministratorWrite]
    almacen_lookup = "almacen"

    def get_queryset(self):
        qs = super().get_queryset()  # AlmacenScopedMixin ya fuerza por almacen_forzado 
        subcategoria_id = self.request.query_params.get("subcategoria")
        categoria_id = self.request.query_params.get("categoria")
        desde = self.request.query_params.get("desde")
        hasta = self.request.query_params.get("hasta")
        almacen_id = self.request.query_params.get("almacen")

        if almacen_id and self._almacen_forzado() is None:
            qs = qs.filter(almacen_id=almacen_id)
        if subcategoria_id:
            qs = qs.filter(Q(material__subcategoria_id=subcategoria_id) | Q(pieza__material__subcategoria_id=subcategoria_id))
        if categoria_id:
            qs = qs.filter(Q(material__subcategoria__categoria_id=categoria_id) | Q(pieza__material__subcategoria__categoria_id=categoria_id))
        if desde:
            qs = qs.filter(fecha_programada__gte=desde)
        if hasta:
            qs = qs.filter(fecha_programada__lte=hasta)
        return qs
    @action(detail=True, methods=["post"], url_path="reprogramar")
    def reprogramar(self, request, pk=None):
        """Permite cambiar la fecha de una programación pendiente."""
        programacion = self.get_object()
        if programacion.estado != "pendiente":
            return Response(
                {"detail": "Solo se pueden reprogramar inspecciones en estado pendiente."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        nueva_fecha = request.data.get("nueva_fecha")
        motivo = request.data.get("motivo", "").strip()
        if not nueva_fecha:
            return Response(
                {"detail": "Debes especificar la nueva fecha programada."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        fecha_anterior = programacion.fecha_programada
        programacion.fecha_programada = nueva_fecha
        
        # Opcional: Si tienes campo de observaciones o notas
        if hasattr(programacion, "observaciones"):
            nota = f"[Reprogramada del {fecha_anterior} al {nueva_fecha}] Motivo: {motivo or 'No especificado'}"
            programacion.observaciones = f"{programacion.observaciones}\n{nota}".strip()
        programacion.save()
        return Response({
            "detail": f"Inspección reprogramada exitosamente para el {nueva_fecha}.",
            "id": programacion.id,
            "nueva_fecha": programacion.fecha_programada,
        })

    @action(detail=True, methods=["patch"], url_path="reprogramar")
    def reprogramar(self, request, pk=None):
        """
        Cambia la fecha_programada de una ProgramacionInspeccion pendiente.
        PATCH /programaciones/{id}/reprogramar/
        Body: { "fecha_programada": "YYYY-MM-DD", "motivo": "..." }
        """
        from apps.inspeccion.planificacion import _ajustar_dia_laborable

        prog = self.get_object()

        if prog.estado != "pendiente":
            return Response(
                {"detail": "Solo se pueden reprogramar inspecciones en estado 'pendiente'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        nueva_fecha_str = request.data.get("fecha_programada")
        if not nueva_fecha_str:
            return Response(
                {"detail": "Debes indicar la nueva 'fecha_programada' (formato YYYY-MM-DD)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            nueva_fecha = date.fromisoformat(nueva_fecha_str)
        except ValueError:
            return Response(
                {"detail": f"Formato de fecha inválido: '{nueva_fecha_str}'. Usa YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if nueva_fecha < date.today():
            return Response(
                {"detail": "No puedes programar una inspección en una fecha pasada."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Ajustar al día laborable más cercano si cae en fin de semana
        nueva_fecha = _ajustar_dia_laborable(nueva_fecha)

        prog.fecha_programada = nueva_fecha
        prog.save(update_fields=["fecha_programada"])

        serializer = self.get_serializer(prog)
        return Response(serializer.data, status=status.HTTP_200_OK)



class PlanInspeccionAnualViewSet(AlmacenScopedMixin, viewsets.ReadOnlyModelViewSet):
    queryset = PlanInspeccionAnual.objects.all()
    serializer_class = PlanInspeccionAnualSerializer
    permission_classes = [IsInspectorOrAdministratorWrite]
    almacen_lookup = "almacen"

    def get_queryset(self):
        qs = super().get_queryset()
        almacen_id = self.request.query_params.get("almacen")
        if almacen_id and self._almacen_forzado() is None:
            qs = qs.filter(almacen_id=almacen_id)
        return qs

    @action(detail=False, methods=["post"], url_path="generar")
    def generar(self, request):
        """
        Genera el plan de inspección anual PARA UN ALMACÉN. Si el usuario tiene almacén forzado (Almacenero/Inspector),
        se usa ese sin importar qué mande el body — no se puede "generar
        para otro almacén" cambiando el payload a mano. Administrador debe
        mandar "almacen" explícito.
        POST /plan-anual/generar/  Body: { "anio": 2026, "almacen": 3, "forzar": false }
        """
        anio = request.data.get("anio", date.today().year)
        forzar = bool(request.data.get("forzar", False))

        almacen_forzado = self._almacen_forzado()
        if almacen_forzado is not None:
            almacen_id = almacen_forzado
        else:
            almacen_id = request.data.get("almacen")
            if not almacen_id:
                return Response(
                    {"detail": "Debes indicar el almacén para el que se genera el plan."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        from apps.catalogo.models import Almacen
        try:
            almacen_obj = Almacen.objects.get(pk=almacen_id)
        except Almacen.DoesNotExist:
            return Response(
                {"detail": f"No se encontró el almacén con id {almacen_id}."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if not forzar and ProgramacionInspeccion.objects.filter(plan__anio=anio, almacen=almacen_obj).exists():
            return Response(
                {
                    "detail": f"Ya existen programaciones para el año {anio} en este almacén. "
                              "Activa la opción 'Forzar regeneración' para regenerar de todos modos.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if forzar:
            # Limpia solo las "pendiente" de ESTE almacén — las "realizada" nunca se tocan.
            ProgramacionInspeccion.objects.filter(
                plan__anio=anio, almacen=almacen_obj, estado="pendiente",
            ).delete()

        fecha_inicio = date(anio, 1, 1)
        materiales_config = construir_materiales_config(almacen_obj)

        plan, creadas = generar_plan_anual(anio, fecha_inicio, materiales_config, almacen_obj)
        return Response(
            {
                "plan": PlanInspeccionAnualSerializer(plan).data,
                "programaciones_creadas": len(creadas),
            },
            status=status.HTTP_201_CREATED,
        )
