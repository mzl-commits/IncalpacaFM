"""Carga únicamente los catálogos institucionales necesarios para operar Incalpaca."""

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import transaction

from apps.assets.models import BuildingArea, Location
from apps.taxonomy.services import sync_taxonomy_catalog


class Command(BaseCommand):
    help = (
        "Inicializa taxonomía y ambientes oficiales de Incalpaca. "
        "No crea usuarios, técnicos, bienes, stock ni órdenes de demostración."
    )

    @transaction.atomic
    def handle(self, *args, **options):
        taxonomies = sync_taxonomy_catalog()
        self.stdout.write(f"Taxonomías institucionales sincronizadas: {len(taxonomies)}.")

        # El catálogo de ambientes conserva su fuente, capacidad y m² oficiales.
        call_command("sync_taxonomy_locations", verbosity=0)

        building_rows = (
            Location.objects.filter(active=True)
            .values("site", "zone", "building")
            .distinct()
        )
        created = 0
        for row in building_rows:
            _building, was_created = BuildingArea.objects.get_or_create(
                site=row["site"], zone=row["zone"], building=row["building"],
            )
            created += int(was_created)

        self.stdout.write(self.style.SUCCESS(
            "Base institucional de Incalpaca lista: "
            f"{len(taxonomies)} taxonomías, {Location.objects.filter(active=True).count()} ambientes "
            f"y {building_rows.count()} edificios ({created} superficies creadas sin m² declarado)."
        ))
        self.stdout.write(self.style.WARNING(
            "No se cargaron cuentas, técnicos, bienes, stock, reportes ni órdenes. "
            "Para datos de demostración usa explícitamente: python manage.py seed_demo_data"
        ))
