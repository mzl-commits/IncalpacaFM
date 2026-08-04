from .models import PrivacyAcknowledgement, PrivacyNotice


def record_privacy_event(*, request, context: str, subject_reference: str = ""):
    """Guarda la versión vigente del aviso para un flujo que trata datos personales."""
    notice = PrivacyNotice.objects.filter(active=True, contexts__contains=[context]).order_by("-effective_from").first()
    if not notice:
        return None
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    return PrivacyAcknowledgement.objects.create(
        notice=notice,
        user=request.user if request.user.is_authenticated else None,
        context=context,
        subject_reference=subject_reference[:180],
        accepted=True,
        ip_address=(forwarded.split(",")[0].strip() if forwarded else request.META.get("REMOTE_ADDR")) or None,
        user_agent=request.META.get("HTTP_USER_AGENT", "")[:500],
    )
