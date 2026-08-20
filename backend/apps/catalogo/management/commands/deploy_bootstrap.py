"""
Management command: deploy_bootstrap

Orquesta todos los pasos de inicializacion de datos para produccion en un
solo comando, en el orden correcto y de forma idempotente (puede correrse
varias veces sin duplicar datos).

Secuencia:
    1. seed_categorias      -> Crea Categorias y Subcategorias desde el Excel
    2. importar_materiales  -> Sube materiales con su clasificacion desde el Excel
    3. actualizar_frecuencia_herramientas -> Ajusta periodicidad minima (>=2 meses)
    4. cargar_criterios     -> Crea PlantillaCriterio y Criterios base
    5. vincular_plantillas  -> Vincula cada Subcategoria con su plantilla
    6. inicializar_inspecciones_julio -> Registra inspeccion inicial del 21/07/2026
    7. reiniciar_plan_desde_julio     -> Genera plan anual desde julio (inicio 21/09)

Uso:
    python manage.py deploy_bootstrap
    python manage.py deploy_bootstrap --dry-run
    python manage.py deploy_bootstrap --excel importacion/Plantilla_importacion_materiales.xlsx
    python manage.py deploy_bootstrap --fotos-dir importacion/fotos/
    python manage.py deploy_bootstrap --skip-materiales   (si ya estan cargados)
    python manage.py deploy_bootstrap --skip-inspecciones (si ya estan inicializadas)
"""
import os
import sys
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

from apps.catalogo.models import Categoria, Material
from apps.inspeccion.models import Inspeccion, PlanInspeccionAnual

# Ruta por defecto al Excel (relativa al manage.py del backend)
EXCEL_DEFAULT = os.path.join("importacion", "Plantilla_importacion_materiales.xlsx")


