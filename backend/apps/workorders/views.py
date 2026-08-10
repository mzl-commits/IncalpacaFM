import mimetypes

import hashlib
from django.core.files.base import ContentFile
from django.db.models import Q
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import extend_schema
from rest_framework import generics, response, views
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.views import APIView

from apps.accounts.models import AccountProfile
from apps.accounts.permissions import IsAdministrator, IsWorkOrderParticipant, user_role

from .models import ReportTemplate, WorkOrder, WorkOrderPhoto, WorkOrderReport
from .reporting import build_work_order_pdf
from .serializers import ReportTemplateSerializer, WorkOrderActionSerializer, WorkOrderCostSerializer, WorkOrderSerializer


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

    def post(self, request, pk):
        order = self.get_order(pk)
        content = build_work_order_pdf(order).read()
        report = WorkOrderReport(work_order=order, generated_by=request.user, status=WorkOrderReport.Status.ISSUED, content_hash=hashlib.sha256(content).hexdigest())
        report.file.save(f"informe-{order.code}.pdf", ContentFile(content), save=True)
        return response.Response({"id": str(report.id), "createdAt": report.created_at, "downloadPath": f"/work-orders/{order.id}/reports/{report.id}/"}, status=201)

    def get(self, request, pk):
        order = self.get_order(pk)
        reports = order.generated_reports.all()
        return response.Response([{"id": str(item.id), "createdAt": item.created_at, "downloadPath": f"/work-orders/{order.id}/reports/{item.id}/"} for item in reports])


class WorkOrderReportDownloadView(APIView):
    permission_classes = [IsAdministrator]

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
