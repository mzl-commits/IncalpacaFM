from rest_framework import viewsets, status
from datetime import timedelta, date

from django.utils import timezone
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
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
    @action(detail=False, methods=["get"], url_path="materiales-pendientes")
    def materiales_pendientes(self, request):
        """
        GET /inspecciones/materiales-pendientes/?estado=pendientes|todos&q=...
        Por defecto solo lista materiales/piezas SIN inspección vigente.
        ?estado=todos (o ?incluir_inspeccionados=true) también incluye los
        ya inspeccionados, con su última fecha/resultado, para re-inspección.
        """
        from apps.inspeccion.services import obtener_materiales_para_inspeccion

        estado = request.query_params.get("estado", "pendientes")
        incluir_inspeccionados = (
            estado == "todos"
            or request.query_params.get("incluir_inspeccionados", "").lower() == "true"
        )
        q = request.query_params.get("q")

        almacen_forzado = self._almacen_forzado()
        almacen_id = almacen_forzado if almacen_forzado is not None else request.query_params.get("almacen")

        resultado = obtener_materiales_para_inspeccion(
            almacen_id=almacen_id,
            incluir_inspeccionados=incluir_inspeccionados,
            q=q,
        )
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
    queryset = PlanInspeccionAnual.objects.select_related("almacen").all()
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


# ── Endpoints utilitarios (sin ViewSet) ───────────────────────────────────────

from rest_framework.decorators import api_view, permission_classes as drf_permission_classes
from rest_framework.permissions import IsAuthenticated


@api_view(["GET"])
@drf_permission_classes([IsAuthenticated])
def color_mes_view(request):
    """
    Devuelve el color de inspección del trimestre actual y la leyenda completa.
    GET /api/inspeccion/color-mes/
    GET /api/inspeccion/color-mes/?fecha=2026-04-15  (para una fecha específica)
    """
    from apps.inspeccion.utils import color_inspeccion_actual

    fecha_param = request.query_params.get("fecha")
    frecuencia_param = request.query_params.get("frecuencia", "trimestral")
    fecha = None
    if fecha_param:
        try:
            from datetime import date as dt_date
            fecha = dt_date.fromisoformat(fecha_param)
        except ValueError:
            return Response({"detail": "Formato de fecha inválido. Use YYYY-MM-DD."}, status=400)

    return Response(color_inspeccion_actual(para_fecha=fecha, frecuencia=frecuencia_param))


@api_view(["GET"])
@drf_permission_classes([IsAuthenticated])
def frecuencia_uso_view(request):
    """
    Calcula la frecuencia de inspección sugerida según el historial de salidas.
    GET /api/inspeccion/frecuencia-uso/?material=5
    GET /api/inspeccion/frecuencia-uso/?categoria=Herramientas&almacen=1
    GET /api/inspeccion/frecuencia-uso/?meses=6  (ventana de análisis, default 3)
    """
    from apps.inspeccion.utils import calcular_frecuencia_sugerida, calcular_frecuencia_categoria
    from apps.catalogo.models import Material, Almacen

    meses = int(request.query_params.get("meses", 3))
    material_id = request.query_params.get("material")
    categoria_nombre = request.query_params.get("categoria")
    almacen_id = request.query_params.get("almacen")

    if material_id:
        try:
            material = Material.objects.get(pk=material_id)
        except Material.DoesNotExist:
            return Response({"detail": "Material no encontrado."}, status=404)
        resultado = calcular_frecuencia_sugerida(material, meses=meses)
        resultado["material_id"] = material.id
        resultado["material_nombre"] = material.nombre
        return Response(resultado)

    if categoria_nombre and almacen_id:
        try:
            almacen = Almacen.objects.get(pk=almacen_id)
        except Almacen.DoesNotExist:
            return Response({"detail": "Almacén no encontrado."}, status=404)
        resultado = calcular_frecuencia_categoria(almacen, categoria_nombre, meses=meses)
        resultado["categoria"] = categoria_nombre
        resultado["almacen_id"] = almacen.id
        return Response(resultado)

    return Response(
        {"detail": "Proporciona ?material=<id> o ?categoria=<nombre>&almacen=<id>"},
        status=400,
    )


