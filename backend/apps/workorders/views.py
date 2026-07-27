
from rest_framework import generics, response, views

from apps.accounts.models import AccountProfile
from apps.accounts.permissions import IsAdministrator, IsTechnicianOrAdministrator, user_role

from .models import WorkOrder
from .serializers import WorkOrderActionSerializer, WorkOrderSerializer


class WorkOrderListCreateView(generics.ListCreateAPIView):
    serializer_class = WorkOrderSerializer

    def get_permissions(self):
        return [IsAdministrator()] if self.request.method == "POST" else [IsTechnicianOrAdministrator()]

    def get_queryset(self):
        queryset = WorkOrder.objects.select_related(
            "incident", "technician", "technician__account_profile", "supervisor",
            "supervisor__account_profile",
        )
        if user_role(self.request.user) == AccountProfile.Role.TECHNICIAN:
            queryset = queryset.filter(technician=self.request.user)
        return queryset


class WorkOrderDetailView(generics.RetrieveAPIView):
    permission_classes = [IsTechnicianOrAdministrator]
    serializer_class = WorkOrderSerializer
    queryset = WorkOrder.objects.select_related(
        "incident", "technician", "technician__account_profile", "supervisor",
        "supervisor__account_profile",
    )


class WorkOrderActionView(views.APIView):
    permission_classes = [IsTechnicianOrAdministrator]

    def post(self, request, pk):
        serializer = WorkOrderActionSerializer(
            data=request.data, context={"request": request, "pk": pk}
        )
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        return response.Response(WorkOrderSerializer(order).data)
