from datetime import timedelta
from email.utils import make_msgid

from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import transaction
from django.utils import timezone

from .models import Notification
from .monitoring import evaluate_all_work_order_alerts


def deliver_notification(notification_id):
    with transaction.atomic():
        notification = Notification.objects.select_for_update().get(pk=notification_id)
        if notification.status in {Notification.Status.SENT, Notification.Status.CANCELLED}:
            return 'done', notification.attempts
        if notification.available_at > timezone.now():
            return 'retry', notification.attempts
        notification.attempts += 1
        notification.save(update_fields=('attempts', 'updated_at'))

    try:
        message_id = make_msgid(domain=settings.NOTIFICATION_MESSAGE_ID_DOMAIN)
        message = EmailMultiAlternatives(
            subject=notification.subject,
            body=notification.body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[notification.recipient_email],
            headers={'Message-ID': message_id},
        )
        if notification.html_body:
            message.attach_alternative(notification.html_body, 'text/html')
        message.send(fail_silently=False)
    except Exception as exc:
        with transaction.atomic():
            notification = Notification.objects.select_for_update().get(pk=notification_id)
            notification.last_error = str(exc)[:500]
            if notification.attempts >= notification.max_attempts:
                notification.status = Notification.Status.ERROR
                outcome = 'done'
            else:
                notification.status = Notification.Status.PENDING
                notification.available_at = timezone.now() + timedelta(minutes=2 ** notification.attempts)
                outcome = 'retry'
            notification.save(update_fields=('status', 'last_error', 'available_at', 'updated_at'))
        return outcome, notification.attempts

    with transaction.atomic():
        notification = Notification.objects.select_for_update().get(pk=notification_id)
        notification.status = Notification.Status.SENT
        notification.sent_at = timezone.now()
        notification.message_id = message_id
        notification.last_error = ''
        notification.save(update_fields=('status', 'sent_at', 'message_id', 'last_error', 'updated_at'))
    return 'done', notification.attempts


@shared_task(bind=True, max_retries=2)
def send_notification_task(self, notification_id):
    outcome, attempts = deliver_notification(notification_id)
    if outcome == 'retry':
        raise self.retry(countdown=2 ** attempts * 60)
    return outcome


@shared_task
def evaluate_work_order_alerts_task():
    evaluate_all_work_order_alerts()
    return "done"
