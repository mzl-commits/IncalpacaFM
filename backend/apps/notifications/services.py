import hashlib
from html import escape

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone
from django.db.models import Q

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

def queue_for_roles(
    *, event, roles, subject, body, entity=None, context=None, discriminator='',
    delivery_channel=Notification.DeliveryChannel.BOTH, almacen=None,
):
    """Encola una notificación para todos los usuarios activos de los roles dados.

    Si `almacen` viene dado, los roles con alcance de almacén (Almacenero,
    Inspector) solo reciben la notificación si su account_profile.almacen
    coincide — Administrador nunca se filtra por almacén, igual que en
    AlmacenScopedMixin.

    Si el canal es BOTH pero el usuario no tiene email, degrada a SYSTEM para
    que al menos reciba la notificación en la bandeja interna.
    """
    users = get_user_model().objects.filter(
        is_active=True,
        account_profile__active=True,
        account_profile__role__in=roles,
    )
    if almacen is not None:
        almacen_id = almacen.pk if hasattr(almacen, "pk") else almacen
        users = users.filter(
            Q(account_profile__role=AccountProfile.Role.ADMIN)
            | Q(account_profile__almacen_id=almacen_id)
        )
    result = []
    for user in users:
        # Si el canal requiere email pero el usuario no lo tiene, degrada a SISTEMA
        effective_channel = delivery_channel
        if (
            delivery_channel == Notification.DeliveryChannel.BOTH
            and not (user.email or '').strip()
        ):
            effective_channel = Notification.DeliveryChannel.SYSTEM
        result.append(
            queue_notification(
                event=event,
                recipient=user,
                subject=subject,
                body=body,
                entity=entity,
                context=context,
                discriminator=discriminator,
                delivery_channel=effective_channel,
            )
        )
    return result


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