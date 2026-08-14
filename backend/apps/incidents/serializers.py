from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import AccountProfile
from apps.assets.models import Asset, Location, LocationMap
from apps.audit.services import record_audit
from apps.notifications.services import queue_for_administrators, queue_incident_requester
from apps.organization.services import register_reporter
from apps.privacy.services import record_privacy_event

from .models import Incident
from .services import build_tracking_url


class IncidentSerializer(serializers.ModelSerializer):
    requesterId = serializers.CharField(source="requester.account_profile.id", read_only=True)
    requesterName = serializers.SerializerMethodField()
    requesterEmail = serializers.SerializerMethodField()
    requesterPhone = serializers.SerializerMethodField()
    locationId = serializers.SerializerMethodField()
    zone = serializers.SerializerMethodField()
    building = serializers.SerializerMethodField()
    area = serializers.SerializerMethodField()
    room = serializers.SerializerMethodField()
    locationMapId = serializers.SerializerMethodField()
    locationMarkerX = serializers.SerializerMethodField()
    locationMarkerY = serializers.SerializerMethodField()
    requestType = serializers.CharField(source="request_type")
    requesterPriority = serializers.CharField(source="requester_priority")
    rejectionReason = serializers.CharField(
        source="rejection_reason", required=False, allow_blank=True
    )
    workOrderId = serializers.SerializerMethodField()
    reportedAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    assetId = serializers.UUIDField(source="asset_id", required=False, allow_null=True)
    requesterContact = serializers.JSONField(source="requester_contact", required=False)
    impactAssessment = serializers.JSONField(source="impact_assessment", required=False)
    assetCode = serializers.SerializerMethodField()
    assetDisplayCode = serializers.SerializerMethodField()
    status = serializers.CharField(required=False)

    class Meta:
        model = Incident
        fields = (
            "id",
            "code",
            "assetId",
            "assetCode",
            "assetDisplayCode",
            "requesterId",
            "requesterName",
            "requesterEmail",
            "requesterPhone",
            "requesterContact",
            "locationId",
            "zone",
            "building",
            "area",
            "room",
            "locationMapId",
            "locationMarkerX",
            "locationMarkerY",
            "requestType",
            "description",
            "requesterPriority",
            "project",
            "evidence",
            "impactAssessment",
            "status",
            "rejectionReason",
            "workOrderId",
            "reportedAt",
            "updatedAt",
        )
        read_only_fields = ("id", "code", "requesterId", "requesterName", "requesterEmail")

    def get_requesterName(self, obj) -> str:
        if obj.requester_contact.get("name"):
            return obj.requester_contact["name"]
        if obj.public_submission and obj.reporter_name:
            return obj.reporter_name
        return obj.requester.get_full_name() or obj.requester.username

    def get_requesterEmail(self, obj) -> str:
        if obj.requester_contact.get("email"):
            return obj.requester_contact["email"]
        if obj.public_submission and obj.reporter_email:
            return obj.reporter_email
        return obj.requester.email

    def get_requesterPhone(self, obj) -> str:
        return obj.requester_contact.get("phone", "")

    def get_assetCode(self, obj) -> str | None:
        return obj.asset.code if obj.asset else None

    def get_assetDisplayCode(self, obj) -> str | None:
        return (obj.asset.fm_code or obj.asset.code) if obj.asset else None

    def _location(self, obj, key):
        return obj.location_snapshot.get(key, "")

    def get_locationId(self, obj) -> str:
        return self._location(obj, "locationId")

    def get_zone(self, obj) -> str:
        return self._location(obj, "zone")

    def get_building(self, obj) -> str:
        return self._location(obj, "building")

    def get_area(self, obj) -> str:
        return self._location(obj, "area")

    def get_room(self, obj) -> str:
        return self._location(obj, "room")

    def get_locationMapId(self, obj) -> str | None:
        return self._location(obj, "locationMapId") or None

    def _location_float(self, obj, key) -> float | None:
        value = self._location(obj, key)
        if value in (None, ""):
            return None
        try:
            return float(value)
        except (TypeError, ValueError):
            return None

    def get_locationMarkerX(self, obj) -> float | None:
        return self._location_float(obj, "locationMarkerX")

    def get_locationMarkerY(self, obj) -> float | None:
        return self._location_float(obj, "locationMarkerY")

    def get_workOrderId(self, obj) -> str | None:
        order = obj.work_order
        return str(order.id) if order else None

    def validate_status(self, value):
        aliases = {
            "PENDIENTE": Incident.Status.RECEIVED,
            "EN_EVALUACION": Incident.Status.REVIEW,
            "CONVERTIDA_EN_OT": Incident.Status.IN_PROGRESS,
        }
        normalized = aliases.get(value, value)
        if normalized not in Incident.Status.values:
            raise serializers.ValidationError("Estado de solicitud no válido.")
        return normalized

    def validate(self, attrs):
        if self.instance is not None:
            return attrs
        request = self.context["request"]
        location_id = request.data.get("locationId")
        try:
            location = Location.objects.get(pk=location_id, active=True)
        except (Location.DoesNotExist, TypeError, ValueError):
            raise serializers.ValidationError(
                {"locationId": "Selecciona una ubicación oficial activa."}
            ) from None

        map_id = request.data.get("locationMapId") or None
        location_map = None
        if map_id:
            try:
                location_map = LocationMap.objects.get(pk=map_id, location=location, active=True)
            except (LocationMap.DoesNotExist, TypeError, ValueError):
                raise serializers.ValidationError(
                    {
                        "locationMapId": (
                            "La imagen referencial no corresponde al ambiente seleccionado."
                        )
                    }
                ) from None

        marker_x = request.data.get("locationMarkerX")
        marker_y = request.data.get("locationMarkerY")
        if (marker_x is None) != (marker_y is None):
            raise serializers.ValidationError({"locationMarkerX": "Las dos coordenadas del marcador deben enviarse juntas."})
        if marker_x is not None:
            try:
                marker_x, marker_y = float(marker_x), float(marker_y)
            except (TypeError, ValueError):
                raise serializers.ValidationError(
                    {"locationMarkerX": "Las coordenadas del marcador no son válidas."}
                ) from None
            if not location_map or not (0 <= marker_x <= 1 and 0 <= marker_y <= 1):
                raise serializers.ValidationError({"locationMarkerX": "El marcador debe pertenecer a la imagen seleccionada."})

        self._resolved_location = location
        self._resolved_location_map = location_map
        self._resolved_marker = (marker_x, marker_y)
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        aliases = {
            Incident.Status.RECEIVED: "PENDIENTE",
            Incident.Status.REVIEW: "EN_EVALUACION",
            Incident.Status.ATTENDED: "APROBADA",
            Incident.Status.REJECTED: "RECHAZADA",
            Incident.Status.IN_PROGRESS: "CONVERTIDA_EN_OT",
            Incident.Status.CLOSED: "CONVERTIDA_EN_OT",
        }
        data["status"] = aliases.get(instance.status, instance.status)
        return data

    @transaction.atomic
    def create(self, validated_data):
        request = self.context["request"]
        selected_location = self._resolved_location
        location_map = self._resolved_location_map
        marker_x, marker_y = self._resolved_marker
        location = {
            "locationId": str(selected_location.id),
            "zone": selected_location.zone,
            "building": selected_location.building,
            "area": selected_location.area,
            "room": selected_location.room,
            "locationMapId": str(location_map.id) if location_map else None,
            "locationMarkerX": marker_x,
            "locationMarkerY": marker_y,
        }
        sequence = Incident.objects.select_for_update().count() + 1
        incident = Incident.objects.create(
            code=f"SOL-{timezone.localdate().year}-{sequence:04d}",
            requester=request.user,
            location_snapshot=location,
            **validated_data,
        )
        record_audit(
            request=request,
            action="INCIDENT_CREATED",
            entity="Incident",
            entity_id=incident.id,
            after={"code": incident.code, "status": incident.status},
        )
        queue_for_administrators(
            event='INCIDENT_CREATED',
            subject=f'Nueva incidencia {incident.code}',
            body=(
                f'Se recibió una incidencia en {selected_location.room}. '
                'Revisa la bandeja de incidencias para atenderla.'
            ),
            entity=incident,
            context={'locationId': str(selected_location.id)},
            discriminator=incident.status,
        )
        queue_incident_requester(
            event='INCIDENT_RECEIVED',
            incident=incident,
            subject=f'Recibimos tu reporte {incident.code}',
            body=(
                f'Recibimos tu reporte {incident.code} y ya se encuentra en evaluación. '
                'Te avisaremos cuando programemos la revisión o haya una actualización importante.'
            ),
            discriminator=incident.status,
        )
        return incident

    @transaction.atomic
    def update(self, instance, validated_data):
        request = self.context["request"]
        before = {"status": instance.status, "rejection_reason": instance.rejection_reason}
        instance = super().update(instance, validated_data)
        record_audit(
            request=request,
            action="INCIDENT_UPDATED",
            entity="Incident",
            entity_id=instance.id,
            before=before,
            after={"status": instance.status, "rejection_reason": instance.rejection_reason},
        )
        if before["status"] != Incident.Status.REJECTED and instance.status == Incident.Status.REJECTED:
            reason = instance.rejection_reason.strip() or "No se registró un motivo específico."
            queue_incident_requester(
                event="INCIDENT_REJECTED",
                incident=instance,
                subject=f"Solicitud no aprobada {instance.code}",
                body=(
                    f"Tu solicitud {instance.code} fue revisada y no fue aprobada para atención.\n\n"
                    f"Motivo: {reason}\n\n"
                    f"Puedes revisar el seguimiento aquí: {build_tracking_url(instance)}"
                ),
                discriminator=instance.status,
            )
        return instance


