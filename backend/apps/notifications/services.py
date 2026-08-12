import hashlib
from html import escape

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import AccountProfile

from .models import Notification


def daily_discriminator(base):
    """Componente de discriminador que cambia una vez al día, para que un
    resumen agregado (sin entidad puntual) se re-encole con datos frescos
    en cada corrida diaria en vez de quedar pegado al primer envío."""
    return f"{base}-{timezone.localdate().isoformat()}"


def _dedupe_key(event, recipient, entity, discriminator):
    source = ':'.join((
        event,
        str(recipient.id),
        entity.__class__.__name__ if entity else '',
        str(entity.pk) if entity else '',
        discriminator,
    ))
    return hashlib.sha256(source.encode()).hexdigest()


def queue_notification(
    *, event, recipient, subject, body, entity=None, context=None, discriminator='', recipient_email=None,
    delivery_channel=Notification.DeliveryChannel.BOTH,
):
    email = (recipient_email if recipient_email is not None else recipient.email or '').strip()
    if not recipient.is_active:
        return None
    if delivery_channel in {Notification.DeliveryChannel.EMAIL, Notification.DeliveryChannel.BOTH} and not email:
        return None
    system_only = delivery_channel == Notification.DeliveryChannel.SYSTEM
    notification, created = Notification.objects.get_or_create(
        dedupe_key=_dedupe_key(event, recipient, entity, discriminator),
        defaults={
            'recipient': recipient,
            'recipient_email': email,
            'event': event,
            'delivery_channel': delivery_channel,
            'subject': subject,
            'body': body,
            'html_body': f'<p>{escape(body)}</p>',
            'context': context or {},
            'entity_type': entity.__class__.__name__ if entity else '',
            'entity_id': str(entity.pk) if entity else '',
            'available_at': timezone.now(),
            'status': Notification.Status.SENT if system_only else Notification.Status.PENDING,
            'sent_at': timezone.now() if system_only else None,
        },
    )
    if created and not system_only and settings.NOTIFICATION_DISPATCH_ENABLED:
        transaction.on_commit(lambda: _dispatch_async(notification.id))
    return notification


def queue_incident_requester(*, event, incident, subject, body, discriminator=''):
    """Queue a milestone email for the person who reported an incident.

    Public QR reports use a technical requester account, so their real address
    is kept in ``reporter_email``. Authenticated reports use the account email.
    """
    contact_email = (incident.requester_contact or {}).get('email', '')
    recipient_email = (
        incident.reporter_email or contact_email
        if incident.public_submission or contact_email
        else incident.requester.email
    )
    return queue_notification(
        event=event,
        recipient=incident.requester,
        recipient_email=recipient_email,
        subject=subject,
        body=body,
        entity=incident,
        context={'incidentCode': incident.code},
        discriminator=discriminator,
    )


def _dispatch_async(notification_id):
    try:
        from .tasks import send_notification_task
        send_notification_task.delay(str(notification_id))
    except Exception:
        # The outbox remains pending and is visible for a later retry.
        return


def queue_for_roles(*, event, roles, subject, body, entity=None, context=None, discriminator=''):
    users = get_user_model().objects.filter(
        is_active=True,
        account_profile__active=True,
        account_profile__role__in=roles,
    ).exclude(email='')
    return [
        queue_notification(
            event=event,
            recipient=user,
            subject=subject,
            body=body,
            entity=entity,
            context=context,
            discriminator=discriminator,
        )
        for user in users
    ]


def queue_for_administrators(*, event, subject, body, entity=None, context=None, discriminator=''):
    return queue_for_roles(
        event=event,
        roles=[AccountProfile.Role.ADMIN],
        subject=subject,
        body=body,
        entity=entity,
        context=context,
        discriminator=discriminator,
    )

def weekly_discriminator(base):
    """Componente de discriminador que cambia una vez por semana (ISO week),
    para que un resumen agregado se re-encole con datos frescos solo
    semanalmente en vez de diario."""
    year, week, _ = timezone.localdate().isocalendar()
    return f"{base}-{year}-W{week:02d}"