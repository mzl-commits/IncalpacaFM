import mimetypes

import hashlib
from django.core.files.base import ContentFile
from django.db.models import Q
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from drf_spectacular.types import OpenApiTypes
from rest_framework import generics, response, views
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.views import APIView

from apps.accounts.models import AccountProfile
from apps.accounts.permissions import IsAdministrator, IsWorkOrderParticipant, user_role

from .models import ReportTemplate, WorkOrder, WorkOrderCost, WorkOrderMaterial, WorkOrderPhoto, WorkOrderReport
from .reporting import build_work_order_pdf
from .serializers import (
    ReportTemplateSerializer, WorkOrderActionSerializer, WorkOrderCostSerializer,
    WorkOrderCostUpdateSerializer, WorkOrderMaterialSerializer,
    WorkOrderMaterialWriteSerializer, WorkOrderSerializer,
)
from config.schema import WorkOrderReportResponseSerializer


def participant_queryset(request):
    queryset = WorkOrder.objects.select_related(
        "incident",
        "incident__asset",
        "technician",
        "technician__account_profile",
        "supervisor",
        "supervisor__account_profile",
        "satisfaction",
        "correction_of",
    ).prefetch_related("traceability_photos", "correction_orders")
    role = user_role(request.user)
    if role == AccountProfile.Role.TECHNICIAN:
        queryset = queryset.exclude(order_type=WorkOrder.OrderType.SERVICE)
        queryset = queryset.filter(Q(technician=request.user) | Q(supporting_technicians=request.user)).distinct()
    elif role == AccountProfile.Role.SUPERVISOR:
        queryset = queryset.exclude(order_type=WorkOrder.OrderType.SERVICE)
        queryset = queryset.filter(supervisor=request.user)
    return queryset


class WorkOrderListCreateView(generics.ListCreateAPIView):
    serializer_class = WorkOrderSerializer

    def get_permissions(self):
        return [IsAdministrator()] if self.request.method == "POST" else [IsWorkOrderParticipant()]

    def get_queryset(self):
        return participant_queryset(self.request)


class WorkOrderDetailView(generics.RetrieveAPIView):
    permission_classes = [IsWorkOrderParticipant]
    serializer_class = WorkOrderSerializer

    def get_queryset(self):
        return participant_queryset(self.request)


class WorkOrderActionView(views.APIView):
    permission_classes = [IsWorkOrderParticipant]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    @extend_schema(
        request=WorkOrderActionSerializer,
        responses={200: WorkOrderSerializer},
    )
    def post(self, request, pk):
        serializer = WorkOrderActionSerializer(
            data=request.data, context={"request": request, "pk": pk}
        )
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        return response.Response(WorkOrderSerializer(order, context={"request": request}).data)


class WorkOrderPhotoView(views.APIView):
    permission_classes = [IsWorkOrderParticipant]

    @extend_schema(responses={(200, "image/*"): OpenApiTypes.BINARY})
    def get(self, request, pk, stage):
        normalized_stage = {
            "inicio": WorkOrderPhoto.Stage.START,
            "final": WorkOrderPhoto.Stage.FINISH,
        }.get(stage.lower())
        if not normalized_stage:
            from rest_framework.exceptions import NotFound
            raise NotFound("Etapa de evidencia no válida.")
        order = get_object_or_404(participant_queryset(request), pk=pk)
        photo = get_object_or_404(
            WorkOrderPhoto.objects.select_related("work_order"),
            work_order=order,
            stage=normalized_stage,
        )
        content_type = mimetypes.guess_type(photo.image.name)[0] or "application/octet-stream"
        file_response = FileResponse(photo.image.open("rb"), content_type=content_type)
        file_response["Cache-Control"] = "private, max-age=300"
        file_response["X-Content-Type-Options"] = "nosniff"
        file_response["Content-Security-Policy"] = "default-src 'none'; sandbox"
        file_response["Referrer-Policy"] = "no-referrer"
        return file_response


class WorkOrderCostListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAdministrator]
    serializer_class = WorkOrderCostSerializer

    def get_queryset(self):
        return WorkOrder.objects.get(pk=self.kwargs["pk"]).cost_items.all()

    def perform_create(self, serializer):
        order = get_object_or_404(WorkOrder, pk=self.kwargs["pk"])
        serializer.save(work_order=order, created_by=self.request.user)


class WorkOrderReportView(APIView):
    permission_classes = [IsAdministrator]

    def get_order(self, pk):
        return get_object_or_404(
            WorkOrder.objects.select_related("incident__asset", "technician", "satisfaction").prefetch_related(
                "supporting_technicians", "cost_items", "traceability_photos"
            ),
            pk=pk,
        )

    @extend_schema(
        request=None,
        responses={
            200: WorkOrderReportResponseSerializer(many=True),
            201: WorkOrderReportResponseSerializer,
        },
    )
    def post(self, request, pk):
        order = self.get_order(pk)
        content = build_work_order_pdf(order).read()
        report = WorkOrderReport(work_order=order, generated_by=request.user, status=WorkOrderReport.Status.ISSUED, content_hash=hashlib.sha256(content).hexdigest())
        report.file.save(f"informe-{order.code}.pdf", ContentFile(content), save=True)
        return response.Response({"id": str(report.id), "createdAt": report.created_at, "downloadPath": f"/work-orders/{order.id}/reports/{report.id}/"}, status=201)

    @extend_schema(responses={200: WorkOrderReportResponseSerializer(many=True)})
    def get(self, request, pk):
        order = self.get_order(pk)
        reports = order.generated_reports.all()
        return response.Response([{"id": str(item.id), "createdAt": item.created_at, "downloadPath": f"/work-orders/{order.id}/reports/{item.id}/"} for item in reports])


class WorkOrderReportDownloadView(APIView):
    permission_classes = [IsAdministrator]

    @extend_schema(responses={(200, "application/pdf"): OpenApiTypes.BINARY})
    def get(self, request, pk, report_id):
        report = get_object_or_404(WorkOrderReport, pk=report_id, work_order_id=pk)
        return FileResponse(report.file.open("rb"), content_type="application/pdf", as_attachment=True, filename=report.file.name.rsplit("/", 1)[-1])


class ReportTemplateListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAdministrator]
    serializer_class = ReportTemplateSerializer
    queryset = ReportTemplate.objects.all()
    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class ReportTemplateDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAdministrator]
    serializer_class = ReportTemplateSerializer
    queryset = ReportTemplate.objects.all()


class WorkOrderMaterialListCreateView(generics.ListCreateAPIView):
    """
    GET: lista los WorkOrderMaterial de una OT (técnico asignado y admins).
    POST: el técnico registra un nuevo material, validando stock.
    """
    permission_classes = [IsWorkOrderParticipant]

    def get_serializer_class(self):
        if self.request.method == "POST":
            return WorkOrderMaterialWriteSerializer
        return WorkOrderMaterialSerializer

    def get_queryset(self):
        order = get_object_or_404(participant_queryset(self.request), pk=self.kwargs["pk"])
        return order.materiales_usados.select_related("material", "registrado_por")

    def perform_create(self, serializer):
        order = get_object_or_404(participant_queryset(self.request), pk=self.kwargs["pk"])
        if order.status == WorkOrder.Status.CLOSED:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("No se pueden agregar materiales a una OT cerrada.")
        instance = WorkOrderMaterial.objects.create(
            work_order=order,
            material=serializer.validated_data["material"],
            cantidad=serializer.validated_data["cantidad"],
            tipo=serializer.validated_data["tipo"],
            porcentaje_requerido=serializer.validated_data.get("porcentaje_requerido"),
            registrado_por=self.request.user,
        )
        return instance

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        instance = self.perform_create(serializer)
        out = WorkOrderMaterialSerializer(instance)
        from rest_framework import status as http_status
        return response.Response(out.data, status=http_status.HTTP_201_CREATED)


class WorkOrderMaterialDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    GET: detalle de un WorkOrderMaterial.
    PATCH: edita cantidad/tipo mientras la OT no esté cerrada.
    DELETE: borra mientras la OT no esté cerrada.
    Solo el técnico asignado o admin.
    """
    permission_classes = [IsWorkOrderParticipant]
    lookup_field = "id"
    lookup_url_kwarg = "material_id"

    def get_serializer_class(self):
        if self.request.method in ("PUT", "PATCH"):
            return WorkOrderMaterialWriteSerializer
        return WorkOrderMaterialSerializer

    def get_queryset(self):
        return WorkOrderMaterial.objects.select_related(
            "work_order", "material", "registrado_por"
        )

    def _check_not_closed(self, instance):
        if instance.work_order.status == WorkOrder.Status.CLOSED:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("No se puede modificar un material de una OT cerrada.")

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        self._check_not_closed(instance)
        serializer = self.get_serializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        instance.material = data.get("material", instance.material)
        instance.cantidad = data.get("cantidad", instance.cantidad)
        instance.tipo = data.get("tipo", instance.tipo)
        if "porcentaje_requerido" in data:
            instance.porcentaje_requerido = data["porcentaje_requerido"]
        instance.save()
        return response.Response(WorkOrderMaterialSerializer(instance).data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self._check_not_closed(instance)
        instance.delete()
        from rest_framework import status as http_status
        return response.Response(status=http_status.HTTP_204_NO_CONTENT)


class WorkOrderMaterialMarkBlockingView(views.APIView):
    """
    POST: marca un WorkOrderMaterial de tipo NECESARIO_NO_BLOQUEANTE
    como es_bloqueante=True y dispara notificación a administradores.
    """
    permission_classes = [IsWorkOrderParticipant]

    @extend_schema(request=None, responses={200: WorkOrderMaterialSerializer})
    def post(self, request, pk, material_id):
        from apps.notifications.services import queue_for_administrators
        instance = get_object_or_404(
            WorkOrderMaterial.objects.select_related("work_order", "material", "registrado_por"),
            pk=material_id,
            work_order_id=pk,
        )
        if instance.work_order.status == WorkOrder.Status.CLOSED:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied("La OT ya está cerrada.")
        if instance.tipo != WorkOrderMaterial.Tipo.NECESARIO_NO_BLOQUEANTE:
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Solo materiales de tipo 'NECESARIO_NO_BLOQUEANTE' pueden marcarse como bloqueantes.")
        instance.es_bloqueante = True
        instance.save(update_fields=("es_bloqueante", "actualizado_en"))
        technician_name = request.user.get_full_name() or request.user.username
        queue_for_administrators(
            event="MATERIAL_BLOQUEANTE",
            subject=f"Material urgente en {instance.work_order.code}",
            body=(
                f"El técnico {technician_name} no puede continuar la OT {instance.work_order.code} "
                f"sin el material '{instance.material.nombre}' (cantidad: {instance.cantidad}). "
                "Gestiona el suministro a la brevedad."
            ),
            entity=instance.work_order,
            discriminator=f"bloqueante:{instance.id}",
        )
        return response.Response(WorkOrderMaterialSerializer(instance).data)


class WorkOrderMaterialMarkAcquiredView(views.APIView):
    """
    PATCH: el administrador confirma que un material bloqueante ya fue
    adquirido. Notifica al técnico que registró el material (puede
    continuar) y a todos los usuarios con rol ALMACENERO (deben recibir
    y despachar la compra a ese técnico/OT).
    """
    permission_classes = [IsAdministrator]

    @extend_schema(request=None, responses={200: WorkOrderMaterialSerializer})
    def patch(self, request, pk, material_id):
        from django.utils import timezone
        from apps.notifications.services import queue_notification, queue_for_roles
        from rest_framework.exceptions import ValidationError

        instance = get_object_or_404(
            WorkOrderMaterial.objects.select_related("work_order", "material", "registrado_por"),
            pk=material_id,
            work_order_id=pk,
        )
        if not instance.es_bloqueante:
            raise ValidationError("Este material no está marcado como bloqueante.")
        if instance.adquirido:
            raise ValidationError("Este material ya fue marcado como adquirido.")

        instance.adquirido = True
        instance.adquirido_en = timezone.now()
        instance.save(update_fields=("adquirido", "adquirido_en", "actualizado_en"))

        queue_notification(
            event="MATERIAL_ADQUIRIDO",
            recipient=instance.registrado_por,
            subject=f"Material listo en {instance.work_order.code}",
            body=(
                f"El material '{instance.material.nombre}' que necesitabas para la OT "
                f"{instance.work_order.code} ya fue adquirido. Puedes continuar el trabajo."
            ),
            entity=instance.work_order,
            discriminator=f"adquirido-tecnico:{instance.id}",
        )
        queue_for_roles(
            event="MATERIAL_ADQUIRIDO",
            roles=[AccountProfile.Role.ALMACENERO],
            subject=f"Nueva compra para despachar — {instance.work_order.code}",
            body=(
                f"Se adquirió '{instance.material.nombre}' (cantidad: {instance.cantidad}) "
                f"para la OT {instance.work_order.code}. Recíbelo y despáchalo al técnico "
                f"{instance.registrado_por.get_full_name() or instance.registrado_por.username}."
            ),
            entity=instance.work_order,
            discriminator=f"adquirido-almacenero:{instance.id}",
        )
        return response.Response(WorkOrderMaterialSerializer(instance).data)


class WorkOrderCostAutocompletarView(views.APIView):
    """
    POST: genera WorkOrderCost de categoría MATERIAL
    para cada WorkOrderMaterial de tipo USADO en la OT.
    Idempotente: no duplica si ya existe un costo con la misma descripción + categoría MATERIAL.
    """
    permission_classes = [IsAdministrator]

    @extend_schema(request=None, responses={200: WorkOrderCostSerializer(many=True), 201: WorkOrderCostSerializer(many=True)})
    def post(self, request, pk):
        order = get_object_or_404(WorkOrder, pk=pk)
        materiales_usados = order.materiales_usados.filter(
            tipo=WorkOrderMaterial.Tipo.USADO
        ).select_related("material")
        created = []
        for uso in materiales_usados:
            # idempotencia: evitar duplicados por nombre
            existe = order.cost_items.filter(
                category=WorkOrderCost.Category.MATERIAL,
                description=uso.material.nombre,
            ).exists()
            if not existe:
                cost = WorkOrderCost.objects.create(
                    work_order=order,
                    category=WorkOrderCost.Category.MATERIAL,
                    description=uso.material.nombre,
                    amount=uso.material.precio,  # puede ser None
                    created_by=request.user,
                )
                created.append(cost)
        all_costs = order.cost_items.all()
        return response.Response(
            WorkOrderCostSerializer(all_costs, many=True).data,
            status=201 if created else 200,
        )


class WorkOrderCostDetailView(generics.RetrieveUpdateDestroyAPIView):
    """
    PATCH: permite al admin editar amount y description de un costo existente.
    No verifica estado de la OT — el amount siempre es editable por el admin.
    DELETE: elimina el costo.
    """
    permission_classes = [IsAdministrator]
    serializer_class = WorkOrderCostUpdateSerializer

    def get_queryset(self):
        return WorkOrderCost.objects.filter(work_order_id=self.kwargs["pk"])

    def get_object(self):
        return get_object_or_404(self.get_queryset(), pk=self.kwargs["cost_id"])

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        return response.Response(WorkOrderCostSerializer(instance).data)

    def partial_update(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = WorkOrderCostUpdateSerializer(instance, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return response.Response(WorkOrderCostSerializer(instance).data)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        from rest_framework import status as http_status
        return response.Response(status=http_status.HTTP_204_NO_CONTENT)
