
from django.contrib import admin

from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('event', 'recipient_email', 'status', 'attempts', 'created_at', 'sent_at')
    list_filter = ('status', 'event')
    search_fields = ('recipient_email', 'subject', 'entity_id')
    readonly_fields = ('id', 'dedupe_key', 'created_at', 'updated_at', 'message_id')
