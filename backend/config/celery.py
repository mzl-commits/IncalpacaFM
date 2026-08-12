import os

from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

app = Celery('incalpaca_fm')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()
app.conf.beat_schedule = {
    'evaluate-work-order-alerts': {
        'task': 'apps.notifications.tasks.evaluate_work_order_alerts_task',
        'schedule': 900.0,
    },
    'evaluate-operational-health': {
        'task': 'apps.notifications.tasks.evaluate_operational_health_task',
        'schedule': 900.0,
    },
    'evaluate-inspection-alerts': {
        'task': 'apps.notifications.tasks.evaluate_inspection_alerts_task',
        'schedule': 86400.0,  # once a day
    },
}
