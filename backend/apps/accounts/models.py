import uuid
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import models


class AccountProfile(models.Model):
    class Role(models.TextChoices):
        ADMIN = "ADMINISTRADOR", "Administrador / FM"
        TECHNICIAN = "TECNICO", "Técnico"
        SUPERVISOR = "SUPERVISOR", "Supervisor"
        REQUESTER = "SOLICITANTE", "Solicitante"
        ALMACENERO = "ALMACENERO", "Almacenero"
        INSPECTOR = "INSPECTOR", "Inspector"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        get_user_model(), related_name="account_profile", on_delete=models.CASCADE
    )
    worker_code = models.CharField(max_length=40, unique=True)
    dni = models.CharField(max_length=8, blank=True, default="", db_index=True)
    role = models.CharField(max_length=20, choices=Role.choices)
    specialty = models.CharField(max_length=100, blank=True)
    position = models.CharField(max_length=100, blank=True, default="")
    hourly_rate = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    must_change_password = models.BooleanField(default=True)
    failed_attempts = models.PositiveSmallIntegerField(default=0)
    blocked_until = models.DateTimeField(null=True, blank=True)
    active = models.BooleanField(default=True)
    last_access = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.worker_code} · {self.get_role_display()}"

    def register_worker_code(self, code: str) -> None:
        """Conserva códigos alternativos de una misma persona (DNI es la identidad principal)."""
        normalized = code.strip().upper()
        if normalized and normalized != self.worker_code:
            AccountWorkerCode.objects.get_or_create(profile=self, code=normalized)


class AccountWorkerCode(models.Model):
    """Alias de código laboral para un único perfil identificado por DNI."""

    profile = models.ForeignKey(AccountProfile, related_name="worker_code_aliases", on_delete=models.CASCADE)
    code = models.CharField(max_length=40, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("code",)

    def save(self, *args, **kwargs):
        self.code = self.code.strip().upper()
        super().save(*args, **kwargs)
