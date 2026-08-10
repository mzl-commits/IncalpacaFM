from django.core.exceptions import ValidationError
from django.db import transaction

from .models import ReporterProfile, ReporterWorkerCode


def normalize_dni(value: str) -> str:
    dni = "".join(char for char in value.strip() if char.isdigit())
    if len(dni) != 8:
        raise ValidationError({"reporterDni": "Ingresa un DNI válido de 8 dígitos."})
    return dni


def normalize_worker_code(value: str) -> str:
    worker_code = value.strip().upper()
    if not worker_code:
        raise ValidationError({"reporterWorkerCode": "Ingresa tu código de trabajador."})
    return worker_code


@transaction.atomic
def register_reporter(*, dni: str, worker_code: str, full_name: str, email: str = ""):
    """Creates or refreshes a reporter identity without creating an auth account."""
    dni = normalize_dni(dni)
    worker_code = normalize_worker_code(worker_code)
    from apps.accounts.models import AccountProfile
    from apps.notifications.services import queue_for_administrators
    if AccountProfile.objects.filter(worker_code__iexact=worker_code).exists():
        queue_for_administrators(event="DUPLICATE_WORKER_IDENTITY", subject="Código duplicado en reporte", body=f"El código {worker_code} ya pertenece a un usuario del sistema.", discriminator=f"reporter-worker:{worker_code}")
        raise ValidationError({"reporterWorkerCode": "Este código ya pertenece a un usuario del sistema."})
    reporter, created = ReporterProfile.objects.select_for_update().get_or_create(
        dni=dni,
        defaults={"full_name": full_name.strip(), "email": email.strip()},
    )
    if not created:
        updates = []
        if full_name.strip() and reporter.full_name != full_name.strip():
            reporter.full_name = full_name.strip()
            updates.append("full_name")
        if email.strip() and reporter.email != email.strip():
            reporter.email = email.strip()
            updates.append("email")
        reporter.save(update_fields=[*updates, "last_reported_at"])

    code = ReporterWorkerCode.objects.select_for_update().filter(worker_code=worker_code).first()
    if code and code.reporter_id != reporter.id:
        queue_for_administrators(event="DUPLICATE_WORKER_IDENTITY", subject="Código duplicado en reportantes", body=f"El código {worker_code} fue asociado a más de un reportante.", discriminator=f"reporter-worker:{worker_code}")
        raise ValidationError({
            "reporterWorkerCode": "Este código ya está asociado a otro historial de reportante."
        })
    if code is None:
        ReporterWorkerCode.objects.create(reporter=reporter, worker_code=worker_code)
    else:
        code.active = True
        code.save(update_fields=("active", "last_seen_at"))
    return reporter