class PublicAssetIncidentSerializer(serializers.Serializer):
    reporterName = serializers.CharField(max_length=160)
    reporterEmail = serializers.EmailField(required=False, allow_blank=True)
    reporterDni = serializers.CharField(max_length=12)
    reporterWorkerCode = serializers.CharField(max_length=40)
    requestType = serializers.CharField(max_length=40)
    description = serializers.CharField(min_length=10, max_length=3000)
    requesterPriority = serializers.ChoiceField(choices=("BAJA", "MEDIA", "ALTA"), default="MEDIA")

    def _public_requester(self):
        user_model = get_user_model()
        user, created = user_model.objects.get_or_create(
            username="public.reporter",
            defaults={
                "first_name": "Reporte",
                "last_name": "Publico",
                "email": "",
                "is_active": True,
            },
        )
        if created:
            user.set_unusable_password()
            user.save(update_fields=("password",))
        AccountProfile.objects.get_or_create(
            user=user,
            defaults={
                "worker_code": "PUBLIC-REPORTER",
                "role": AccountProfile.Role.REQUESTER,
                "must_change_password": False,
            },
        )
        return user

    @transaction.atomic
    def create(self, validated_data):
        asset = self.context["asset"]
        requester = self._public_requester()
        try:
            reporter_profile = register_reporter(
                dni=validated_data["reporterDni"],
                worker_code=validated_data["reporterWorkerCode"],
                full_name=validated_data["reporterName"],
                email=validated_data.get("reporterEmail", ""),
            )
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        sequence = Incident.objects.select_for_update().count() + 1
        location = asset.location
        return Incident.objects.create(
            code=f"SOL-{timezone.localdate().year}-{sequence:04d}",
            asset=asset,
            requester=requester,
            reporter_profile=reporter_profile,
            reporter_name=validated_data["reporterName"],
            reporter_email=validated_data.get("reporterEmail", ""),
            public_submission=True,
            requester_contact={
                "name": validated_data["reporterName"],
                "email": validated_data.get("reporterEmail", ""),
                "phone": "",
                "workerCode": validated_data["reporterWorkerCode"],
            },
            request_type=validated_data["requestType"],
            description=validated_data["description"],
            requester_priority=validated_data["requesterPriority"],
            location_snapshot={
                "locationId": str(location.id) if location else "",
                "zone": location.zone if location else "",
                "building": location.building if location else "",
                "area": location.area if location else "",
                "room": location.room if location else "",
            },
            status="RECIBIDA",
        )


