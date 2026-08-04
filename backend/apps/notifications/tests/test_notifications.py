from django.contrib.auth import get_user_model
from django.core import mail
from django.test import TestCase, override_settings

from apps.accounts.models import AccountProfile
from apps.incidents.models import Incident
from apps.notifications.models import Notification
from apps.notifications.services import queue_incident_requester, queue_notification
from apps.notifications.tasks import deliver_notification


@override_settings(
    EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend',
    DEFAULT_FROM_EMAIL='SGTB Incalpaca <noreply@incalpaca.test>',
    NOTIFICATION_DISPATCH_ENABLED=False,
)
class NotificationDeliveryTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create_user(
            username='planner-notify',
            email='planner@incalpaca.test',
        )
        AccountProfile.objects.create(
            user=self.user,
            worker_code='PLANNER-NOTIFY',
            role=AccountProfile.Role.ADMIN,
            must_change_password=False,
        )

    def test_queues_and_delivers_an_email_without_blocking_the_event(self):
        notification = queue_notification(
            event='INCIDENT_CREATED',
            recipient=self.user,
            subject='Nueva incidencia SOL-2026-0001',
            body='Se recibió una incidencia para revisar.',
            discriminator='SOL-2026-0001',
        )

        self.assertIsNotNone(notification)
        self.assertEqual(notification.status, Notification.Status.PENDING)

        outcome, attempts = deliver_notification(notification.id)
        notification.refresh_from_db()

        self.assertEqual(outcome, 'done')
        self.assertEqual(attempts, 1)
        self.assertEqual(notification.status, Notification.Status.SENT)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, ['planner@incalpaca.test'])

    def test_repeated_event_uses_the_same_outbox_record(self):
        first = queue_notification(
            event='INCIDENT_CREATED', recipient=self.user,
            subject='Nueva incidencia', body='Revisar.', discriminator='incident-1',
        )
        repeated = queue_notification(
            event='INCIDENT_CREATED', recipient=self.user,
            subject='Nueva incidencia', body='Revisar.', discriminator='incident-1',
        )

        self.assertEqual(first.id, repeated.id)
        self.assertEqual(Notification.objects.count(), 1)

    def test_public_reporter_receives_key_milestone_at_reporter_email(self):
        incident = Incident.objects.create(
            code='SOL-2026-PUBLIC-0001',
            requester=self.user,
            reporter_name='Visitante',
            reporter_email='visitante@example.com',
            public_submission=True,
            request_type='FALLA',
            description='El equipo presenta un comportamiento inusual.',
        )

        notification = queue_incident_requester(
            event='INCIDENT_RECEIVED',
            incident=incident,
            subject='Recibimos tu reporte',
            body='Tu reporte ya se encuentra en evaluación.',
            discriminator=incident.status,
        )
        deliver_notification(notification.id)

        self.assertEqual(notification.recipient_email, 'visitante@example.com')
        self.assertEqual(mail.outbox[0].to, ['visitante@example.com'])
