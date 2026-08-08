import uuid

from django.db import models


class ReporterProfile(models.Model):
    """Identity record for a person who submits reports without a user account."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    dni = models.CharField(max_length=12, unique=True, db_index=True)
    full_name = models.CharField(max_length=160)
    email = models.EmailField(blank=True)
    first_reported_at = models.DateTimeField(auto_now_add=True)
    last_reported_at = models.DateTimeField(auto_now=True)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ("full_name",)

    def __str__(self):
        return f"{self.full_name} ({self.dni})"


class ReporterWorkerCode(models.Model):
    """Historical worker-code assignments declared by a report requester."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    reporter = models.ForeignKey(
        ReporterProfile, related_name="worker_codes", on_delete=models.PROTECT
    )
    worker_code = models.CharField(max_length=40, unique=True, db_index=True)
    first_seen_at = models.DateTimeField(auto_now_add=True)
    last_seen_at = models.DateTimeField(auto_now=True)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ("-last_seen_at",)

    def __str__(self):
        return self.worker_code
