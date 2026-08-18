from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    recipientName = serializers.SerializerMethodField()
    recipientEmail = serializers.CharField(source='recipient_email', read_only=True)
    entityType = serializers.CharField(source='entity_type', read_only=True)
    entityId = serializers.CharField(source='entity_id', read_only=True)
    deliveryChannel = serializers.CharField(source='delivery_channel', read_only=True)
    availableAt = serializers.DateTimeField(source='available_at', read_only=True)
    sentAt = serializers.DateTimeField(source='sent_at', read_only=True)
    readAt = serializers.DateTimeField(source='read_at', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)
    almacenId = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = (
            'id', 'event', 'subject', 'body', 'recipientName', 'recipientEmail',
            'entityType', 'entityId', 'deliveryChannel', 'status', 'attempts', 'max_attempts',
            'availableAt', 'sentAt', 'readAt', 'last_error', 'createdAt', 'almacenId',
        )

    def get_recipientName(self, obj) -> str:
        return obj.recipient.get_full_name() or obj.recipient.username

    def get_almacenId(self, obj) -> int | None:
        # 1. Directamente desde el context de la notificación
        ctx = obj.context or {}
        if "almacenId" in ctx and ctx["almacenId"] is not None:
            try:
                return int(ctx["almacenId"])
            except (ValueError, TypeError):
                pass
        if "almacen_id" in ctx and ctx["almacen_id"] is not None:
            try:
                return int(ctx["almacen_id"])
            except (ValueError, TypeError):
                pass

        # 2. Según el perfil del receptor (si es ALMACENERO / INSPECTOR)
        profile = getattr(obj.recipient, "account_profile", None)
        if profile and profile.almacen_id:
            return profile.almacen_id

        # 3. Según la entidad relacionada
        if obj.entity_type and obj.entity_id:
            try:
                if obj.entity_type == "Material":
                    from apps.catalogo.models import Material
                    return Material.objects.filter(pk=obj.entity_id).values_list("almacen_id", flat=True).first()
                elif obj.entity_type == "GrupoSolicitud":
                    from apps.inventario.models import SolicitudMovimiento
                    return SolicitudMovimiento.objects.filter(grupo_id=obj.entity_id).values_list("material__almacen_id", flat=True).first()
                elif obj.entity_type == "SolicitudMovimiento":
                    from apps.inventario.models import SolicitudMovimiento
                    return SolicitudMovimiento.objects.filter(pk=obj.entity_id).values_list("material__almacen_id", flat=True).first()
                elif obj.entity_type == "Movimiento":
                    from apps.inventario.models import Movimiento
                    return Movimiento.objects.filter(pk=obj.entity_id).values_list("almacen_id", flat=True).first()
                elif obj.entity_type == "Inspeccion":
                    from apps.inspeccion.models import Inspeccion
                    return Inspeccion.objects.filter(pk=obj.entity_id).values_list("almacen_id", flat=True).first()
                elif obj.entity_type == "PlanInspeccionAnual":
                    from apps.inspeccion.models import PlanInspeccionAnual
                    return PlanInspeccionAnual.objects.filter(pk=obj.entity_id).values_list("almacen_id", flat=True).first()
            except Exception:
                pass

        # 4. Para eventos generales de Almacén/Inspección sin almacén explícito, retornar primer almacén activo si existe
        if obj.event in ("INSPECTION_OVERDUE", "INSPECTION_DUE_SOON", "STOCK_BAJO", "STOCK_AGOTADO", "NEW_INSPECTABLE_MATERIAL"):
            from apps.catalogo.models import Almacen
            primero = Almacen.objects.first()
            if primero:
                return primero.id

        return None