class PublicWorkRequestSerializer(serializers.Serializer):
    requesterName = serializers.CharField(max_length=160)
    requesterEmail = serializers.EmailField()
    requesterPhone = serializers.CharField(max_length=40, required=False, allow_blank=True)
    requesterWorkerCode = serializers.CharField(max_length=40)
    requesterDni = serializers.CharField(max_length=12)
    assetToken = serializers.CharField(required=False, allow_blank=True, max_length=100)
    locationId = serializers.CharField(required=False, allow_blank=True)
    zone = serializers.CharField(max_length=120, required=False, allow_blank=True)
    building = serializers.CharField(max_length=160, required=False, allow_blank=True)
    area = serializers.CharField(max_length=160, required=False, allow_blank=True)
    room = serializers.CharField(max_length=160, required=False, allow_blank=True)
    description = serializers.CharField(min_length=10, max_length=1000)
    evidence = serializers.ListField(required=False, default=list)
    noPhotoReason = serializers.CharField(required=False, allow_blank=True, max_length=300)
    suggestedPriority = serializers.ChoiceField(choices=("NORMAL", "URGENTE", "EMERGENCIA"))
    priorityReasons = serializers.ListField(child=serializers.CharField(), required=False, default=list)
    impactAnswers = serializers.DictField(required=True)

    def validate(self, attrs):
        impact_answers = attrs.get("impactAnswers") or {}
        if (
            impact_answers.get("issueCategory") == "OTRO"
            and not (str(impact_answers.get("otherIssueCategoryDetail", "")).strip() or str(impact_answers.get("otherRequestDetail", "")).strip())
        ):
            raise serializers.ValidationError(
                {"impactAnswers": "Indica el detalle cuando el tipo de solicitud es Otro."}
            )
        asset_token = attrs.get('assetToken', '').strip()
        zone = attrs.get('zone', '').strip()
        if not asset_token and not zone:
            raise serializers.ValidationError({"zone": "Debe indicar la ubicación o escanear un código QR válido."})
        return attrs

    def _public_requester(self):
        user_model = get_user_model()
        user, created = user_model.objects.get_or_create(
            username="solicitante.publico",
            defaults={
                "first_name": "Solicitante",
                "last_name": "Publico",
                "email": "solicitante.publico@incalpaca.test",
                "is_active": True,
            },
        )
        if created:
            user.set_unusable_password()
            user.save(update_fields=("password",))
        AccountProfile.objects.get_or_create(
            user=user,
            defaults={
                "worker_code": "solicitante-publico",
                "role": AccountProfile.Role.REQUESTER,
                "must_change_password": False,
                "active": True,
            },
        )
        return user

    @transaction.atomic
    def create(self, validated_data):
        requester = self._public_requester()
        asset_token = validated_data.pop("assetToken", "").strip()
        asset = None
        if asset_token:
            try:
                asset = Asset.objects.select_related("location").get(public_token=asset_token)
            except Asset.DoesNotExist as exc:
                raise serializers.ValidationError({"assetToken": "El QR del bien no es válido o ya no está disponible."}) from exc
        try:
            reporter_profile = register_reporter(
                dni=validated_data["requesterDni"],
                worker_code=validated_data["requesterWorkerCode"],
                full_name=validated_data["requesterName"],
                email=validated_data["requesterEmail"],
            )
        except DjangoValidationError as exc:
            raise serializers.ValidationError(exc.message_dict) from exc
        sequence = Incident.objects.select_for_update().count() + 1
        location = {
            "locationId": validated_data.get("locationId") or "-".join(
                [
                    validated_data["zone"],
                    validated_data["building"],
                    validated_data["area"],
                    validated_data["room"],
                ]
            ),
            "zone": validated_data["zone"],
            "building": validated_data["building"],
            "area": validated_data["area"],
            "room": validated_data["room"],
        }
        if asset and asset.location:
            location = {
                "locationId": str(asset.location.id),
                "zone": asset.location.zone,
                "building": asset.location.building,
                "area": asset.location.area,
                "room": asset.location.room,
            }
        incident = Incident.objects.create(
            code=f"SOL-{timezone.localdate().year}-{sequence:04d}",
            requester=requester,
            reporter_profile=reporter_profile,
            requester_contact={
                "name": validated_data["requesterName"],
                "email": validated_data["requesterEmail"],
                "phone": validated_data.get("requesterPhone", ""),
                "workerCode": validated_data.get("requesterWorkerCode", ""),
            },
            asset=asset,
            location_snapshot=location,
            request_type=validated_data["impactAnswers"].get("issueCategory") or "OTRO",
            description=validated_data["description"],
            requester_priority=validated_data["suggestedPriority"],
            project=False,
            evidence=validated_data.get("evidence", []),
            impact_assessment={
                "suggestedPriority": validated_data["suggestedPriority"],
                "priorityReasons": validated_data.get("priorityReasons", []),
                "answers": validated_data["impactAnswers"],
                "noPhotoReason": validated_data.get("noPhotoReason", ""),
            },
            status="RECIBIDA",
        )
        record_privacy_event(
            request=self.context["request"],
            context="REPORTE",
            subject_reference=incident.code,
        )
        return incident


