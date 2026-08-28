import uuid
from datetime import datetime, time, timedelta

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from rest_framework import serializers
from rest_framework.exceptions import PermissionDenied

from apps.accounts.models import AccountProfile
from apps.assets.file_validation import validate_uploaded_file
from apps.assets.models import Asset, Location
from apps.audit.services import record_audit
from apps.incidents.models import Incident
from apps.notifications.services import (
    queue_for_administrators,
    queue_incident_requester,
    queue_notification,
)
from apps.notifications.monitoring import queue_work_order_alerts
from apps.privacy.services import record_privacy_event

from apps.catalogo.models import Material
from .models import ReportTemplate, WorkOrder, WorkOrderCost, WorkOrderMaterial, WorkOrderPhoto


def root_work_order(order):
    current = order
    seen = set()
    while current.correction_of_id and current.correction_of_id not in seen:
        seen.add(current.id)
        current = current.correction_of
    return current


def next_correction_code(order):
    root = root_work_order(order)
    prefix = f"{root.code}-C"
    index = WorkOrder.objects.filter(code__startswith=prefix).count() + 1
    while True:
        code = f"{prefix}{index}"
        if not WorkOrder.objects.filter(code=code).exists():
            return code
        index += 1


def schedule_end(scheduled_date, scheduled_start_time, planned_hours):
    return datetime.combine(scheduled_date, scheduled_start_time) + timedelta(hours=max(1, int(planned_hours or 1)))


