from datetime import date
from django.core.management.base import BaseCommand, CommandError

from apps.catalogo.models import Almacen
from apps.inspeccion.planificacion import generar_plan_anual, construir_materiales_config


class Command(BaseCommand):
    help = "Genera el plan de inspección anual, escalonando fechas por material/pieza"

    def add_arguments(self, parser):
        parser.add_argument("anio", type=int, nargs="?", default=date.today().year)
        # NUEVO Fase 6: el plan es por almacén. Sin --almacen, corre para
        # todos los almacenes activos, uno por uno.
        parser.add_argument(
            "--almacen",
            type=str,
            default=None,
            help="Código del almacén (ej. ALM-HERR). Si no se indica, genera el plan para todos los almacenes activos.",
        )

    def handle(self, *args, **options):
        anio = options["anio"]
        fecha_inicio = date(anio, 1, 1)
        codigo_almacen = options["almacen"]

        if codigo_almacen:
            try:
                almacenes = [Almacen.objects.get(codigo=codigo_almacen)]
            except Almacen.DoesNotExist:
                raise CommandError(f"No existe un almacén con código '{codigo_almacen}'.")
        else:
            almacenes = list(Almacen.objects.filter(activo=True))
            if not almacenes:
                raise CommandError("No hay almacenes activos.")

        for almacen in almacenes:
            materiales_config = construir_materiales_config(almacen)
            plan, creadas = generar_plan_anual(anio, fecha_inicio, materiales_config, almacen)
            self.stdout.write(self.style.SUCCESS(
                f"Plan {anio} — {almacen.nombre}: {len(creadas)} programaciones creadas."
            ))