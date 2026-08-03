import uuid

from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from apps.accounts.models import AccountProfile
from apps.audit.services import record_audit
from apps.incidents.models import Incident

from .models import WorkOrder


class WorkOrderSerializer(serializers.ModelSerializer):
    requestId = serializers.UUIDField(source="incident_id")
    requestCode = serializers.CharField(source="incident.code", read_only=True)
    assetCode = serializers.SerializerMethodField()
    assetDisplayCode = serializers.SerializerMethodField()
    operatorId = serializers.CharField(source="technician.account_profile.id", read_only=True)
    operatorName = serializers.SerializerMethodField()
    supervisorId = serializers.CharField(source="supervisor.account_profile.id", read_only=True)
    supervisorName = serializers.SerializerMethodField()
    adminPriority = serializers.CharField(source="admin_priority")
    scheduledDate = serializers.DateField(source="scheduled_date")
    startedAt = serializers.DateTimeField(source="started_at", read_only=True)
    finishedAt = serializers.DateTimeField(source="finished_at", read_only=True)
    closedAt = serializers.DateTimeField(source="closed_at", read_only=True)
    administratorNotes = serializers.CharField(
        source="administrator_notes", required=False, allow_blank=True
    )
    progressPercentage = serializers.IntegerField(source="progress_percentage", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    technicianWorkerCode = serializers.CharField(write_only=True, required=False)
    supervisorWorkerCode = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = WorkOrder
        fields = (
            "id",
            "code",
            "requestId",
            "requestCode",
            "assetCode",
            "assetDisplayCode",
            "operatorId",
            "operatorName",
            "supervisorId",
            "supervisorName",
            "specialty",
            "adminPriority",
            "status",
            "scheduledDate",
            "startedAt",
            "finishedAt",
            "closedAt",
            "administratorNotes",
            "progressPercentage",
            "advances",
            "diagnosis",
            "supervisor_validation",
            "administrator_validation",
            "conformity",
            "recommendation_snapshot",
            "technicianWorkerCode",
            "supervisorWorkerCode",
            "createdAt",
            "updatedAt",
        )
        read_only_fields = ("id", "code", "status", "advances")

    def get_operatorName(self, obj) -> str:
        return obj.technician.get_full_name() or obj.technician.username

    def get_assetCode(self, obj) -> str | None:
        return obj.incident.asset.code if obj.incident.asset else None

    def get_assetDisplayCode(self, obj) -> str | None:
        asset = obj.incident.asset
        return (asset.fm_code or asset.code) if asset else None

    def get_supervisorName(self, obj) -> str:
        return obj.supervisor.get_full_name() or obj.supervisor.username

    @transaction.atomic
    def create(self, validated_data):
        request = self.context["request"]
        incident_id = validated_data.pop("incident_id")
        technician_code = validated_data.pop("technicianWorkerCode", "tecnico")
        supervisor_code = validated_data.pop("supervisorWorkerCode", "admin")
        users = get_user_model().objects.select_related("account_profile")
        technician = users.get(
            account_profile__worker_code=technician_code,
            account_profile__role=AccountProfile.Role.TECHNICIAN,
        )
        supervisor = users.get(account_profile__worker_code=supervisor_code)
        incident = Incident.objects.select_for_update().get(pk=incident_id)
        sequence = WorkOrder.objects.select_for_update().count() + 1
        order = WorkOrder.objects.create(
            code=f"OT-{timezone.localdate().year}-{sequence:04d}",
            incident=incident,
            technician=technician,
            supervisor=supervisor,
            created_by=request.user,
            recommendation_snapshot={
                "selected": technician_code,
                "score": 100,
                "criteria": [
                    "Especialidad compatible",
                    "Disponible",
                    "Carga dentro del límite",
                ],
                "confirmed_by_administrator": True,
            },
            **validated_data,
        )
        incident.status = Incident.Status.IN_PROGRESS
        incident.save(update_fields=("status", "updated_at"))
        record_audit(
            request=request,
            action="WORK_ORDER_CREATED",
            entity="WorkOrder",
            entity_id=order.id,
            after={"code": order.code, "technician": technician_code},
        )
        return order


class WorkOrderActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(
        choices=(
            "START",
            "PROGRESS",
            "DIAGNOSIS",
            "SUPERVISOR_APPROVE",
            "SUPERVISOR_RETURN",
            "ADMIN_APPROVE",
            "ADMIN_RETURN",
            "CONFORM",
            "REOPEN",
        )
    )
    percentage = serializers.IntegerField(required=False, min_value=0, max_value=100)
    observation = serializers.CharField(required=False, allow_blank=True)
    evidence = serializers.ListField(required=False, default=list)
    payload = serializers.DictField(required=False, default=dict)

    @transaction.atomic
    def save(self, **kwargs):
        request = self.context["request"]
        order = WorkOrder.objects.select_for_update().get(pk=self.context["pk"])
        action = self.validated_data["action"]
        now = timezone.now()
        before = {"status": order.status, "progress": order.progress_percentage}

        role = getattr(request.user.account_profile, 'role', None)
        technical_actions = {'START', 'PROGRESS', 'DIAGNOSIS'}
        if role == AccountProfile.Role.TECHNICIAN:
            if order.technician_id != request.user.id:
                raise PermissionDenied('Solo el tecnico asignado puede actualizar esta orden.')
            if action not in technical_actions:
                raise PermissionDenied('Esta accion corresponde a la validacion administrativa.')

        expected_statuses = {
            'START': {WorkOrder.Status.SCHEDULED, WorkOrder.Status.RETURNED},
            'PROGRESS': {WorkOrder.Status.IN_PROGRESS},
            'SUPERVISOR_APPROVE': {WorkOrder.Status.SUPERVISION},
            'SUPERVISOR_RETURN': {WorkOrder.Status.SUPERVISION},
            'ADMIN_APPROVE': {WorkOrder.Status.ADMIN_REVIEW},
            'ADMIN_RETURN': {WorkOrder.Status.ADMIN_REVIEW},
            'CONFORM': {WorkOrder.Status.CONFORMITY},
            'REOPEN': {WorkOrder.Status.CONFORMITY},
        }
        allowed_statuses = expected_statuses.get(action)
        if allowed_statuses and order.status not in allowed_statuses:
            raise serializers.ValidationError({
                'action': 'La accion no corresponde al estado actual de la orden.'
            })

        if action == "START":
            order.status = WorkOrder.Status.IN_PROGRESS
            order.started_at = order.started_at or now
        elif action == "PROGRESS":
            percentage = self.validated_data.get("percentage", 0)
            order.advances = [
                *order.advances,
                {
                    "id": str(uuid.uuid4()),
                    "operatorId": str(request.user.account_profile.id),
                    "operatorName": request.user.get_full_name() or request.user.username,
                    "percentage": percentage,
                    "observation": self.validated_data.get("observation", ""),
                    "evidence": self.validated_data.get("evidence", []),
                    "createdAt": now.isoformat(),
                },
            ]
            order.progress_percentage = percentage
            order.started_at = order.started_at or now
            if percentage == 100:
                order.status = WorkOrder.Status.SUPERVISION
                order.finished_at = now
            else:
                order.status = WorkOrder.Status.IN_PROGRESS
        elif action == "DIAGNOSIS":
            order.diagnosis = self.validated_data["payload"]
        elif action.startswith("SUPERVISOR_"):
            approved = action.endswith("APPROVE")
            order.supervisor_validation = {
                **self.validated_data["payload"],
                "approved": approved,
                "at": now.isoformat(),
                "by": request.user.get_full_name(),
            }
            order.status = (
                WorkOrder.Status.ADMIN_REVIEW if approved else WorkOrder.Status.RETURNED
            )
        elif action.startswith("ADMIN_"):
            approved = action.endswith("APPROVE")
            order.administrator_validation = {
                **self.validated_data["payload"],
                "approved": approved,
                "at": now.isoformat(),
                "by": request.user.get_full_name(),
            }
            order.status = (
                WorkOrder.Status.CONFORMITY if approved else WorkOrder.Status.RETURNED
            )
        elif action in {"CONFORM", "REOPEN"}:
            accepted = action == "CONFORM"
            order.conformity = {
                **self.validated_data["payload"],
                "accepted": accepted,
                "at": now.isoformat(),
                "by": request.user.get_full_name(),
            }
            order.status = WorkOrder.Status.CLOSED if accepted else WorkOrder.Status.RETURNED
            order.closed_at = now if accepted else None
            if accepted:
                order.incident.status = Incident.Status.CLOSED
                order.incident.save(update_fields=("status", "updated_at"))

        order.save()
        record_audit(
            request=request,
            action=f"WORK_ORDER_{action}",
            entity="WorkOrder",
            entity_id=order.id,
            before=before,
            after={"status": order.status, "progress": order.progress_percentage},
        )
        return order
