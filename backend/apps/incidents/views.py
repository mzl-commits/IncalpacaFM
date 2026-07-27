
from rest_framework import generics

from apps.accounts.models import AccountProfile
from apps.accounts.permissions import IsAuthenticatedReadAdministratorWrite, user_role

from .models import Incident
from .serializers import IncidentSerializer


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
