from rest_framework import viewsets, status

from datetime import timedelta, date
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.catalogo.models import Material
from django.db.models import Q

from django.http import HttpResponse
from apps.inspeccion.exporters import generar_excel_inspeccion, generar_pdf_inspeccion

from apps.inspeccion.models import (
    PlantillaCriterio, Criterio, Inspeccion, RespuestaCriterio,
    PlanInspeccionAnual, ProgramacionInspeccion,
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

class InspeccionViewSet(viewsets.ModelViewSet):
    queryset = Inspeccion.objects.select_related(
        "material", "pieza", "plantilla", "inspector"
    ).prefetch_related("respuestas__criterio", "piezas_lote").all()
    permission_classes = [IsInspectorOrAdministratorWrite]

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return InspeccionCrearSerializer
        return InspeccionSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        material_id = self.request.query_params.get("material")
        pieza_id = self.request.query_params.get("pieza")
        tipo = self.request.query_params.get("tipo")
        resultado = self.request.query_params.get("resultado")
        q = self.request.query_params.get("q")

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

class ProgramacionInspeccionViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = ProgramacionInspeccion.objects.select_related(
        "material__subcategoria", "pieza__material__subcategoria", "plan"
    ).all()
    serializer_class = ProgramacionInspeccionSerializer
    permission_classes = [IsInspectorOrAdministratorWrite]

    def get_queryset(self):
        qs = super().get_queryset()
        subcategoria_id = self.request.query_params.get("subcategoria")
        categoria_id = self.request.query_params.get("categoria")
        desde = self.request.query_params.get("desde")
        hasta = self.request.query_params.get("hasta")

        if subcategoria_id:
            qs = qs.filter(Q(material__subcategoria_id=subcategoria_id) | Q(pieza__material__subcategoria_id=subcategoria_id))
        if categoria_id:
            qs = qs.filter(Q(material__subcategoria__categoria_id=categoria_id) | Q(pieza__material__subcategoria__categoria_id=categoria_id))
        if desde:
            qs = qs.filter(fecha_programada__gte=desde)
        if hasta:
            qs = qs.filter(fecha_programada__lte=hasta)
        return qs

class PlanInspeccionAnualViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = PlanInspeccionAnual.objects.all()
    serializer_class = PlanInspeccionAnualSerializer
    permission_classes = [IsInspectorOrAdministratorWrite]

    @action(detail=False, methods=["post"], url_path="generar")
    def generar(self, request):
        """
        Genera el plan de inspección anual (mismo cálculo que el comando de
        terminal plan_anual.py — ambos usan construir_materiales_config()).
        Bloquea la regeneración accidental de un año que ya tiene
        programaciones, salvo que se envíe { "forzar": true }.
        POST /plan-anual/generar/  Body: { "anio": 2026, "forzar": false }
        """
        anio = request.data.get("anio", date.today().year)
        forzar = bool(request.data.get("forzar", False))

        if not forzar and ProgramacionInspeccion.objects.filter(plan__anio=anio).exists():
            return Response(
                {
                    "detail": f"Ya existen programaciones para el año {anio}. "
                              "Envía { \"forzar\": true } para regenerar de todos modos.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if forzar:
            # Limpia las programaciones aún no cumplidas antes de crear las nuevas,
            # para no acumular duplicados (bug detectado: regenerar con forzar=True
            # varias veces dejaba N copias "pendiente" del mismo material/pieza,
            # de las cuales solo una se cerraba al registrar una inspección real).
            # Las ya "realizada" NUNCA se tocan — es historial real, no se borra.
            ProgramacionInspeccion.objects.filter(
                plan__anio=anio, estado="pendiente",
            ).delete()

        fecha_inicio = date(anio, 1, 1)
        materiales_config = construir_materiales_config()

        plan, creadas = generar_plan_anual(anio, fecha_inicio, materiales_config)
        return Response(
            {
                "plan": PlanInspeccionAnualSerializer(plan).data,
                "programaciones_creadas": len(creadas),
            },
            status=status.HTTP_201_CREATED,
        )