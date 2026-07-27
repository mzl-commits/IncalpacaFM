
import uuid

from django.conf import settings
from django.db import models


class AuditEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.PROTECT
    )
    action = models.CharField(max_length=80)
    entity = models.CharField(max_length=80)
    entity_id = models.CharField(max_length=80)
    before = models.JSONField(null=True, blank=True)
    after = models.JSONField(null=True, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    correlation_id = models.UUIDField(default=uuid.uuid4, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ("-created_at",)

    def delete(self, *args, **kwargs):
        raise RuntimeError("Los eventos de auditoría son inmutables.")
