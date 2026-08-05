from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from django.core.exceptions import ValidationError
from django.contrib.auth import get_user_model

from apps.inventario.models import Movimiento
from apps.catalogo.models import Material, Pieza
from apps.inventario.serializers import (
    MovimientoSerializer,
    SalidaMaterialSerializer,
    SalidaPiezaSerializer,
    EntradaMaterialSerializer,
    EntradaPiezaSerializer,
    BajaMaterialSerializer,
    BajaPiezaSerializer,
    PiezaPrestadaSerializer,
)
from apps.inventario.services import (
    registrar_salida_material,
    registrar_salida_pieza,
    registrar_entrada_material,
    registrar_entrada_pieza,
    registrar_baja_material,
    registrar_baja_pieza,
)
from django.utils import timezone

User = get_user_model()


class MovimientoViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Movimiento.objects.select_related("material", "pieza", "responsable").all()
    serializer_class = MovimientoSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        material_id = self.request.query_params.get("material")
        pieza_id = self.request.query_params.get("pieza")
        tipo = self.request.query_params.get("tipo")
        lote_id = self.request.query_params.get("lote_id")
        responsable_id = self.request.query_params.get("responsable")

        if material_id:
            qs = qs.filter(material_id=material_id)
        if pieza_id:
            qs = qs.filter(pieza_id=pieza_id)
        if tipo:
            qs = qs.filter(tipo=tipo)
        if lote_id:
            qs = qs.filter(lote_id=lote_id)
        if responsable_id:
            qs = qs.filter(responsable_id=responsable_id)
        return qs

    @action(detail=False, methods=["post"], url_path="salida-material")
    def salida_material(self, request):
        serializer = SalidaMaterialSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            material = Material.objects.get(pk=data["material_id"])
            responsable = User.objects.get(pk=data["responsable_id"])
            mov = registrar_salida_material(
                material=material,
                cantidad=data["cantidad"],
                responsable=responsable,
                referencia_externa=data.get("referencia_externa", ""),
                observaciones=data.get("observaciones", ""),
            )
            return Response(MovimientoSerializer(mov).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"detail": str(e.message)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"], url_path="salida-pieza")
    def salida_pieza(self, request):
        serializer = SalidaPiezaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            pieza = Pieza.objects.get(pk=data["pieza_id"])
            responsable = User.objects.get(pk=data["responsable_id"])
            movimientos, hijas_excluidas = registrar_salida_pieza(
                pieza=pieza,
                responsable=responsable,
                referencia_externa=data.get("referencia_externa", ""),
                observaciones=data.get("observaciones", ""),
                piezas_hijas_ids=data.get("piezas_hijas_ids"),  # None si no se envía
            )
            respuesta = {
                "movimientos": MovimientoSerializer(movimientos, many=True).data,
            }
            # Avisar si el estuche salió incompleto
            if hijas_excluidas:
                respuesta["aviso"] = f"{len(hijas_excluidas)} pieza(s) no salieron por no estar disponibles."
                respuesta["hijas_excluidas"] = hijas_excluidas
            return Response(respuesta, status=status.HTTP_201_CREATED)
        
        except ValidationError as e:
            return Response({"detail": str(e.message)}, status=status.HTTP_400_BAD_REQUEST)


    @action(detail=False, methods=["post"], url_path="entrada-material")
    def entrada_material(self, request):
        serializer = EntradaMaterialSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            material = Material.objects.get(pk=data["material_id"])
            responsable = User.objects.get(pk=data["responsable_id"])
            mov = registrar_entrada_material(
                material=material,
                cantidad=data["cantidad"],
                responsable=responsable,
                observaciones=data.get("observaciones", ""),
            )
            return Response(MovimientoSerializer(mov).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"detail": str(e.message)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"], url_path="entrada-pieza")
    def entrada_pieza(self, request):
        serializer = EntradaPiezaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            pieza = Pieza.objects.get(pk=data["pieza_id"])
            responsable = User.objects.get(pk=data["responsable_id"])
            mov = registrar_entrada_pieza(
                pieza=pieza,
                responsable=responsable,
                observaciones=data.get("observaciones", ""),
            )
            return Response(MovimientoSerializer(mov).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"detail": str(e.message)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"], url_path="baja-material")
    def baja_material(self, request):
        serializer = BajaMaterialSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            material = Material.objects.get(pk=data["material_id"])
            responsable = User.objects.get(pk=data["responsable_id"])
            mov = registrar_baja_material(
                material=material,
                cantidad=data["cantidad"],
                responsable=responsable,
                observaciones=data.get("observaciones", ""),
            )
            return Response(MovimientoSerializer(mov).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"detail": str(e.message)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["post"], url_path="baja-pieza")
    def baja_pieza(self, request):
        serializer = BajaPiezaSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            pieza = Pieza.objects.get(pk=data["pieza_id"])
            responsable = User.objects.get(pk=data["responsable_id"])
            mov = registrar_baja_pieza(
                pieza=pieza,
                responsable=responsable,
                observaciones=data.get("observaciones", ""),
            )
            return Response(MovimientoSerializer(mov).data, status=status.HTTP_201_CREATED)
        except ValidationError as e:
            return Response({"detail": str(e.message)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=["get"], url_path="checklist-prestados")
    def checklist_prestados(self, request):
        """Retorna todas las piezas que están actualmente prestadas para el checklist de devolución."""
        qs = Pieza.objects.filter(estado="Prestado").select_related(
            "material", "padre"
        ).prefetch_related("movimientos")

        salio_hoy = request.query_params.get("salio_hoy")
        if salio_hoy is not None and salio_hoy.lower() == "true":
            hoy = timezone.now().date()
            qs = qs.filter(movimientos__tipo="salida", movimientos__fecha__date=hoy).distinct()

        fecha_str = request.query_params.get("fecha")
        if fecha_str:
            qs = qs.filter(movimientos__tipo="salida", movimientos__fecha__date=fecha_str).distinct()

        return Response(PiezaPrestadaSerializer(qs, many=True).data)
