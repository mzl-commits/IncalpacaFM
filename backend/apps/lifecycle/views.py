from rest_framework import generics, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import AccountProfile
from apps.accounts.permissions import IsAdministrator, IsTechnicianOrAdministrator, user_role
from apps.workorders.models import WorkOrder

from .models import RetirementRequest, TechnicalDiagnosis
from .serializers import RetirementRequestSerializer, TechnicalDiagnosisSerializer


def technician_diagnosis_queryset(request):
    queryset = TechnicalDiagnosis.objects.select_related("asset")
    if user_role(request.user) == AccountProfile.Role.TECHNICIAN:
        order_ids = WorkOrder.objects.filter(technician=request.user).values_list("id", flat=True)
        queryset = queryset.filter(work_order_id__in=[str(order_id) for order_id in order_ids])
    return queryset


class DiagnosisListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsTechnicianOrAdministrator]
    serializer_class = TechnicalDiagnosisSerializer
    def get_queryset(self):
        return technician_diagnosis_queryset(self.request)

    def perform_create(self, serializer):
        if user_role(self.request.user) == AccountProfile.Role.TECHNICIAN:
            order = WorkOrder.objects.filter(
                pk=serializer.validated_data["work_order_id"],
                technician=self.request.user,
            ).select_related("incident__asset").first()
            if not order or order.incident.asset_id != serializer.validated_data["asset"].id:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Solo puedes diagnosticar el bien asociado a tu orden asignada.")
        serializer.save()


class DiagnosisDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsTechnicianOrAdministrator]
    serializer_class = TechnicalDiagnosisSerializer
    def get_queryset(self):
        return technician_diagnosis_queryset(self.request)


class RetirementEvaluationRequestView(APIView):
    permission_classes = [IsTechnicianOrAdministrator]

    def post(self, request, pk):
        diagnosis = technician_diagnosis_queryset(request).filter(pk=pk).first()
        if not diagnosis:
            from rest_framework.exceptions import NotFound
            raise NotFound("No se encontró el diagnóstico solicitado.")
        existing = RetirementRequest.objects.select_related("asset", "diagnosis").filter(
            diagnosis=diagnosis,
        ).first()
        if existing:
            return Response(RetirementRequestSerializer(existing).data)

        if diagnosis.result not in {
            TechnicalDiagnosis.Result.NOT_REPAIRABLE,
            TechnicalDiagnosis.Result.NOT_VIABLE,
        } or not diagnosis.evidence or len(diagnosis.technical_justification.strip()) < 20:
            return Response(
                {"detail": "El diagnóstico no reúne el sustento para solicitar una evaluación de baja."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        work_order = WorkOrder.objects.filter(pk=diagnosis.work_order_id).select_related("supervisor").first()
        serializer = RetirementRequestSerializer(
            data={
                "asset": str(diagnosis.asset_id),
                "diagnosis": str(diagnosis.id),
                "recommendation": RetirementRequest.Method.PENDING,
                "requested_by": request.user.get_full_name() or request.user.username,
                "supervisor_name": (
                    work_order.supervisor.get_full_name() or work_order.supervisor.username
                    if work_order else "Por asignar"
                ),
            },
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        created = serializer.save()
        return Response(RetirementRequestSerializer(created).data, status=status.HTTP_201_CREATED)


class RetirementListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAdministrator]
    serializer_class = RetirementRequestSerializer
    queryset = RetirementRequest.objects.select_related("asset", "diagnosis")


class RetirementDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAdministrator]
    serializer_class = RetirementRequestSerializer
    queryset = RetirementRequest.objects.select_related("asset", "diagnosis")