def validate_technician_availability(technician, scheduled_date, scheduled_start_time, planned_hours, exclude_order_id=None):
    occupied_statuses = {
        WorkOrder.Status.SCHEDULED,
        WorkOrder.Status.IN_PROGRESS,
        WorkOrder.Status.RETURNED,
    }
    requested_start = datetime.combine(scheduled_date, scheduled_start_time)
    requested_end = schedule_end(scheduled_date, scheduled_start_time, planned_hours)
    queryset = WorkOrder.objects.filter(
        technician=technician,
        scheduled_date=scheduled_date,
        status__in=occupied_statuses,
    ).exclude(order_type=WorkOrder.OrderType.SERVICE)
    if exclude_order_id:
        queryset = queryset.exclude(pk=exclude_order_id)

    for existing in queryset:
        existing_start = datetime.combine(existing.scheduled_date, existing.scheduled_start_time)
        existing_end = schedule_end(existing.scheduled_date, existing.scheduled_start_time, existing.planned_hours)
        if requested_start < existing_end and existing_start < requested_end:
            raise serializers.ValidationError({
                "scheduledStartTime": f"El operario ya tiene la orden {existing.code} en ese horario."
            })


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
    requestId = serializers.UUIDField(source="incident_id", required=False, allow_null=True)
    requestCode = serializers.CharField(source="incident.code", read_only=True)
    orderType = serializers.CharField(source="order_type", required=False)
    directRequestDescription = serializers.CharField(write_only=True, required=False, allow_blank=True)
    directRequestType = serializers.CharField(write_only=True, required=False, allow_blank=True)
    directAssetId = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    directLocationId = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    assetId = serializers.SerializerMethodField()
    assetCode = serializers.SerializerMethodField()
    assetDisplayCode = serializers.SerializerMethodField()
    operatorId = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    operatorName = serializers.SerializerMethodField()
    supervisorId = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    supervisorName = serializers.SerializerMethodField()
    adminPriority = serializers.CharField(source="admin_priority")
    scheduledDate = serializers.DateField(source="scheduled_date")
    scheduledStartTime = serializers.TimeField(source="scheduled_start_time", required=False)
    plannedHours = serializers.FloatField(source="planned_hours", required=False, default=2)
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
    correctionOfId = serializers.SerializerMethodField()
    correctionOfCode = serializers.SerializerMethodField()
    correctionWorkOrderId = serializers.SerializerMethodField()
    correctionWorkOrderCode = serializers.SerializerMethodField()

    class Meta:
        model = WorkOrder
        fields = (
            "id",
            "code",
            "requestId",
            "requestCode",
            "orderType",
            "directRequestDescription",
            "directRequestType",
            "directAssetId",
            "directLocationId",
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
            "correctionOfId",
            "correctionOfCode",
            "correctionWorkOrderId",
            "correctionWorkOrderCode",
            "createdAt",
            "updatedAt",
        )
        read_only_fields = ("id", "code", "status", "advances", "workSessions")

    def _latest_correction_order(self, obj):
        return obj.correction_orders.order_by("-created_at").first()

    def get_correctionOfId(self, obj) -> str | None:
        return str(obj.correction_of_id) if obj.correction_of_id else None

    def get_correctionOfCode(self, obj) -> str | None:
        return obj.correction_of.code if obj.correction_of_id else None

    def get_correctionWorkOrderId(self, obj) -> str | None:
        order = self._latest_correction_order(obj)
        return str(order.id) if order else None

    def get_correctionWorkOrderCode(self, obj) -> str | None:
        order = self._latest_correction_order(obj)
        return order.code if order else None
    def get_effectiveWorkMinutes(self, obj) -> int:
        return effective_work_minutes(obj)

    def get_activeWorkSession(self, obj) -> dict | None:
        return active_work_session(obj)

    def get_satisfaction(self, obj) -> dict | None:
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

    def get_startPhoto(self, obj) -> str | None:
        return self._traceability_photo_url(obj, WorkOrderPhoto.Stage.START)

    def get_finishPhoto(self, obj) -> str | None:
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
        incident_id = validated_data.pop("incident_id", None)
        direct_order = not incident_id
        direct_description = validated_data.pop("directRequestDescription", "").strip()
        order_type = validated_data.get("order_type") or WorkOrder.OrderType.WORK
        direct_request_type = validated_data.pop("directRequestType", "").strip() or ("OL directa" if order_type == WorkOrder.OrderType.CLEANING else "OT directa")
        direct_asset_id = validated_data.pop("directAssetId", None)
        direct_location_id = validated_data.pop("directLocationId", None)
        technician_code = validated_data.pop("technicianWorkerCode", None)
        technician_codes = validated_data.pop("technicianWorkerCodes", [])
        supervisor_code = validated_data.pop("supervisorWorkerCode", None)
        operator_id = validated_data.pop("operatorId", None)
        supervisor_id = validated_data.pop("supervisorId", None)

        users = get_user_model().objects.select_related("account_profile")
        technician = None
        if technician_code:
            technician = users.filter(account_profile__worker_code__iexact=technician_code).first()
        if not technician and operator_id:
            technician = (
                users.filter(account_profile__id=operator_id).first()
                or users.filter(pk=operator_id).first()
            )
        if not technician:
            technician = users.filter(account_profile__role=AccountProfile.Role.TECHNICIAN).first() or request.user

        supervisor = None
        if supervisor_code:
            supervisor = users.filter(account_profile__worker_code__iexact=supervisor_code).first()
        if not supervisor and supervisor_id:
            supervisor = (
                users.filter(account_profile__id=supervisor_id).first()
                or users.filter(pk=supervisor_id).first()
            )
        if not supervisor:
            supervisor = (
                users.filter(account_profile__role=AccountProfile.Role.SUPERVISOR).first()
                or users.filter(account_profile__role=AccountProfile.Role.ADMIN).first()
                or request.user
            )

        if incident_id:
            incident = Incident.objects.select_for_update().get(pk=incident_id)
        else:
            if not direct_description:
                raise serializers.ValidationError({"directRequestDescription": "Describe la orden que se va a ejecutar."})
            asset = None
            if direct_asset_id:
                asset = Asset.objects.select_related("location", "location_map").filter(pk=direct_asset_id).first()
                if asset:
                    direct_location_id = direct_location_id or asset.location_id
            if not direct_location_id:
                first_loc = Location.objects.filter(active=True).first()
                direct_location_id = first_loc.id if first_loc else None
            if not direct_location_id:
                raise serializers.ValidationError({"directLocationId": "Selecciona una ubicación para la orden."})
            location = Location.objects.filter(pk=direct_location_id, active=True).first()
            if not location:
                location = Location.objects.filter(active=True).first()
            if not location:
                raise serializers.ValidationError({"directLocationId": "Selecciona una ubicación válida."})
            location_map = None
            if asset and asset.location_map_id and asset.location_id == location.id:
                location_map = asset.location_map
            if not location_map:
                location_map = location.reference_maps.filter(active=True).first()
            location_snapshot = {
                "locationId": str(location.id),
                "zone": location.zone,
                "building": location.building,
                "area": location.area,
                "room": location.room,
                "locationMapId": str(location_map.id) if location_map else None,
                "locationMarkerX": float(asset.location_marker_x) if asset and asset.location_marker_x is not None else None,
                "locationMarkerY": float(asset.location_marker_y) if asset and asset.location_marker_y is not None else None,
            }
            incident_sequence = Incident.objects.select_for_update().count() + 1
            incident = Incident.objects.create(
                code=f"SOL-{timezone.localdate().year}-{incident_sequence:04d}",
                requester=request.user,
                asset=asset,
                request_type=direct_request_type,
                description=direct_description,
                requester_priority=validated_data.get("admin_priority", "MEDIA"),
                status=Incident.Status.IN_PROGRESS,
                location_snapshot=location_snapshot,
                requester_contact={
                    "name": request.user.get_full_name() or request.user.username,
                    "email": request.user.email,
                    "source": "ADMIN_DIRECT_ORDER",
                },
                impact_assessment={
                    "createdByAdmin": True,
                    "source": "ADMIN_DIRECT_ORDER",
                    "orderType": order_type,
                    "specialty": validated_data.get("specialty", ""),
                },
            )
            record_audit(
                request=request,
                action="INCIDENT_CREATED_BY_ADMIN_FOR_WORK_ORDER",
                entity="Incident",
                entity_id=incident.id,
                after={"code": incident.code, "status": incident.status},
            )
        if order_type != WorkOrder.OrderType.SERVICE:
            validate_technician_availability(
                technician,
                validated_data["scheduled_date"],
                validated_data.get("scheduled_start_time") or time(8, 0),
                validated_data.get("planned_hours") or 1,
            )
        sequence = WorkOrder.objects.select_for_update().filter(order_type=order_type).count() + 1
        order = WorkOrder.objects.create(
            code=f"{order_type}-{timezone.localdate().year}-{sequence:04d}",
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
        if not direct_order:
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
        fields = ("id", "name", "scope", "sections", "version", "variables", "content_hash", "status", "is_active", "is_default", "createdAt", "updatedAt")
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
            "RESCHEDULE_CORRECTION",
            "SERVICE_START",
            "SERVICE_CLOSE",
            "SERVICE_CANCEL",
            "UPDATE_PHOTO",
            "DELETE_PHOTO",
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
        if value.size > 15 * 1024 * 1024:
            raise serializers.ValidationError("La fotografía no puede superar 15 MB.")
        try:
            if hasattr(value, "image") and value.image:
                fmt = str(getattr(value.image, "format", "") or "").upper()
                if fmt and fmt not in {"JPEG", "JPG", "PNG", "WEBP", "GIF"}:
                    content_type = getattr(value, "content_type", "")
                    if not content_type.startswith("image/"):
                        raise serializers.ValidationError("Usa una imagen JPG, PNG o WEBP válida.")
        except Exception:
            pass
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

        if action not in {"UPDATE_PHOTO", "DELETE_PHOTO"}:
            role = getattr(request.user.account_profile, 'role', None)
            technical_actions = {'START', 'PAUSE', 'PROGRESS', 'DIAGNOSIS'}
            if role == AccountProfile.Role.TECHNICIAN:
                if order.technician_id != request.user.id and not order.supporting_technicians.filter(pk=request.user.id).exists():
                    raise PermissionDenied('Solo los técnicos asignados pueden actualizar esta orden.')
                if action not in technical_actions:
                    raise PermissionDenied('Esta acción corresponde a la validación administrativa.')
            elif role == AccountProfile.Role.SUPERVISOR:
                if order.supervisor_id != request.user.id:
                    raise PermissionDenied('Solo el supervisor asignado puede revisar esta orden.')
                if action not in {'SUPERVISOR_APPROVE', 'SUPERVISOR_RETURN'}:
                    raise PermissionDenied('Esta acción corresponde al administrador o al operario.')
            elif role == AccountProfile.Role.ADMIN:
                if action in technical_actions or action.startswith('SUPERVISOR_') or action in {'CONFORM', 'REOPEN'}:
                    raise PermissionDenied('Esta acción corresponde al operario, supervisor o solicitante.')
            expected_statuses = {
                'START': {WorkOrder.Status.SCHEDULED, WorkOrder.Status.PENDING_RESCHEDULE, WorkOrder.Status.RETURNED, WorkOrder.Status.IN_PROGRESS},
                'PAUSE': {WorkOrder.Status.IN_PROGRESS},
                'PROGRESS': {WorkOrder.Status.IN_PROGRESS},
                'SUPERVISOR_APPROVE': {WorkOrder.Status.SUPERVISION},
                'SUPERVISOR_RETURN': {WorkOrder.Status.SUPERVISION},
                'ADMIN_APPROVE': {WorkOrder.Status.ADMIN_REVIEW},
                'ADMIN_RETURN': {WorkOrder.Status.ADMIN_REVIEW},
                'CONFORM': {WorkOrder.Status.CONFORMITY},
                'REOPEN': {WorkOrder.Status.CONFORMITY},
                'RESCHEDULE_CORRECTION': {WorkOrder.Status.RETURNED},
                'SERVICE_START': {WorkOrder.Status.SCHEDULED},
                'SERVICE_CLOSE': {WorkOrder.Status.SCHEDULED, WorkOrder.Status.IN_PROGRESS},
                'SERVICE_CANCEL': {WorkOrder.Status.SCHEDULED, WorkOrder.Status.IN_PROGRESS},
            }
            allowed_statuses = expected_statuses.get(action)
            if allowed_statuses and order.status not in allowed_statuses:
                raise serializers.ValidationError({
                    'action': 'La acción no corresponde al estado actual de la orden.'
                })

        if action.startswith("SERVICE_") and order.order_type != WorkOrder.OrderType.SERVICE:
            raise serializers.ValidationError({
                'action': 'Esta acciÃ³n solo corresponde a una OS.'
            })

        if action == "START":
            if order.status == WorkOrder.Status.RETURNED and order.correction_orders.exists():
                raise serializers.ValidationError({
                    "action": "Esta orden ya tiene una OT de corrección vinculada. Abre la nueva OT para continuar."
                })
            if order.status == WorkOrder.Status.RETURNED and order.scheduled_date > timezone.localdate():
                raise serializers.ValidationError({
                    'action': 'La corrección aún no está programada para hoy.'
                })
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

            # Check for necessary_no_blocking materials whose required progress percentage is met
            # and check if they still lack stock to notify administrators
            from apps.workorders.models import WorkOrderMaterial
            
            materiales_pendientes = order.materiales_usados.filter(
                tipo=WorkOrderMaterial.Tipo.NECESARIO_NO_BLOQUEANTE,
                es_bloqueante=False,
                porcentaje_requerido__isnull=False,
                porcentaje_requerido__lte=percentage
            ).select_related("material")
            
            for m in materiales_pendientes:
                insuficiente = False
                if m.material.control_individual:
                    from apps.catalogo.models import Pieza
                    disponibles = Pieza.objects.filter(material=m.material, estado="Disponible").count()
                    if m.cantidad > disponibles:
                        insuficiente = True
                else:
                    if m.cantidad > m.material.cantidad_total:
                        insuficiente = True
                
                if insuficiente:
                    m.es_bloqueante = True
                    m.save(update_fields=["es_bloqueante", "actualizado_en"])
                    
                    operator_name = request.user.get_full_name() or request.user.username
                    queue_for_administrators(
                        event="MATERIAL_BLOQUEANTE",
                        subject=f"Material urgente en {order.code} por avance ({percentage}%)",
                        body=(
                            f"El técnico {operator_name} ha alcanzado el {percentage}% de avance en la OT {order.code} "
                            f"y requiere el material '{m.material.nombre}' (cantidad: {m.cantidad}) "
                            f"el cual no cuenta con stock disponible. Se ha marcado como bloqueante."
                        ),
                        entity=order,
                        discriminator=f"bloqueante_avance:{m.id}"
                    )
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
            if not approved:
                snapshot = {**(order.recommendation_snapshot or {})}
                snapshot.pop("correctionSchedule", None)
                order.recommendation_snapshot = snapshot
        elif action.startswith("ADMIN_"):
            approved = action.endswith("APPROVE")
            order.administrator_validation = {
                **self.validated_data["payload"],
                "approved": approved,
                "at": now.isoformat(),
                "by": request.user.get_full_name(),
            }
            # La aprobación administrativa cierra la OT. La encuesta posterior
            # es opcional y no bloquea la entrega del bien.
            order.status = WorkOrder.Status.CLOSED if approved else WorkOrder.Status.RETURNED
            order.closed_at = now if approved else None
            if approved:
                order.incident.status = Incident.Status.CLOSED
                order.incident.save(update_fields=("status", "updated_at"))
            else:
                snapshot = {**(order.recommendation_snapshot or {})}
                snapshot.pop("correctionSchedule", None)
                order.recommendation_snapshot = snapshot
        elif action == "RESCHEDULE_CORRECTION":
            payload = self.validated_data["payload"]
            scheduled_date = payload.get("scheduledDate")
            scheduled_start_time = payload.get("scheduledStartTime") or "08:00"
            planned_hours = payload.get("plannedHours") or 2
            notes = str(payload.get("administratorNotes") or "").strip()
            operator_id = payload.get("operatorId")

            try:
                parsed_date = datetime.fromisoformat(str(scheduled_date)).date()
            except (TypeError, ValueError):
                raise serializers.ValidationError({
                    'scheduledDate': 'Selecciona una fecha válida para la corrección.'
                })
            if parsed_date < timezone.localdate():
                raise serializers.ValidationError({
                    'scheduledDate': 'La fecha de corrección no puede estar en el pasado.'
                })
            try:
                parsed_time = time.fromisoformat(str(scheduled_start_time))
            except ValueError:
                raise serializers.ValidationError({
                    'scheduledStartTime': 'Selecciona una hora válida para la corrección.'
                })
            try:
                parsed_hours = int(planned_hours)
            except (TypeError, ValueError):
                raise serializers.ValidationError({
                    'plannedHours': 'Ingresa las horas estimadas.'
                })
            if parsed_hours < 1 or parsed_hours > 16:
                raise serializers.ValidationError({
                    'plannedHours': 'Las horas estimadas deben estar entre 1 y 16.'
                })
            correction_technician = order.technician
            if operator_id:
                users = get_user_model().objects.select_related("account_profile").filter(
                    is_active=True,
                    account_profile__role=AccountProfile.Role.TECHNICIAN,
                )
                correction_technician = (
                    users.filter(account_profile__id=operator_id).first()
                    or users.filter(pk=operator_id).first()
                )
                if not correction_technician:
                    raise serializers.ValidationError({
                        "operatorId": "Selecciona un operario válido para la corrección."
                    })

            existing_correction = order.correction_orders.order_by("-created_at").first()
            if existing_correction:
                raise serializers.ValidationError({
                    "action": f"Esta orden ya tiene una corrección vinculada: {existing_correction.code}."
                })

            validate_technician_availability(
                correction_technician,
                parsed_date,
                parsed_time,
                parsed_hours,
                exclude_order_id=order.id,
            )

            correction_order = WorkOrder.objects.create(
                code=next_correction_code(order),
                incident=order.incident,
                correction_of=order,
                technician=correction_technician,
                supervisor=order.supervisor,
                specialty=order.specialty,
                admin_priority=order.admin_priority,
                status=WorkOrder.Status.SCHEDULED,
                scheduled_date=parsed_date,
                scheduled_start_time=parsed_time,
                planned_hours=parsed_hours,
                administrator_notes=notes,
                created_by=request.user,
                recommendation_snapshot={
                    "correctionOfId": str(order.id),
                    "correctionOfCode": order.code,
                    "correctionReason": (
                        order.administrator_validation.get("comment")
                        or order.supervisor_validation.get("comment")
                        or "Corrección solicitada."
                    ),
                    "scheduledBy": request.user.get_full_name() or request.user.username,
                    "scheduledAt": now.isoformat(),
                    "selected": getattr(correction_technician.account_profile, "worker_code", "") or correction_technician.username,
                },
            )
            correction_order.supporting_technicians.set(order.supporting_technicians.exclude(pk=correction_technician.pk))
            order.recommendation_snapshot = {
                **(order.recommendation_snapshot or {}),
                "correctionWorkOrderId": str(correction_order.id),
                "correctionWorkOrderCode": correction_order.code,
                "correctionSchedule": {
                    "scheduledDate": parsed_date.isoformat(),
                    "scheduledStartTime": parsed_time.strftime("%H:%M"),
                    "plannedHours": parsed_hours,
                    "administratorNotes": notes,
                    "scheduledBy": request.user.get_full_name() or request.user.username,
                    "scheduledAt": now.isoformat(),
                },
            }
            order.incident.status = Incident.Status.IN_PROGRESS
            order.incident.save(update_fields=("status", "updated_at"))
        elif action == "SERVICE_START":
            service_payload = {
                **(order.administrator_validation or {}),
                **self.validated_data["payload"],
            }
            order.status = WorkOrder.Status.IN_PROGRESS
            order.started_at = order.started_at or now
            order.administrator_validation = {
                **service_payload,
                "serviceStatus": "EN_COORDINACION",
                "at": now.isoformat(),
                "by": request.user.get_full_name(),
            }
        elif action == "SERVICE_CLOSE":
            service_payload = {
                **(order.administrator_validation or {}),
                **self.validated_data["payload"],
            }
            order.status = WorkOrder.Status.CLOSED
            order.progress_percentage = 100
            order.finished_at = order.finished_at or now
            order.closed_at = now
            order.administrator_validation = {
                **service_payload,
                "approved": True,
                "serviceStatus": "CERRADA",
                "at": now.isoformat(),
                "by": request.user.get_full_name(),
            }
            order.incident.status = Incident.Status.CLOSED
            order.incident.save(update_fields=("status", "updated_at"))
        elif action == "SERVICE_CANCEL":
            service_payload = {
                **(order.administrator_validation or {}),
                **self.validated_data["payload"],
            }
            order.status = WorkOrder.Status.CANCELLED
            order.closed_at = now
            order.administrator_validation = {
                **service_payload,
                "approved": False,
                "serviceStatus": "CANCELADA",
                "at": now.isoformat(),
                "by": request.user.get_full_name(),
            }
        elif action == "UPDATE_PHOTO":
            stage_param = str(self.validated_data.get("observation") or "START").upper()
            target_stage = WorkOrderPhoto.Stage.START if stage_param in {"START", "INICIO", "ANTES"} else WorkOrderPhoto.Stage.FINISH
            photo_file = self.validated_data.get("startPhoto") or self.validated_data.get("finishPhoto")
            if not photo_file:
                raise serializers.ValidationError({"photo": "Adjunta la fotografía de evidencia."})

            existing = WorkOrderPhoto.objects.filter(work_order=order, stage=target_stage).first()
            if existing:
                existing.image = photo_file
                existing.uploaded_by = request.user
                existing.save()
            else:
                WorkOrderPhoto.objects.create(
                    work_order=order,
                    stage=target_stage,
                    image=photo_file,
                    uploaded_by=request.user,
                )
            record_privacy_event(request=request, context="EVIDENCIA", subject_reference=order.code)
        elif action == "DELETE_PHOTO":
            stage_param = str(self.validated_data.get("observation") or "START").upper()
            target_stage = WorkOrderPhoto.Stage.START if stage_param in {"START", "INICIO", "ANTES"} else WorkOrderPhoto.Stage.FINISH
            WorkOrderPhoto.objects.filter(work_order=order, stage=target_stage).delete()
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
            if action.endswith('APPROVE'):
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
        elif action == 'RESCHEDULE_CORRECTION':
            correction_order = order.correction_orders.order_by("-created_at").first() or order
            queue_notification(
                event='WORK_ORDER_CORRECTION_SCHEDULED',
                recipient=correction_order.technician,
                subject=f'Corrección programada para {correction_order.code}',
                body=(
                    f'La corrección {correction_order.code} vinculada a {order.code} fue programada para '
                    f'{correction_order.scheduled_date.isoformat()} a las {correction_order.scheduled_start_time.strftime("%H:%M")}.'
                ),
                entity=correction_order,
                discriminator='correction-scheduled',
            )
        elif action == 'ADMIN_APPROVE':
            queue_incident_requester(
                event='INCIDENT_SERVICE_DELIVERED',
                incident=order.incident,
                subject=f'Tu atención está lista · {order.incident.code}',
                body=(
                    f'La atención de tu reporte {order.incident.code} está lista para entrega o uso. '
                    f'Si lo deseas, puedes calificar el servicio en '
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


class WorkOrderMaterialSerializer(serializers.ModelSerializer):
    """Serializer de lectura para un WorkOrderMaterial."""
    materialNombre = serializers.CharField(source="material.nombre", read_only=True)
    materialCodigo = serializers.CharField(source="material.codigo", read_only=True)
    materialPrecio = serializers.DecimalField(
        source="material.precio", max_digits=10, decimal_places=2,
        allow_null=True, read_only=True,
    )
    materialStock = serializers.IntegerField(source="material.cantidad_total", read_only=True)
    tipoLabel = serializers.CharField(source="get_tipo_display", read_only=True)
    registradoPorNombre = serializers.SerializerMethodField()
    creadoEn = serializers.DateTimeField(source="creado_en", read_only=True)
    actualizadoEn = serializers.DateTimeField(source="actualizado_en", read_only=True)
    workOrderCode = serializers.CharField(source="work_order.code", read_only=True)
    cantidadPendiente = serializers.SerializerMethodField()

    class Meta:
        model = WorkOrderMaterial
        fields = (
            "id",
            "workOrderCode",
            "material",
            "materialNombre",
            "materialCodigo",
            "materialPrecio",
            "materialStock",
            "cantidad",
            "cantidadPendiente",
            "tipo",
            "tipoLabel",
            "esBloqueante",
            "porcentajeRequerido",
            "adquirido",
            "adquiridoEn",
            "registradoPorNombre",
            "creadoEn",
            "actualizadoEn",
        )

    # camelCase mapping
    esBloqueante = serializers.BooleanField(source="es_bloqueante", read_only=True)
    porcentajeRequerido = serializers.IntegerField(source="porcentaje_requerido", read_only=True)
    adquirido = serializers.BooleanField(read_only=True)
    adquiridoEn = serializers.DateTimeField(source="adquirido_en", read_only=True)

    def get_registradoPorNombre(self, obj) -> str:
        return obj.registrado_por.get_full_name() or obj.registrado_por.username

    def get_cantidadPendiente(self, obj) -> int:  # ← NUEVO
        comprometida = obj.cantidad_comprometida or 0
        return max(obj.cantidad - comprometida, 0)

class WorkOrderMaterialWriteSerializer(serializers.Serializer):
    """Serializer de escritura para registrar/editar un WorkOrderMaterial."""
    material = serializers.PrimaryKeyRelatedField(
        queryset=Material.objects.none(),
    )
    cantidad = serializers.IntegerField(min_value=1)
    tipo = serializers.ChoiceField(choices=["USADO", "NECESARIO_NO_BLOQUEANTE"])
    porcentajeRequerido = serializers.IntegerField(
        source="porcentaje_requerido",
        min_value=0,
        max_value=100,
        required=False,
        allow_null=True,
    )
    # NUEVO Fase 7: opcional — si el frontend manda el almacén que el técnico
    # eligió en el selector, se valida contra el almacén real del material.
    # Defensa en profundidad, mismo criterio que en Movimiento/Inspeccion:
    # nunca confiar solo en que el picker del frontend ya filtró bien.
    almacen = serializers.IntegerField(required=False, allow_null=True, write_only=True)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        from apps.catalogo.models import Material
        # Sin filtro de almacén en el queryset: se permiten tanto materiales
        # "padre" (estuches completos) como "hijos" (es_componente=True).
        self.fields["material"].queryset = Material.objects.all()

    def validate(self, attrs):
        material = attrs["material"]
        almacen_id = attrs.pop("almacen", None)
        if almacen_id is not None and material.almacen_id != almacen_id:
            raise serializers.ValidationError({
                "material": "Este material no pertenece al almacén seleccionado."
            })

        cantidad = attrs["cantidad"]
        if material.control_individual:
            from apps.catalogo.models import Pieza
            disponibles = Pieza.objects.filter(
                material=material, estado="Disponible"
            ).count()
            if cantidad > disponibles:
                raise serializers.ValidationError(
                    {"cantidad": f"Solo hay {disponibles} piezas disponibles de este material."}
                )
        else:
            if cantidad > material.cantidad_total:
                raise serializers.ValidationError(
                    {"cantidad": f"Solo hay {material.cantidad_total} unidades disponibles de este material."}
                )
        return attrs


class WorkOrderCostUpdateSerializer(serializers.ModelSerializer):
    """Permite al administrador actualizar amount (y description) de un costo existente."""
    class Meta:
        model = WorkOrderCost
        fields = ("amount", "description")
        extra_kwargs = {
            "amount": {"required": False, "allow_null": True},
            "description": {"required": False},
        }
