"""
Management command: actualizar_frecuencia_herramientas

Actualiza periodicidad_valor/periodicidad_unidad de los materiales YA
EXISTENTES en la categoría 'Herramientas', según su subcategoría:
    - Manuales               -> 3 meses
    - Inalámbrica / Eléctrica -> 2 meses
    - cualquier otra subcategoría de Herramientas -> sin cambios

No crea materiales nuevos ni toca otras categorías. Usa Material.save()
para que periodicidad_inspeccion_dias se recalcule automáticamente.

Uso:
    python manage.py actualizar_frecuencia_herramientas          # dry-run
    python manage.py actualizar_frecuencia_herramientas --confirmar
"""
from django.core.management.base import BaseCommand

from apps.catalogo.models import Material

REGLAS = {
    "Manuales": (3, "meses"),
    "Inalámbrica": (2, "meses"),
    "Eléctrica": (2, "meses"),
}


class Command(BaseCommand):
    help = "Actualiza la frecuencia de inspección de materiales existentes de Herramientas."

    def add_arguments(self, parser):
        parser.add_argument(
            "--confirmar", action="store_true",
            help="Ejecuta el guardado real. Sin este flag solo se simula (dry-run).",
        )

    def handle(self, *args, **options):
        confirmar = options["confirmar"]
        total_tocados = 0

        for subcat_nombre, (valor, unidad) in REGLAS.items():
            qs = Material.objects.filter(
                subcategoria__categoria__nombre="Herramientas",
                subcategoria__nombre=subcat_nombre,
            )
            self.stdout.write(f"\nSubcategoría '{subcat_nombre}' -> {valor} {unidad} ({qs.count()} materiales)")

            for mat in qs:
                cambia = (mat.periodicidad_valor != valor) or (mat.periodicidad_unidad != unidad)
                marca = "CAMBIA" if cambia else "sin cambio"
                self.stdout.write(
                    f"  - {mat.codigo} · {mat.nombre}: "
                    f"{mat.periodicidad_valor} {mat.periodicidad_unidad} -> {valor} {unidad} [{marca}]"
                )
                if cambia:
                    total_tocados += 1
                    if confirmar:
                        mat.periodicidad_valor = valor
                        mat.periodicidad_unidad = unidad
                        mat.save()  # recalcula periodicidad_inspeccion_dias en save()

        if not confirmar:
            self.stdout.write(self.style.WARNING(
                f"\nSIMULACIÓN. {total_tocados} material(es) cambiarían. "
                "Corre de nuevo con --confirmar para guardar de verdad."
            ))
        else:
            self.stdout.write(self.style.SUCCESS(f"\nListo. {total_tocados} material(es) actualizados."))