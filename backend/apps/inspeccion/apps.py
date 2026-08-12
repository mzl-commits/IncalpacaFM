from django.apps import AppConfig


class InspeccionConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.inspeccion'

    def ready(self):
        import apps.inspeccion.signals  # noqa: F401
