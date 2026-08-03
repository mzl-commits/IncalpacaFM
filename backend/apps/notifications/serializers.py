from rest_framework import serializers

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    recipientName = serializers.SerializerMethodField()
    recipientEmail = serializers.CharField(source='recipient_email', read_only=True)
    entityType = serializers.CharField(source='entity_type', read_only=True)
    entityId = serializers.CharField(source='entity_id', read_only=True)
    availableAt = serializers.DateTimeField(source='available_at', read_only=True)
    sentAt = serializers.DateTimeField(source='sent_at', read_only=True)
    readAt = serializers.DateTimeField(source='read_at', read_only=True)
    createdAt = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = Notification
        fields = (
            'id', 'event', 'subject', 'body', 'recipientName', 'recipientEmail',
            'entityType', 'entityId', 'status', 'attempts', 'max_attempts',
            'availableAt', 'sentAt', 'readAt', 'last_error', 'createdAt',
        )

    def get_recipientName(self, obj) -> str:
        return obj.recipient.get_full_name() or obj.recipient.username
