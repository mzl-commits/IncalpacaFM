"""
Management command: reiniciar_plan_desde_julio

Elimina las programaciones PENDIENTES del plan actual y regenera el calendario
de inspección anual tomando como fecha de inicio el 22 de julio de 2026
(tal como lo planificó el equipo al comenzar a usar el sistema).

Uso:
    python manage.py reiniciar_plan_desde_julio
    python manage.py reiniciar_plan_desde_julio --almacen ALM-HERR
    python manage.py reiniciar_plan_desde_julio --max-por-dia 5
    python manage.py reiniciar_plan_desde_julio --fecha-inicio 2026-07-22
"""
from datetime import date
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction

from apps.catalogo.models import Almacen
from apps.inspeccion.models import PlanInspeccionAnual, ProgramacionInspeccion
from apps.inspeccion.planificacion import generar_plan_anual, construir_materiales_config


class Command(BaseCommand):
    help = (
        "Elimina las programaciones PENDIENTES del plan anual y las regenera "
        "distribuyendo uniformemente desde una fecha de inicio (por defecto 22/07/2026), "
        "respetando un máximo de inspecciones por día laborable."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--anio", type=int, default=date.today().year,
            help="Año del plan a reiniciar (por defecto el año actual).",
        )
        parser.add_argument(
            "--almacen", type=str, default=None,
            help="Código del almacén (ej. ALM-HERR). Si se omite, reinicia todos los almacenes activos.",
        )
        parser.add_argument(
            "--fecha-inicio", type=str, default="2026-07-22",
            help="Fecha de inicio del plan en formato YYYY-MM-DD (por defecto 2026-07-22).",
        )
        parser.add_argument(
            "--max-por-dia", type=int, default=5,
            help="Máximo de inspecciones por día laborable (por defecto 5).",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        anio = options["anio"]
        codigo_almacen = options["almacen"]
        max_por_dia = options["max_por_dia"]

        # Parsear fecha de inicio
        try:
            fecha_inicio = date.fromisoformat(options["fecha_inicio"])
        except ValueError:
            raise CommandError(
                f"Formato de fecha inválido: '{options['fecha_inicio']}'. Use YYYY-MM-DD."
            )

        # Resolver almacenes
        if codigo_almacen:
            try:
                almacenes = [Almacen.objects.get(codigo=codigo_almacen)]
            except Almacen.DoesNotExist:
                raise CommandError(f"No existe un almacén con código '{codigo_almacen}'.")
        else:
            almacenes = list(Almacen.objects.filter(activo=True))
            if not almacenes:
                raise CommandError("No hay almacenes activos registrados.")

        for almacen in almacenes:
            self.stdout.write(f"\n[...] Reiniciando plan {anio} para: {almacen.nombre}")

            # 1. Obtener el plan existente (si existe)
            try:
                plan = PlanInspeccionAnual.objects.get(anio=anio, almacen=almacen)
                pendientes_qs = ProgramacionInspeccion.objects.filter(
                    plan=plan, estado="pendiente"
                )
                n_eliminadas = pendientes_qs.count()
                pendientes_qs.delete()
                self.stdout.write(
                    self.style.WARNING(f"  - {n_eliminadas} programaciones pendientes eliminadas.")
                )

                # Actualizar fecha de inicio del plan
                plan.fecha_inicio = fecha_inicio
                plan.save(update_fields=["fecha_inicio"])

            except PlanInspeccionAnual.DoesNotExist:
                # No había plan — se creará uno nuevo dentro de generar_plan_anual
                self.stdout.write(
                    self.style.WARNING(f"  AVISO: No existia plan para {anio}. Se creara uno nuevo.")
                )

            # 2. Construir la config de materiales e inspeccionar
            materiales_config = construir_materiales_config(almacen)
            if not materiales_config:
                self.stdout.write(
                    self.style.WARNING(f"  AVISO: No hay materiales inspeccionables en este almacen.")
                )
                continue

            # 3. Regenerar el plan con la nueva fecha de inicio y límite diario
            _, creadas = generar_plan_anual(
                anio, fecha_inicio, materiales_config, almacen,
                max_por_dia=max_por_dia,
            )

            self.stdout.write(
                self.style.SUCCESS(
                    f"  OK: {len(creadas)} programaciones creadas"
                    f" (desde {fecha_inicio.strftime('%d/%m/%Y')}"
                    f", max. {max_por_dia}/dia)."
                )
            )

        self.stdout.write(self.style.SUCCESS("\nPlan reiniciado correctamente."))
