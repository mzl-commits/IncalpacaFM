import uuid

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from apps.accounts.models import AccountProfile
from apps.assets.file_validation import validate_uploaded_file
from apps.audit.services import record_audit
from apps.incidents.models import Incident
from apps.notifications.services import (
    queue_for_administrators,
    queue_incident_requester,
    queue_notification,
)
from apps.notifications.monitoring import queue_work_order_alerts
from apps.privacy.services import record_privacy_event

from .models import ReportTemplate, WorkOrder, WorkOrderCost, WorkOrderPhoto


def active_work_session(order):
    for session in reversed(order.work_sessions or []):
        if not session.get("endAt"):
            return session
    return None


def effective_work_minutes(order):
    total_seconds = 0
    now = timezone.now()
    for session in order.work_sessions or []:
        start = parse_datetime(session.get("startAt") or "")
        end = parse_datetime(session.get("endAt") or "") if session.get("endAt") else now
        if start and end and end >= start:
            total_seconds += (end - start).total_seconds()
    return round(total_seconds / 60)

class WorkOrderSerializer(serializers.ModelSerializer):
    requestId = serializers.UUIDField(source="incident_id")
    requestCode = serializers.CharField(source="incident.code", read_only=True)
    assetId = serializers.SerializerMethodField()
    assetCode = serializers.SerializerMethodField()
    assetDisplayCode = serializers.SerializerMethodField()
    operatorId = serializers.CharField(source="technician.account_profile.id", read_only=True)
    operatorName = serializers.SerializerMethodField()
    supervisorId = serializers.CharField(source="supervisor.account_profile.id", read_only=True)
    supervisorName = serializers.SerializerMethodField()
    adminPriority = serializers.CharField(source="admin_priority")
    scheduledDate = serializers.DateField(source="scheduled_date")
    scheduledStartTime = serializers.TimeField(source="scheduled_start_time", required=False)
    plannedHours = serializers.IntegerField(source="planned_hours", min_value=1, max_value=16)
    startedAt = serializers.DateTimeField(source="started_at", read_only=True)
    finishedAt = serializers.DateTimeField(source="finished_at", read_only=True)
    closedAt = serializers.DateTimeField(source="closed_at", read_only=True)
    administratorNotes = serializers.CharField(
        source="administrator_notes", required=False, allow_blank=True
    )
    progressPercentage = serializers.IntegerField(source="progress_percentage", read_only=True)
    workSessions = serializers.JSONField(source="work_sessions", read_only=True)
    effectiveWorkMinutes = serializers.SerializerMethodField()
    activeWorkSession = serializers.SerializerMethodField()
    satisfaction = serializers.SerializerMethodField()
    startPhoto = serializers.SerializerMethodField()
    finishPhoto = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    technicianWorkerCode = serializers.CharField(write_only=True, required=False)
    technicianWorkerCodes = serializers.ListField(child=serializers.CharField(), write_only=True, required=False)
    supervisorWorkerCode = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = WorkOrder
        fields = (
            "id",
            "code",
            "requestId",
            "requestCode",
            "assetId",
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
            "scheduledStartTime",
            "plannedHours",
            "startedAt",
            "finishedAt",
            "closedAt",
            "administratorNotes",
            "progressPercentage",
            "advances",
            "workSessions",
            "effectiveWorkMinutes",
            "activeWorkSession",
            "satisfaction",
            "startPhoto",
            "finishPhoto",
            "diagnosis",
            "supervisor_validation",
            "administrator_validation",
            "conformity",
            "recommendation_snapshot",
            "technicianWorkerCode",
            "technicianWorkerCodes",
            "supervisorWorkerCode",
            "createdAt",
            "updatedAt",
        )
        read_only_fields = ("id", "code", "status", "advances", "workSessions")

    def get_effectiveWorkMinutes(self, obj) -> int:
        return effective_work_minutes(obj)

    def get_activeWorkSession(self, obj):
        return active_work_session(obj)

    def get_satisfaction(self, obj):
        request = self.context.get("request")
        if not request or getattr(request.user.account_profile, "role", None) != AccountProfile.Role.ADMIN:
            return None
        satisfaction = getattr(obj, "satisfaction", None)
        if not satisfaction:
            return None
        return {
            "accepted": satisfaction.accepted,
            "rating": satisfaction.rating,
            "comment": satisfaction.comment,
            "submittedAt": satisfaction.submitted_at,
        }

    def _traceability_photo_url(self, obj, stage):
        photo = next((item for item in obj.traceability_photos.all() if item.stage == stage), None)
        if not photo:
            return None
        request = self.context.get("request")
        path = f"/api/v1/work-orders/{obj.id}/photos/{stage.lower()}/"
        return request.build_absolute_uri(path) if request else path

    def get_startPhoto(self, obj):
        return self._traceability_photo_url(obj, WorkOrderPhoto.Stage.START)

    def get_finishPhoto(self, obj):
        return self._traceability_photo_url(obj, WorkOrderPhoto.Stage.FINISH)

    def get_operatorName(self, obj) -> str:
        return obj.technician.get_full_name() or obj.technician.username

    def get_assetCode(self, obj) -> str | None:
        return obj.incident.asset.code if obj.incident.asset else None

    def get_assetId(self, obj) -> str | None:
        return str(obj.incident.asset_id) if obj.incident.asset_id else None

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
        technician_codes = validated_data.pop("technicianWorkerCodes", [])
        supervisor_code = validated_data.pop("supervisorWorkerCode", "supervisor")
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
        if technician_codes:
            order.supporting_technicians.set(
                users.filter(
                    account_profile__worker_code__in=technician_codes,
                    account_profile__role=AccountProfile.Role.TECHNICIAN,
                ).exclude(pk=technician.pk)
            )
            for collaborator in order.supporting_technicians.all():
                queue_notification(
                    event='WORK_ORDER_ASSIGNED', recipient=collaborator,
                    subject=f'Orden compartida {order.code}',
                    body=f'Participas como técnico de apoyo en la orden {order.code}. Revisa tu agenda y la trazabilidad.',
                    entity=order, discriminator=f'support:{collaborator.id}',
                )
        incident.status = Incident.Status.IN_PROGRESS
        incident.save(update_fields=("status", "updated_at"))
        queue_work_order_alerts(order)
        record_audit(
            request=request,
            action="WORK_ORDER_CREATED",
            entity="WorkOrder",
            entity_id=order.id,
            after={"code": order.code, "technician": technician_code},
        )
        queue_notification(
            event='WORK_ORDER_ASSIGNED',
            recipient=technician,
            subject=f'Orden asignada {order.code}',
            body=(
                f'Tienes asignada la orden {order.code} para el bien '
                f'{incident.asset.fm_code or incident.asset.code if incident.asset else "sin bien asociado"}.'
            ),
            entity=order,
            discriminator=str(technician.id),
        )
        queue_for_administrators(
            event='WORK_ORDER_ASSIGNED',
            subject=f'Orden creada {order.code}',
            body=f'La orden {order.code} fue asignada y está lista para atención.',
            entity=order,
            discriminator='planner',
        )
        queue_incident_requester(
            event='INCIDENT_REVIEW_SCHEDULED',
            incident=incident,
            subject=f'Revisión programada para tu reporte {incident.code}',
            body=(
                f'Programamos la revisión de tu reporte {incident.code} para el '
                f'{order.scheduled_date.strftime("%d/%m/%Y")}. '
                'Te avisaremos cuando la revisión haya sido aprobada.'
            ),
            discriminator=order.code,
        )
        return order


