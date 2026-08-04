import uuid

from .models import AuditEvent


def record_audit(*, request, action, entity, entity_id, before=None, after=None):
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    ip_address = (forwarded.split(",")[0].strip() if forwarded else request.META.get("REMOTE_ADDR")) or None
    correlation = request.headers.get("X-Correlation-ID")
    try:
        correlation_id = uuid.UUID(correlation) if correlation else uuid.uuid4()
    except ValueError:
        correlation_id = uuid.uuid4()
    return AuditEvent.objects.create(
        actor=request.user if request.user.is_authenticated else None,
        action=action,
        entity=entity,
        entity_id=str(entity_id),
        before=before,
        after=after,
        ip_address=ip_address,
        correlation_id=correlation_id,
    )