class Command(BaseCommand):
    help = (
        "Bootstrap completo de datos para produccion. "
        "Ejecuta todos los pasos en el orden correcto de forma idempotente."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Simula todos los pasos sin guardar en la base de datos.",
        )
        parser.add_argument(
            "--excel",
            type=str,
            default=None,
            help="Ruta al Excel de materiales. Por defecto: importacion/Plantilla_importacion_materiales.xlsx",
        )
        parser.add_argument(
            "--fotos-dir",
            type=str,
            default=None,
            help="Carpeta donde buscar las fotos de materiales.",
        )
        parser.add_argument(
            "--skip-materiales",
            action="store_true",
            help="Omite los pasos de seed_categorias e importar_materiales.",
        )
        parser.add_argument(
            "--skip-inspecciones",
            action="store_true",
            help="Omite los pasos de inicializar_inspecciones_julio y reiniciar_plan_desde_julio.",
        )
        parser.add_argument(
            "--max-por-dia",
            type=int,
            default=5,
            help="Maximo de inspecciones por dia laborable en el plan anual (por defecto 5).",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        skip_materiales = options["skip_materiales"]
        skip_inspecciones = options["skip_inspecciones"]
        max_por_dia = options["max_por_dia"]
        fotos_dir = options["fotos_dir"]

        excel_path = options["excel"] or EXCEL_DEFAULT
        if not skip_materiales and not os.path.exists(excel_path):
            raise CommandError(
                f"No se encontro el archivo Excel en: {excel_path}\n"
                f"Usa --excel ruta/al/archivo.xlsx para especificarlo, "
                f"o --skip-materiales si los materiales ya estan cargados."
            )

        self._sep()
        self.stdout.write(self.style.SUCCESS("  INCALPACA FM - BOOTSTRAP DE DATOS DE PRODUCCION"))
        if dry_run:
            self.stdout.write(self.style.WARNING("  [DRY-RUN: No se guardara nada en la base de datos]"))
        self._sep()

        # ── PASO 1: CATEGORIAS ──────────────────────────────────────────────
        if skip_materiales:
            self._skip("PASO 1/7: Categorias (--skip-materiales activo)")
        else:
            n = Categoria.objects.count()
            self._step(
                f"PASO 1/7: Categorias y subcategorias "
                f"({'actualizando' if n > 0 else 'creando'} desde Excel)..."
            )
            try:
                call_command("seed_categorias", excel_path, stdout=self.stdout, stderr=self.stderr)
            except Exception as e:
                self._err("PASO 1/7", e); sys.exit(1)

        # ── PASO 2: MATERIALES ──────────────────────────────────────────────
        if skip_materiales:
            self._skip("PASO 2/7: Materiales (--skip-materiales activo)")
        else:
            n = Material.objects.count()
            if n > 0 and not dry_run:
                self._done(
                    f"PASO 2/7: {n} materiales ya existen - omitiendo importacion. "
                    f"(Para reimportar: python manage.py importar_materiales {excel_path} --permitir-sin-foto)"
                )
            else:
                self._step("PASO 2/7: Importando materiales desde Excel...")
                kwargs = {"permitir_sin_foto": True, "stdout": self.stdout, "stderr": self.stderr}
                if fotos_dir:
                    kwargs["fotos_dir"] = fotos_dir
                if dry_run:
                    kwargs["dry_run"] = True
                try:
                    call_command("importar_materiales", excel_path, **kwargs)
                except Exception as e:
                    self._err("PASO 2/7", e); sys.exit(1)

        # ── PASO 3: FRECUENCIAS ─────────────────────────────────────────────
        self._step("PASO 3/7: Ajustando frecuencias de inspeccion de herramientas...")
        try:
            kw = {"stdout": self.stdout, "stderr": self.stderr}
            if not dry_run:
                kw["confirmar"] = True
            call_command("actualizar_frecuencia_herramientas", **kw)
        except Exception as e:
            self._err("PASO 3/7", e); sys.exit(1)

        # ── PASO 4: CRITERIOS ───────────────────────────────────────────────
        self._step("PASO 4/7: Cargando criterios de inspeccion (PlantillaCriterio)...")
        try:
            call_command("cargar_criterios", stdout=self.stdout, stderr=self.stderr)
        except Exception as e:
            self._err("PASO 4/7", e); sys.exit(1)

        # ── PASO 5: VINCULAR PLANTILLAS ─────────────────────────────────────
        self._step("PASO 5/7: Vinculando plantillas de inspeccion a subcategorias...")
        try:
            call_command("vincular_plantillas", stdout=self.stdout, stderr=self.stderr)
        except Exception as e:
            self._err("PASO 5/7", e); sys.exit(1)

        # ── PASO 6: INSPECCION INICIAL 21/07/2026 ───────────────────────────
        if skip_inspecciones:
            self._skip("PASO 6/7: Inspecciones iniciales (--skip-inspecciones activo)")
        else:
            n = Inspeccion.objects.count()
            if n > 0 and not dry_run:
                self._done(f"PASO 6/7: {n} inspecciones ya existen - omitiendo inicializacion.")
            else:
                self._step("PASO 6/7: Registrando inspeccion inicial masiva del 21/07/2026...")
                try:
                    kw = {"stdout": self.stdout, "stderr": self.stderr}
                    if dry_run:
                        kw["dry_run"] = True
                    call_command("inicializar_inspecciones_julio", **kw)
                except Exception as e:
                    self._err("PASO 6/7", e); sys.exit(1)

        # ── PASO 7: PLAN ANUAL ──────────────────────────────────────────────
        if skip_inspecciones:
            self._skip("PASO 7/7: Plan anual (--skip-inspecciones activo)")
        elif dry_run:
            self.stdout.write(self.style.NOTICE("  [DRY-RUN] PASO 7/7: Plan anual (se omite en dry-run)."))
        else:
            n = PlanInspeccionAnual.objects.filter(anio=2026).count()
            if n > 0:
                self._step("PASO 7/7: Regenerando programaciones pendientes del plan anual 2026...")
            else:
                self._step("PASO 7/7: Generando plan anual de inspecciones (desde 22/07/2026)...")
            try:
                call_command(
                    "reiniciar_plan_desde_julio",
                    fecha_inicio="2026-07-22",
                    max_por_dia=max_por_dia,
                    stdout=self.stdout,
                    stderr=self.stderr,
                )
            except Exception as e:
                self._err("PASO 7/7", e); sys.exit(1)

        # ── RESUMEN ─────────────────────────────────────────────────────────
        self._sep()
        if dry_run:
            self.stdout.write(self.style.WARNING(
                "  [DRY-RUN COMPLETO] Nada fue guardado. Corre sin --dry-run para aplicar."
            ))
        else:
            self.stdout.write(self.style.SUCCESS(
                "  BOOTSTRAP COMPLETADO EXITOSAMENTE\n"
                f"  Materiales  : {Material.objects.count()}\n"
                f"  Inspecciones: {Inspeccion.objects.count()}\n"
                f"  Planes 2026 : {PlanInspeccionAnual.objects.filter(anio=2026).count()}"
            ))
        self._sep()

    # ── Helpers ─────────────────────────────────────────────────────────────

    def _sep(self):
        self.stdout.write("=" * 60)

    def _step(self, msg):
        self.stdout.write("")
        self.stdout.write(self.style.HTTP_INFO(f"[>>>] {msg}"))

    def _skip(self, msg):
        self.stdout.write(self.style.WARNING(f"[---] {msg}"))

    def _done(self, msg):
        self.stdout.write(self.style.NOTICE(f"[OK ] {msg}"))

    def _err(self, step, exc):
        self.stdout.write(self.style.ERROR(f"\n[!!!] {step} fallo: {exc}"))
        self.stdout.write(self.style.ERROR("      Bootstrap interrumpido."))
