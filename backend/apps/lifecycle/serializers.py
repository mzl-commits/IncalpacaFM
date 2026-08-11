from django.db import transaction
from django.utils import timezone
from rest_framework import serializers

from apps.audit.services import record_audit
from apps.notifications.services import queue_for_administrators
from apps.workorders.models import WorkOrder, WorkOrderPhoto

from .models import RetirementRequest, TechnicalDiagnosis


class TechnicalDiagnosisSerializer(serializers.ModelSerializer):
    asset_code = serializers.CharField(source="asset.code", read_only=True)
    asset_display_code = serializers.SerializerMethodField()
    asset_name = serializers.CharField(source="asset.name", read_only=True)

    class Meta:
        model = TechnicalDiagnosis
        fields = "__all__"

    def get_asset_display_code(self, obj) -> str:
        return obj.asset.fm_code or obj.asset.code

    def validate(self, attrs):
        result = attrs.get("result", getattr(self.instance, "result", None))
        justification = attrs.get("technical_justification", getattr(self.instance, "technical_justification", ""))
        evidence = attrs.get("evidence", getattr(self.instance, "evidence", []))
        if result in {TechnicalDiagnosis.Result.NOT_REPAIRABLE, TechnicalDiagnosis.Result.NOT_VIABLE}:
            if len(justification.strip()) < 20:
                raise serializers.ValidationError({"technical_justification": "Debe tener al menos 20 caracteres."})
            if not evidence:
                raise serializers.ValidationError({"evidence": "Adjunta al menos una evidencia."})
        return attrs


class RetirementRequestSerializer(serializers.ModelSerializer):
    asset_code = serializers.CharField(source="asset.code", read_only=True)
    asset_display_code = serializers.SerializerMethodField()
    asset_name = serializers.CharField(source="asset.name", read_only=True)
    work_order_code = serializers.CharField(source="diagnosis.work_order_code", read_only=True)
    diagnosis_result = serializers.CharField(source="diagnosis.result", read_only=True)
    technical_justification = serializers.CharField(source="diagnosis.technical_justification", read_only=True)
    evidence = serializers.JSONField(source="diagnosis.evidence", read_only=True)
    evidence_previews = serializers.SerializerMethodField()
    estimated_repair_cost = serializers.DecimalField(source="diagnosis.estimated_repair_cost", max_digits=12, decimal_places=2, read_only=True)
    estimated_current_value = serializers.DecimalField(source="diagnosis.estimated_current_value", max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = RetirementRequest
        fields = "__all__"
        read_only_fields = ("code",)

    def get_asset_display_code(self, obj) -> str:
        return obj.asset.fm_code or obj.asset.code

    def get_evidence_previews(self, obj) -> list[dict]:
        order = WorkOrder.objects.filter(code=obj.diagnosis.work_order_code).first()
        if not order:
            return []
        request = self.context.get("request")
        previews = []
        for stage, label, slug in ((WorkOrderPhoto.Stage.START, "Antes", "inicio"), (WorkOrderPhoto.Stage.FINISH, "DespuÃ©s", "final")):
            if WorkOrderPhoto.objects.filter(work_order=order, stage=stage).exists():
                path = f"/api/v1/work-orders/{order.id}/photos/{slug}/"
                previews.append({"label": label, "url": request.build_absolute_uri(path) if request else path})
        return previews

    def validate(self, attrs):
        diagnosis = attrs.get("diagnosis", getattr(self.instance, "diagnosis", None))
        if not self.instance and diagnosis:
            if diagnosis.result not in {TechnicalDiagnosis.Result.NOT_REPAIRABLE, TechnicalDiagnosis.Result.NOT_VIABLE}:
                raise serializers.ValidationError("El diagnóstico no habilita una evaluación de baja.")
            if not diagnosis.evidence or len(diagnosis.technical_justification.strip()) < 20:
                raise serializers.ValidationError("El diagnóstico no tiene sustento completo.")
        status = attrs.get("status")
        if status == RetirementRequest.Status.PENDING_DISPOSAL:
            if not attrs.get("decision_reason") or not attrs.get("approved_method"):
                raise serializers.ValidationError("La aprobación requiere justificación y método de disposición.")
            attrs["decision_at"] = timezone.now()
        if status == RetirementRequest.Status.CLOSED:
            disposal = attrs.get("disposal")
            required = {"effectiveDate", "certificateNumber", "organization", "evidence", "qrDestroyed", "assignmentsClosed", "inventoryUpdated"}
            if not disposal or not required.issubset(disposal) or not disposal["evidence"]:
                raise serializers.ValidationError("El cierre requiere acta, evidencia y verificaciones completas.")
            if not all(disposal[key] for key in ("qrDestroyed", "assignmentsClosed", "inventoryUpdated")):
                raise serializers.ValidationError("Todas las verificaciones de cierre deben confirmarse.")
        return attrs

    @transaction.atomic
    def create(self, validated_data):
        year = timezone.now().year
        last = RetirementRequest.objects.filter(code__startswith=f"SOL-BAJA-{year}-").order_by("-code").first()
        number = int(last.code.rsplit("-", 1)[-1]) + 1 if last else 1
        validated_data["code"] = f"SOL-BAJA-{year}-{number:06d}"
        instance = super().create(validated_data)
        request = self.context.get("request")
        if request:
            record_audit(
                request=request,
                action="RETIREMENT_REQUEST_CREATED",
                entity="RetirementRequest",
                entity_id=instance.id,
                after={"code": instance.code, "status": instance.status},
            )
        queue_for_administrators(
            event='RETIREMENT_REQUEST_CREATED',
            subject=f'Solicitud de baja {instance.code}',
            body=(
                f'Se registró una solicitud de baja para el bien '
                f'{instance.asset.fm_code or instance.asset.code}.'
            ),
            entity=instance,
            discriminator=instance.status,
        )
        return instance

    @transaction.atomic
    def update(self, instance, validated_data):
        before = {"status": instance.status, "approved_method": instance.approved_method}
        instance = super().update(instance, validated_data)
        if instance.status == RetirementRequest.Status.CLOSED:
            instance.asset.administrative_status = "Dado de baja"
            instance.asset.operational_status = "No reparable"
            instance.asset.assignment_status = "Sin asignar"
            instance.asset.save(
                update_fields=(
                    "administrative_status",
                    "operational_status",
                    "assignment_status",
                )
            )
        request = self.context.get("request")
        if request:
            record_audit(
                request=request,
                action="RETIREMENT_REQUEST_UPDATED",
                entity="RetirementRequest",
                entity_id=instance.id,
                before=before,
                after={"status": instance.status, "approved_method": instance.approved_method},
            )
        if instance.status == RetirementRequest.Status.PENDING_DISPOSAL:
            queue_for_administrators(
                event='RETIREMENT_APPROVED',
                subject=f'Baja aprobada {instance.code}',
                body=(
                    f'La baja del bien {instance.asset.fm_code or instance.asset.code} '
                    'fue aprobada y requiere completar su disposición final.'
                ),
                entity=instance,
                discriminator=instance.status,
            )
        return instance
