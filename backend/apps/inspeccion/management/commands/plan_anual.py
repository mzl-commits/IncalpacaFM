from datetime import date

from django.core.management.base import BaseCommand

from apps.inspeccion.planificacion import construir_materiales_config, generar_plan_anual


class Command(BaseCommand):
    help = "Genera el plan de inspección anual, escalonando fechas por material/pieza"

    def add_arguments(self, parser):
        parser.add_argument("anio", type=int, nargs="?", default=date.today().year)

    def handle(self, *args, **options):
        anio = options["anio"]
        fecha_inicio = date(anio, 1, 1)

        materiales_config = construir_materiales_config()

        plan, creadas = generar_plan_anual(anio, fecha_inicio, materiales_config)
        self.stdout.write(self.style.SUCCESS(f"Plan {anio}: {len(creadas)} programaciones creadas."))