@api_view(["GET"])
@drf_permission_classes([IsAuthenticated])
def checklist_contexto_view(request):
    """
    Endpoint contextual para el formulario de Check List de Inspección.
    Devuelve:
      - Detección de si el material es herramienta manual.
      - Frecuencia recomendada según rotación de salidas (fórmula ABC) e historial de fallas.
      - Próxima fecha calculada a partir de la periodicidad sugerida.
      - Color oficial 5S del trimestre activo y leyenda de los 4 trimestres.
      - Lista de órdenes de trabajo (OT/OL/OP) recientes para autocompletar con control de permisos.
    """
    from apps.catalogo.models import Material
    from apps.inspeccion.utils import (
        calcular_frecuencia_sugerida,
        color_inspeccion_actual,
    )
    from datetime import date, timedelta

    material_id = request.query_params.get("material")

    material_obj = None
    if material_id:
        try:
            material_obj = Material.objects.select_related(
                "subcategoria__categoria", "subcategoria__plantilla_inspeccion"
            ).get(pk=material_id)
        except Material.DoesNotExist:
            pass

    # 1. Detección de Herramienta Manual
    es_manual = False
    frecuencia_data = None
    proxima_fecha = None

    if material_obj:
        subcat = material_obj.subcategoria
        subcat_nombre = (subcat.nombre if subcat else "").lower()
        cat_nombre = (subcat.categoria.nombre if subcat and subcat.categoria else "").lower()
        codigo_mat = (material_obj.codigo or "").upper()
        nombre_mat = (material_obj.nombre or "").lower()

        palabras_clave_manuales = [
            "alicate", "destornillador", "llave", "martillo", "sierra", "cincel",
            "lima", "pinza", "tenaza", "cizalla", "cutter", "flexometro", "huincha",
            "nivel", "brocha", "rodillo", "espatula", "prensa", "comba", "manual",
            "cortafrío", "formon", "escuadra", "remachadora", "garlopa",
        ]

        if "manual" in subcat_nombre:
            es_manual = True
        elif "herramienta" in cat_nombre and not any(k in subcat_nombre for k in ["inalámbric", "eléctric", "neumátic"]):
            es_manual = True
        elif codigo_mat.startswith("H") and not any(k in subcat_nombre for k in ["inalámbric", "eléctric"]):
            es_manual = True
        elif any(p in nombre_mat for p in palabras_clave_manuales):
            es_manual = True

        # 2. Cálculo de Frecuencia Sugerida
        frecuencia_data = calcular_frecuencia_sugerida(material_obj)
        frecuencia_data["material_id"] = material_obj.id
        frecuencia_data["material_nombre"] = material_obj.nombre
        frecuencia_data["categoria_nombre"] = cat_nombre or "General"

        periodicidad = frecuencia_data.get("periodicidad_dias", 90)
        proxima_fecha = (date.today() + timedelta(days=periodicidad)).isoformat()

    # 3. Código y Leyenda de Color 5S (según frecuencia: bimestral o trimestral)
    frecuencia_solicitada = request.query_params.get("frecuencia")
    if not frecuencia_solicitada and frecuencia_data:
        frecuencia_solicitada = frecuencia_data.get("frecuencia", "trimestral")
    color_info = color_inspeccion_actual(para_fecha=date.today(), frecuencia=frecuencia_solicitada or "trimestral")

    # 4. Órdenes disponibles (OT / OL / OP) con control de permisos por rol
    #
    # Fórmula de visibilidad previa (solo para referencia):
    #   ordenes_qs = WorkOrder.objects.exclude(
    #       status=WorkOrder.Status.CLOSED
    #   ).values("id", "code", "title")[:20]
    #
    # Fórmula actual con permisos por rol:
    #   - ADMIN / superuser → todas las OTs activas (no cerradas, no canceladas)
    #   - INSPECTOR / TECNICO / SUPERVISOR / ALMACENERO → solo las OTs donde
    #     el usuario aparece en alguna de estas relaciones:
    #       · almaceneros_autorizados  (autorizado explícitamente por el admin)
    #       · technician               (técnico principal de la OT)
    #       · supporting_technicians   (técnico de apoyo)
    #       · supervisor               (supervisor de la OT)
    #       · created_by               (quien creó la orden)
    ordenes_disponibles = []
    try:
        from apps.workorders.models import WorkOrder
        from apps.accounts.permissions import user_role
        from apps.accounts.models import AccountProfile

        rol = user_role(request.user)
        es_admin = (
            rol == AccountProfile.Role.ADMIN
            or getattr(request.user, "is_superuser", False)
        )

        ordenes_qs = WorkOrder.objects.exclude(
            status__in=[WorkOrder.Status.CLOSED, WorkOrder.Status.CANCELLED]
        ).select_related("incident", "technician")

        if not es_admin:
            ordenes_qs = ordenes_qs.filter(
                Q(almaceneros_autorizados=request.user)
                | Q(technician=request.user)
                | Q(supporting_technicians=request.user)
                | Q(supervisor=request.user)
                | Q(created_by=request.user)
            ).distinct()

        ordenes_qs = ordenes_qs.order_by("-created_at")[:100]

        for o in ordenes_qs:
            desc = ""
            if o.incident and o.incident.description:
                desc = o.incident.description.strip()
                if len(desc) > 55:
                    desc = desc[:52] + "..."
            elif o.specialty:
                desc = o.specialty
            else:
                desc = o.get_order_type_display()

            ordenes_disponibles.append({
                "id": str(o.id),
                "codigo": o.code,
                "descripcion": desc,
                "tipo": o.order_type,
                "estado": o.status,
            })
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("checklist_contexto: ordenes failed: %s", e)

    return Response({
        "es_herramienta_manual": es_manual,
        "frecuencia_sugerida": frecuencia_data,
        "proxima_fecha_calculada": proxima_fecha,
        "color_actual": color_info["actual"],
        "leyenda_colores": color_info["leyenda"],
        "tipo_periodo_color": color_info["tipo_periodo"],
        "ordenes_disponibles": ordenes_disponibles,
    })