class PublicIncidentTrackingSerializer(serializers.ModelSerializer):
    incidentId = serializers.UUIDField(source="id", read_only=True)
    currentStatus = serializers.SerializerMethodField()
    workOrderStatus = serializers.SerializerMethodField()
    canSubmitConformity = serializers.SerializerMethodField()
    conformity = serializers.SerializerMethodField()
    workerName = serializers.SerializerMethodField()
    workerSpecialty = serializers.SerializerMethodField()
    workOrderCode = serializers.SerializerMethodField()
    progressPercentage = serializers.SerializerMethodField()
    location = serializers.SerializerMethodField()
    reportedAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    events = serializers.SerializerMethodField()

    class Meta:
        model = Incident
        fields = (
            "incidentId",
            "code",
            "description",
            "currentStatus",
            "workOrderStatus",
            "canSubmitConformity",
            "conformity",
            "workerName",
            "workerSpecialty",
            "workOrderCode",
            "progressPercentage",
            "location",
            "reportedAt",
            "updatedAt",
            "events",
        )

    def _work_order(self, obj):
        return getattr(obj, "work_order", None)

    def get_currentStatus(self, obj) -> str:
        order = self._work_order(obj)
        if order:
            if order.status == "CERRADA":
                return "FINALIZADO"
            if order.status == "PENDIENTE_DE_CONFORMIDAD":
                return "PENDIENTE_CONFORMIDAD"
            if order.status in {"EN_PROCESO", "PENDIENTE_DE_SUPERVISION", "PENDIENTE_DE_VALIDACION"}:
                return "EN_PROCESO"
            return "ASIGNADO"
        if obj.status == Incident.Status.REJECTED:
            return "RECHAZADO"
        if obj.status in {Incident.Status.REVIEW, Incident.Status.ATTENDED}:
            return "EN_REVISION"
        return "REPORTADO"


    def get_workOrderStatus(self, obj) -> str:
        order = self._work_order(obj)
        return order.status if order else ""

    def get_canSubmitConformity(self, obj) -> bool:
        order = self._work_order(obj)
        return bool(
            order
            and order.status in {"CERRADA", "PENDIENTE_DE_CONFORMIDAD"}
            and not getattr(order, "satisfaction", None)
        )

    def get_conformity(self, obj) -> dict:
        order = self._work_order(obj)
        return order.conformity if order else {}
    def get_workerName(self, obj) -> str:
        order = self._work_order(obj)
        if not order:
            return "Pendiente de asignacion"
        return order.technician.get_full_name() or order.technician.username

    def get_workerSpecialty(self, obj) -> str:
        order = self._work_order(obj)
        return order.specialty if order else "Aún no asignado"

    def get_workOrderCode(self, obj) -> str:
        order = self._work_order(obj)
        return order.code if order else ""

    def get_progressPercentage(self, obj) -> int:
        order = self._work_order(obj)
        return order.progress_percentage if order else 0

    def get_location(self, obj) -> str:
        parts = [
            obj.location_snapshot.get("zone"),
            obj.location_snapshot.get("building"),
            obj.location_snapshot.get("area"),
            obj.location_snapshot.get("room"),
        ]
        return " / ".join([part for part in parts if part])

    def get_events(self, obj) -> list[dict]:
        events = [
            {
                "id": f"{obj.id}-reported",
                "status": "REPORTADO",
                "description": "Solicitud registrada correctamente.",
                "date": obj.created_at.isoformat(),
                "actor": obj.requester.get_full_name() or obj.requester.username,
            }
        ]
        if obj.status in {Incident.Status.REVIEW, Incident.Status.ATTENDED, Incident.Status.IN_PROGRESS, Incident.Status.CLOSED}:
            events.append(
                {
                    "id": f"{obj.id}-review",
                    "status": "EN_REVISION",
                    "description": "La solicitud fue revisada por administración.",
                    "date": obj.updated_at.isoformat(),
                    "actor": "Administración FM",
                }
            )
        if obj.status == Incident.Status.REJECTED:
            events.append(
                {
                    "id": f"{obj.id}-rejected",
                    "status": "RECHAZADO",
                    "description": obj.rejection_reason or "La solicitud no fue aprobada para atención.",
                    "date": obj.updated_at.isoformat(),
                    "actor": "Administración FM",
                }
            )
        order = self._work_order(obj)
        if order:
            events.append(
                {
                    "id": f"{order.id}-assigned",
                    "status": "ASIGNADO",
                    "description": f"Orden de trabajo {order.code} generada y asignada.",
                    "date": order.created_at.isoformat(),
                    "actor": order.supervisor.get_full_name() or order.supervisor.username,
                }
            )
            if order.started_at:
                events.append(
                    {
                        "id": f"{order.id}-started",
                        "status": "EN_PROCESO",
                        "description": "La atención fue iniciada por el técnico asignado.",
                        "date": order.started_at.isoformat(),
                        "actor": order.technician.get_full_name() or order.technician.username,
                    }
                )
            for advance in order.advances or []:
                events.append(
                    {
                        "id": advance.get("id", f"{order.id}-advance"),
                        "status": "EN_PROCESO",
                        "description": advance.get("observation") or f"Avance registrado al {advance.get('percentage', order.progress_percentage)}%.",
                        "date": advance.get("createdAt") or order.updated_at.isoformat(),
                        "actor": advance.get("operatorName") or order.technician.get_full_name() or order.technician.username,
                    }
                )
            if order.status == "PENDIENTE_DE_CONFORMIDAD":
                events.append(
                    {
                        "id": f"{order.id}-conformity-pending",
                        "status": "FINALIZADO",
                        "description": "La atención fue finalizada y puedes evaluarla de forma opcional.",
                        "date": order.updated_at.isoformat(),
                        "actor": order.technician.get_full_name() or order.technician.username,
                    }
                )
            if order.closed_at:
                events.append(
                    {
                        "id": f"{order.id}-closed",
                        "status": "FINALIZADO",
                        "description": "La orden de trabajo fue cerrada.",
                        "date": order.closed_at.isoformat(),
                        "actor": "Administración FM",
                    }
                )
        return events


