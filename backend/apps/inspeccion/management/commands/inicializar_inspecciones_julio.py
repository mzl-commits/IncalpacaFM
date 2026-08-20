# backend/apps/inspeccion/management/commands/inicializar_inspecciones_julio.py

from datetime import date, datetime
from dateutil.relativedelta import relativedelta
from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from apps.catalogo.models import Material, Pieza
from apps.inspeccion.models import (
    Inspeccion,
    ProgramacionInspeccion,
    RespuestaCriterio,
)

User = get_user_model()


class Command(BaseCommand):
    help = (
        "Registra la inspección inicial masiva del 21 de Julio de 2026 para todas "
        "las herramientas activas e inicializa las siguientes programaciones periódicas."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Simula la creación sin guardar en la base de datos.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        fecha_base = date(2026, 7, 21)
        anio_actual = fecha_base.year
        
        fecha_dt_aware = timezone.make_aware(
            datetime.combine(fecha_base, datetime.min.time())
        )

        # 1. Inspector
        inspector = User.objects.filter(is_superuser=True).first() or User.objects.first()
        if not inspector:
            self.stdout.write(self.style.ERROR("Error: No existe ningún usuario en el sistema para asignar como inspector."))
            return

        # 2. Obtener el modelo del Plan vinculado a ProgramacionInspeccion
        PlanModel = ProgramacionInspeccion._meta.get_field("plan").remote_field.model

        # 3. Materiales inspeccionables
        materiales_validos = Material.objects.inspeccionables().select_related(
            "almacen", "subcategoria", "subcategoria__plantilla_inspeccion"
        )
        self.stdout.write(f"Procesando {materiales_validos.count()} materiales inspeccionables...")

        creadas_inspecciones = 0
        creadas_programaciones = 0

        # Cache de planes por almacén
        planes_cache = {}

        with transaction.atomic():
            for material in materiales_validos:
                plantilla = material.subcategoria.plantilla_inspeccion
                if not plantilla:
                    continue

                almacen = material.almacen

                # Obtener o crear el Plan del año para este almacén
                if almacen.id not in planes_cache:
                    plan_obj = None
                    # Si el modelo Plan tiene campo almacen y anio
                    try:
                        plan_obj, _ = PlanModel.objects.get_or_create(
                            almacen=almacen,
                            anio=anio_actual,
                            defaults={"descripcion": f"Plan Anual de Inspecciones {anio_actual} - {almacen.nombre}"}
                        )
                    except Exception:
                        try:
                            plan_obj, _ = PlanModel.objects.get_or_create(
                                anio=anio_actual,
                                defaults={"descripcion": f"Plan Anual de Inspecciones {anio_actual}"}
                            )
                        except Exception:
                            plan_obj = PlanModel.objects.first()
                    
                    planes_cache[almacen.id] = plan_obj

                plan_actual = planes_cache[almacen.id]
                criterios = list(plantilla.criterios.all())

                # Frecuencia en meses y periodicidad en días
                frecuencia_meses = getattr(material, "frecuencia_uso_meses", None) or 3
                periodicidad_dias = frecuencia_meses * 30
                proxima_fecha = fecha_base + relativedelta(months=frecuencia_meses)

                # A) Control individual por piezas
                if material.control_individual:
                    piezas = material.piezas.exclude(estado="Baja")
                    for pieza in piezas:
                        if Inspeccion.objects.filter(pieza=pieza, fecha__date=fecha_base).exists():
                            continue

                        if not dry_run:
                            # 1. Crear Inspección Realizada del 21 de Julio
                            insp = Inspeccion.objects.create(
                                inspector=inspector,
                                tipo="individual",
                                almacen=almacen,
                                material=material,
                                pieza=pieza,
                                plantilla=plantilla,
                                resultado_general="apta",
                                accion_tomada="continua_servicio",
                                observaciones="Inspección inicial periódica de planta.",
                                proxima_inspeccion=proxima_fecha,
                            )
                            Inspeccion.objects.filter(pk=insp.pk).update(fecha=fecha_dt_aware)

                            for crit in criterios:
                                RespuestaCriterio.objects.create(
                                    inspeccion=insp,
                                    criterio=crit,
                                    valor="cumple",
                                )

                            # 2. Siguiente programación vinculada al Plan
                            ProgramacionInspeccion.objects.get_or_create(
                                material=material,
                                pieza=pieza,
                                fecha_programada=proxima_fecha,
                                defaults={
                                    "plan": plan_actual,
                                    "estado": "pendiente",
                                    "periodicidad_dias": periodicidad_dias,
                                },
                            )

                        creadas_inspecciones += 1
                        creadas_programaciones += 1

                # B) Control grupal
                else:
                    if not Inspeccion.objects.filter(material=material, pieza__isnull=True, fecha__date=fecha_base).exists():
                        if not dry_run:
                            insp = Inspeccion.objects.create(
                                inspector=inspector,
                                tipo="grupal",
                                almacen=almacen,
                                material=material,
                                plantilla=plantilla,
                                cantidad_inspeccionada=material.cantidad_total,
                                cantidad_apta=material.cantidad_total,
                                cantidad_no_apta=0,
                                resultado_general="apta",
                                accion_tomada="continua_servicio",
                                observaciones="Inspección inicial periódica por lote.",
                                proxima_inspeccion=proxima_fecha,
                            )
                            Inspeccion.objects.filter(pk=insp.pk).update(fecha=fecha_dt_aware)

                            for crit in criterios:
                                RespuestaCriterio.objects.create(
                                    inspeccion=insp,
                                    criterio=crit,
                                    valor="cumple",
                                )

                            ProgramacionInspeccion.objects.get_or_create(
                                material=material,
                                pieza=None,
                                fecha_programada=proxima_fecha,
                                defaults={
                                    "plan": plan_actual,
                                    "estado": "pendiente",
                                    "periodicidad_dias": periodicidad_dias,
                                },
                            )

                        creadas_inspecciones += 1
                        creadas_programaciones += 1

            if dry_run:
                self.stdout.write(self.style.NOTICE(f"[DRY-RUN] Se habrían registrado {creadas_inspecciones} inspecciones y {creadas_programaciones} programaciones con su Plan."))
                transaction.set_rollback(True)
            else:
                self.stdout.write(self.style.SUCCESS(f"✓ Éxito: Se registraron {creadas_inspecciones} inspecciones del 21/07/2026 y {creadas_programaciones} programaciones vinculadas al Plan."))