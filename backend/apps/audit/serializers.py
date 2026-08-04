from rest_framework import serializers

from .models import AuditEvent


class AuditEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditEvent
        fields = (
            "id",
            "actor",
            "actor_name",
            "action",
            "entity",
            "entity_id",
            "before",
            "after",
            "ip_address",
            "correlation_id",
            "created_at",
        )
        read_only_fields = fields

    def get_actor_name(self, obj) -> str:
        return obj.actor.get_full_name() or obj.actor.username if obj.actor else "Sistema"
