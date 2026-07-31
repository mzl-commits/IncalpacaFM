from rest_framework import generics, response, status
from rest_framework.permissions import AllowAny

from apps.accounts.models import AccountProfile
from apps.accounts.permissions import IsAuthenticatedReadAdministratorWrite, user_role

from .models import Incident
from .serializers import IncidentSerializer, PublicIncidentSerializer


class IncidentListCreateView(generics.ListCreateAPIView):
    serializer_class = IncidentSerializer

    def get_queryset(self):
        queryset = Incident.objects.select_related("requester", "asset")
        if user_role(self.request.user) == AccountProfile.Role.REQUESTER:
            queryset = queryset.filter(requester=self.request.user)
        return queryset


class IncidentDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticatedReadAdministratorWrite]
    serializer_class = IncidentSerializer
    queryset = Incident.objects.select_related("requester", "asset")


class PublicIncidentCreateView(generics.CreateAPIView):
    permission_classes = [AllowAny]
    serializer_class = PublicIncidentSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        incident = serializer.save()
        return response.Response(IncidentSerializer(incident).data, status=status.HTTP_201_CREATED)