class WorkOrderCostSerializer(serializers.ModelSerializer):
    categoryLabel = serializers.CharField(source="get_category_display", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = WorkOrderCost
        fields = ("id", "category", "categoryLabel", "description", "amount", "createdAt")
        read_only_fields = ("id", "createdAt")


class ReportTemplateSerializer(serializers.ModelSerializer):
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    class Meta:
        model = ReportTemplate
        fields = ("id", "name", "scope", "sections", "version", "variables", "content_hash", "status", "is_active", "createdAt", "updatedAt")
        read_only_fields = ("id", "createdAt", "updatedAt")


class WorkOrderActionSerializer(serializers.Serializer):
    action = serializers.ChoiceField(
        choices=(
            "START",
            "PAUSE",
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
    workedMinutes = serializers.IntegerField(required=False, min_value=0, max_value=720)
    observation = serializers.CharField(required=False, allow_blank=True)
    evidence = serializers.ListField(required=False, default=list)
    startPhoto = serializers.ImageField(required=False, write_only=True)
    finishPhoto = serializers.ImageField(required=False, write_only=True)
    payload = serializers.DictField(required=False, default=dict)

    def validate_photo(self, value):
        validate_uploaded_file(value)
        if value.size > 8 * 1024 * 1024:
            raise serializers.ValidationError("La fotografía no puede superar 8 MB.")
        if value.image.format not in {"JPEG", "PNG", "WEBP"}:
            raise serializers.ValidationError("Usa una imagen JPG, PNG o WEBP.")
        width, height = value.image.size
        if width < 320 or height < 240:
            raise serializers.ValidationError("La fotografía debe tener al menos 320 × 240 px.")
        return value

    def validate_startPhoto(self, value):
        return self.validate_photo(value)

    def validate_finishPhoto(self, value):
        return self.validate_photo(value)

    @transaction.atomic
    def save(self, **kwargs):
        request = self.context["request"]
        order = WorkOrder.objects.select_for_update().get(pk=self.context["pk"])
        action = self.validated_data["action"]
        now = timezone.now()
        before = {"status": order.status, "progress": order.progress_percentage}

        role = getattr(request.user.account_profile, 'role', None)
        technical_actions = {'START', 'PAUSE', 'PROGRESS', 'DIAGNOSIS'}
        if role == AccountProfile.Role.TECHNICIAN:
            if order.technician_id != request.user.id and not order.supporting_technicians.filter(pk=request.user.id).exists():
                raise PermissionDenied('Solo los técnicos asignados pueden actualizar esta orden.')
            if action not in technical_actions:
                raise PermissionDenied('Esta accion corresponde a la validación administrativa.')
        elif role == AccountProfile.Role.SUPERVISOR:
            if order.supervisor_id != request.user.id:
                raise PermissionDenied('Solo el supervisor asignado puede revisar está orden.')
            if action not in {'SUPERVISOR_APPROVE', 'SUPERVISOR_RETURN'}:
                raise PermissionDenied('Esta accion corresponde al administrador o al operario.')
        expected_statuses = {
            'START': {WorkOrder.Status.SCHEDULED, WorkOrder.Status.RETURNED, WorkOrder.Status.IN_PROGRESS},
            'PAUSE': {WorkOrder.Status.IN_PROGRESS},
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
            if active_work_session(order):
                raise serializers.ValidationError({
                    'action': 'Ya hay una sesión de trabajo activa.'
                })
            order.status = WorkOrder.Status.IN_PROGRESS
            order.started_at = order.started_at or now
            order.work_sessions = [
                *(order.work_sessions or []),
                {
                    "id": str(uuid.uuid4()),
                    "startAt": now.isoformat(),
                    "endAt": None,
                    "operatorName": request.user.get_full_name() or request.user.username,
                },
            ]
            start_photo = self.validated_data.get("startPhoto")
            if not WorkOrderPhoto.objects.filter(work_order=order, stage=WorkOrderPhoto.Stage.START).exists():
                if not start_photo:
                    raise serializers.ValidationError({"startPhoto": "Adjunta la foto de inicio antes de comenzar la orden."})
                WorkOrderPhoto.objects.create(
                    work_order=order,
                    stage=WorkOrderPhoto.Stage.START,
                    image=start_photo,
                    uploaded_by=request.user,
                )
                record_privacy_event(request=request, context="EVIDENCIA", subject_reference=order.code)
        elif action == "PAUSE":
            session = active_work_session(order)
            if not session:
                raise serializers.ValidationError({
                    'action': 'No hay una sesión activa para pausar.'
                })
            order.work_sessions = [
                {
                    **item,
                    "endAt": now.isoformat() if item.get("id") == session.get("id") else item.get("endAt"),
                }
                for item in (order.work_sessions or [])
            ]
        elif action == "PROGRESS":
            session = active_work_session(order)
            if not session:
                raise serializers.ValidationError({
                    'action': 'Reanuda el trabajo antes de registrar avance.'
                })
            percentage = self.validated_data.get("percentage", 0)
            if percentage <= order.progress_percentage:
                raise serializers.ValidationError({
                    'percentage': f'El avance debe ser mayor al {order.progress_percentage} % registrado.'
                })
            order.advances = [
                *order.advances,
                {
                    "id": str(uuid.uuid4()),
                    "operatorId": str(request.user.account_profile.id),
                    "operatorName": request.user.get_full_name() or request.user.username,
                    "percentage": percentage,
                    "workedMinutes": self.validated_data.get("workedMinutes", 0),
                    "observation": self.validated_data.get("observation", ""),
                    "evidence": self.validated_data.get("evidence", []),
                    "createdAt": now.isoformat(),
                },
            ]
            order.progress_percentage = percentage
            order.started_at = order.started_at or now
            if percentage == 100:
                finish_photo = self.validated_data.get("finishPhoto")
                if not WorkOrderPhoto.objects.filter(work_order=order, stage=WorkOrderPhoto.Stage.FINISH).exists():
                    if not finish_photo:
                        raise serializers.ValidationError({"finishPhoto": "Adjunta la foto final antes de enviar la orden a supervisión."})
                    WorkOrderPhoto.objects.create(
                        work_order=order,
                        stage=WorkOrderPhoto.Stage.FINISH,
                        image=finish_photo,
                        uploaded_by=request.user,
                    )
                    record_privacy_event(request=request, context="EVIDENCIA", subject_reference=order.code)
                order.work_sessions = [
                    {
                        **item,
                        "endAt": now.isoformat() if item.get("id") == session.get("id") else item.get("endAt"),
                    }
                    for item in (order.work_sessions or [])
                ]
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
        if action == 'PROGRESS' and order.status == WorkOrder.Status.SUPERVISION:
            queue_notification(
                event='REPAIR_FINISHED',
                recipient=order.supervisor,
                subject=f'Revisión requerida para {order.code}',
                body=(
                    f'El técnico marcó como finalizado el trabajo de la orden {order.code}. '
                    'Revisa el resultado y las evidencias.'
                ),
                entity=order,
                discriminator='finished',
            )
        elif action.startswith('SUPERVISOR_'):
            outcome = 'aprobó' if action.endswith('APPROVE') else 'devolvió'
            queue_notification(
                event='SUPERVISOR_REVIEW',
                recipient=order.technician,
                subject=f'Revisión de supervisor para {order.code}',
                body=f'El supervisor {outcome} la orden {order.code}.',
                entity=order,
                discriminator=action,
            )
            queue_for_administrators(
                event='SUPERVISOR_REVIEW',
                subject=f'Revisión registrada para {order.code}',
                body=f'El supervisor {outcome} la orden {order.code}.',
                entity=order,
                discriminator=action,
            )
        elif action == 'ADMIN_APPROVE':
            queue_incident_requester(
                event='INCIDENT_SERVICE_DELIVERED',
                incident=order.incident,
                subject=f'Tu atención está lista · {order.incident.code}',
                body=(
                    f'La atención de tu reporte {order.incident.code} está lista para entrega o uso. '
                    f'Confirma el resultado y califica el servicio en '
                    f'{settings.PUBLIC_FRONTEND_URL}/seguimiento-solicitud/{order.incident.code}.'
                ),
                discriminator=order.code,
            )
        elif action == 'CONFORM':
            queue_incident_requester(
                event='ASSET_SERVICE_READY',
                incident=order.incident,
                subject=f'Tu bien ya está listo · {order.incident.code}',
                body=(
                    f'La atención de tu reporte {order.incident.code} finalizó. '
                    'El bien ya está listo para su uso o entrega según la coordinación de Facility Management.'
                ),
                discriminator=order.code,
            )
        record_audit(
            request=request,
            action=f"WORK_ORDER_{action}",
            entity="WorkOrder",
            entity_id=order.id,
            before=before,
            after={"status": order.status, "progress": order.progress_percentage},
        )
        return order
