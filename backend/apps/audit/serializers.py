from rest_framework import serializers

from .models import AuditEvent


class AuditEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditEvent
        fields = "__all__"
        read_only_fields = fields

    def get_actor_name(self, obj):
        return obj.actor.get_full_name() or obj.actor.username if obj.actor else "Sistema"
