from django.db.models import Q
from drf_spectacular.utils import extend_schema
from rest_framework import generics, response, views

from apps.accounts.models import AccountProfile
from apps.accounts.permissions import IsAdministrator, IsWorkOrderParticipant, user_role

from .models import WorkOrder
from .serializers import WorkOrderActionSerializer, WorkOrderSerializer


def participant_queryset(request):
    queryset = WorkOrder.objects.select_related(
        "incident",
        "incident__asset",
        "technician",
        "technician__account_profile",
        "supervisor",
        "supervisor__account_profile",
        "satisfaction",
    )
    role = user_role(request.user)
    if role == AccountProfile.Role.TECHNICIAN:
        queryset = queryset.filter(Q(technician=request.user) | Q(supporting_technicians=request.user)).distinct()
    elif role == AccountProfile.Role.SUPERVISOR:
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
        return response.Response(WorkOrderSerializer(order).data)
