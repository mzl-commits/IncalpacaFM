from rest_framework import viewsets
from rest_framework.permissions import AllowAny

from datetime import timedelta
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.catalogo.models import Material, Pieza

from django.http import HttpResponse
from apps.inspeccion.exporters import generar_excel_inspeccion, generar_pdf_inspeccion

from apps.inspeccion.models import PlantillaCriterio, Criterio, Inspeccion, RespuestaCriterio
from apps.inspeccion.serializers import (
    PlantillaCriterioSerializer,
    CriterioSerializer,
    InspeccionSerializer,
    InspeccionCrearSerializer,
    RespuestaCriterioSerializer,
)


class PlantillaCriterioViewSet(viewsets.ModelViewSet):
    queryset = PlantillaCriterio.objects.prefetch_related("criterios").all()
    serializer_class = PlantillaCriterioSerializer
    permission_classes = [AllowAny]


class CriterioViewSet(viewsets.ModelViewSet):
    queryset = Criterio.objects.select_related("plantilla").all()
    serializer_class = CriterioSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        plantilla_id = self.request.query_params.get("plantilla")
        if plantilla_id:
            qs = qs.filter(plantilla_id=plantilla_id)
        return qs


class InspeccionViewSet(viewsets.ModelViewSet):
    queryset = Inspeccion.objects.select_related(
        "material", "pieza", "plantilla", "inspector"
    ).prefetch_related("respuestas__criterio", "piezas_lote").all()
    permission_classes = [AllowAny]

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

        if material_id:
            qs = qs.filter(material_id=material_id)
        if pieza_id:
            qs = qs.filter(pieza_id=pieza_id)
        if tipo:
            qs = qs.filter(tipo=tipo)
        if resultado:
            qs = qs.filter(resultado_general=resultado)
        return qs
    
    @action(detail=False, methods=["get"], url_path="vencidas")
    def vencidas(self, request):
        limite = timezone.now() - timedelta(days=90)  # o lógica de trimestre, según definamos
        materiales_inspeccionables = Material.objects.filter(
            subcategoria__plantilla_inspeccion__isnull=False,
            subcategoria__categoria__requiere_inspeccion=True,
            tipo_control="retornable",
            es_componente=False,
            activo=True,
            subcategoria__activo=True,
            subcategoria__categoria__activo=True,
        )
        resultado = []

        for material in materiales_inspeccionables.filter(control_individual=True):
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
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        inspeccion_id = self.request.query_params.get("inspeccion")
        if inspeccion_id:
            qs = qs.filter(inspeccion_id=inspeccion_id)
        return qs
