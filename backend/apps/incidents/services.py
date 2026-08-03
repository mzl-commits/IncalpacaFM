from django.conf import settings
from django.core.mail import send_mail
from django.template.defaultfilters import truncatechars


def build_tracking_url(incident) -> str:
    base_url = settings.PUBLIC_FRONTEND_URL.rstrip("/")
    return f"{base_url}/seguimiento-solicitud/{incident.code}"


def send_public_request_confirmation(incident) -> bool:
    email = incident.requester_contact.get("email", "").strip()
    name = incident.requester_contact.get("name", "").strip() or "solicitante"
    if not email:
        return False

    tracking_url = build_tracking_url(incident)
    subject = f"Solicitud registrada {incident.code}"
    message = "\n".join(
        [
            f"Hola {name},",
            "",
            "Tu solicitud de mantenimiento fue registrada correctamente.",
            f"Codigo de solicitud: {incident.code}",
            f"Seguimiento: {tracking_url}",
            "",
            "Resumen:",
            truncatechars(incident.description, 220),
            "",
            "El administrador revisara la prioridad final y actualizara el avance cuando corresponda.",
        ]
    )

    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[email],
        fail_silently=False,
    )
    return True