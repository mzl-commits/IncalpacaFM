# backend/apps/inspeccion/management/commands/limpiar_programaciones_invalidas.py

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.catalogo.models import Material
from apps.inspeccion.models import ProgramacionInspeccion


class Command(BaseCommand):
    help = (
        "Elimina de forma segura las ProgramacionInspeccion en estado 'pendiente' "
        "asociadas a materiales o piezas que NO califican según la regla de negocio "
        "(Categoria.requiere_inspeccion=True AND Subcategoria.plantilla_inspeccion NOT NULL)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Muestra qué registros se eliminarían sin aplicar cambios en la base de datos.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        self.stdout.write(self.style.NOTICE("=== INICIANDO AUDITORÍA DE PROGRAMACIONES ==="))

        # 1. Obtener conjunto de IDs de materiales legalmente inspeccionables
        ids_validos = set(
            Material.objects.inspeccionables().values_list("id", flat=True)
        )
        self.stdout.write(f"Total de materiales inspeccionables válidos: {len(ids_validos)}")

        # 2. Buscar programaciones pendientes asociadas directamente a Material
        pendientes_material_invalidas = ProgramacionInspeccion.objects.filter(
            estado="pendiente",
            material__isnull=False,
        ).exclude(material_id__in=ids_validos).select_related(
            "material", "material__subcategoria", "material__subcategoria__categoria"
        )

        # 3. Buscar programaciones pendientes asociadas a Piezas individuales
        pendientes_pieza_invalidas = ProgramacionInspeccion.objects.filter(
            estado="pendiente",
            pieza__isnull=False,
        ).exclude(pieza__material_id__in=ids_validos).select_related(
            "pieza", "pieza__material", "pieza__material__subcategoria", "pieza__material__subcategoria__categoria"
        )

        total_material = pendientes_material_invalidas.count()
        total_pieza = pendientes_pieza_invalidas.count()
        total_a_eliminar = total_material + total_pieza

        if total_a_eliminar == 0:
            self.stdout.write(self.style.SUCCESS("✓ No se encontraron programaciones pendientes inconsistentes."))
            return

        self.stdout.write(
            self.style.WARNING(
                f"\nSe encontraron {total_a_eliminar} programaciones pendientes que ya no califican:"
            )
        )
        self.stdout.write(f"  - Por Material directo: {total_material}")
        self.stdout.write(f"  - Por Pieza individual: {total_pieza}")

        # Mostrar detalle de los primeros 10 para trazabilidad
        self.stdout.write("\nEjemplos de registros no válidos detectados:")
        for prog in list(pendientes_material_invalidas[:5]) + list(pendientes_pieza_invalidas[:5]):
            mat = prog.material or (prog.pieza.material if prog.pieza else None)
            nombre_mat = mat.nombre if mat else "Desconocido"
            cat_nombre = mat.subcategoria.categoria.nombre if mat and mat.subcategoria else "Sin Cat"
            sub_nombre = mat.subcategoria.nombre if mat and mat.subcategoria else "Sin Sub"
            req_insp = mat.subcategoria.categoria.requiere_inspeccion if mat and mat.subcategoria else False
            tiene_plan = bool(mat.subcategoria.plantilla_inspeccion) if mat and mat.subcategoria else False

            self.stdout.write(
                f"  • ID Programación: {prog.id} | Material: {nombre_mat} "
                f"| Cat: {cat_nombre} (requiere={req_insp}) "
                f"| Sub: {sub_nombre} (plantilla={tiene_plan})"
            )

        if dry_run:
            self.stdout.write(
                self.style.NOTICE(
                    f"\n[MODO DRY-RUN] No se eliminó ningún registro. Ejecuta sin '--dry-run' para aplicar."
                )
            )
            return

        # 4. Eliminación atómica segura
        with transaction.atomic():
            borrados_mat, _ = pendientes_material_invalidas.delete()
            borrados_pie, _ = pendientes_pieza_invalidas.delete()

        total_borrados = borrados_mat + borrados_pie
        self.stdout.write(
            self.style.SUCCESS(
                f"\n✓ Se eliminaron exitosamente {total_borrados} programaciones pendientes no válidas."
            )
        )
        self.stdout.write(
            self.style.SUCCESS("✓ Ninguna inspección con estado distinto a 'pendiente' fue afectada.")
        )