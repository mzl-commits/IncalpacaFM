"""Report legacy locations that require explicit reconciliation.

This command is deliberately read-only. The institutional location catalogue
contains duplicate codes and incomplete paths, so an automatic backfill would
be unsafe for assets, maps and historical assignments.
"""

from collections import Counter

from django.core.management.base import BaseCommand
from django.db.models import Q

from apps.assets.models import Location


class Command(BaseCommand):
    help = "Audita ubicaciones históricas antes de conciliarlas con el árbol espacial."

    def handle(self, *args, **options):
        locations = Location.objects.all()
        total = locations.count()
        linked = locations.filter(space_node__isnull=False).count()
        unlinked = locations.filter(space_node__isnull=True)
        incomplete = unlinked.filter(
            Q(site="") | Q(level="") | Q(location_code="")
        ).count()
        duplicate_codes = [
            code
            for code, count in Counter(
                unlinked.exclude(location_code="").values_list("location_code", flat=True)
            ).items()
            if count > 1
        ]

        self.stdout.write(f"Ubicaciones históricas: {total}")
        self.stdout.write(f"Vinculadas al árbol espacial: {linked}")
        self.stdout.write(f"Pendientes de conciliación: {unlinked.count()}")
        self.stdout.write(f"Pendientes con sede, nivel o código incompleto: {incomplete}")
        self.stdout.write(f"Códigos duplicados entre pendientes: {len(duplicate_codes)}")
        if duplicate_codes:
            preview = ", ".join(sorted(duplicate_codes)[:20])
            self.stdout.write(self.style.WARNING(f"Ejemplos: {preview}"))
        self.stdout.write(
            self.style.SUCCESS(
                "No se modificó ningún registro. Conciliar manualmente antes de enlazar ubicaciones históricas."
            )
        )
