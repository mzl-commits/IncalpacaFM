"""
Management command: limpiar_programaciones_no_inspeccionables

Elimina las ProgramacionInspeccion en estado 'pendiente' que quedaron
generadas para materiales/piezas que, con el criterio actual de
Material.objects.inspeccionables() (categoría con requiere_inspeccion=True
Y subcategoría con plantilla_inspeccion asignada), ya no califican.

Esto NO borra inspecciones ya realizadas (estado='realizada') — el
historial queda intacto siempre.

Uso:
    # Modo simulación (por defecto): solo muestra qué se borraría
    python manage.py limpiar_programaciones_no_inspeccionables

    # Modo real: borra de verdad
    python manage.py limpiar_programaciones_no_inspeccionables --confirmar
"""
from django.core.management.base import BaseCommand

from apps.catalogo.models import Material
from apps.inspeccion.models import ProgramacionInspeccion


class Command(BaseCommand):
    help = (
        "Limpia programaciones de inspección pendientes de materiales que ya "
        "no califican como inspeccionables (categoría/plantilla desmarcada)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--confirmar", action="store_true",
            help="Ejecuta el borrado real. Sin este flag solo se simula (dry-run).",
        )

    def handle(self, *args, **options):
        confirmar = options["confirmar"]

        ids_validos = set(Material.objects.inspeccionables().values_list("id", flat=True))

        huerfanas_material = ProgramacionInspeccion.objects.filter(
            estado="pendiente", material__isnull=False,
        ).exclude(material_id__in=ids_validos)

        huerfanas_pieza = ProgramacionInspeccion.objects.filter(
            estado="pendiente", pieza__isnull=False,
        ).exclude(pieza__material_id__in=ids_validos)

        total_material = huerfanas_material.count()
        total_pieza = huerfanas_pieza.count()

        self.stdout.write(f"Programaciones pendientes de MATERIALES a limpiar: {total_material}")
        for p in huerfanas_material.select_related("material")[:30]:
            self.stdout.write(f"  - {p.material.codigo} · {p.material.nombre} (programada {p.fecha_programada})")
        if total_material > 30:
            self.stdout.write(f"  ... y {total_material - 30} más.")

        self.stdout.write(f"\nProgramaciones pendientes de PIEZAS a limpiar: {total_pieza}")
        for p in huerfanas_pieza.select_related("pieza", "pieza__material")[:30]:
            self.stdout.write(
                f"  - {p.pieza.codigo} de {p.pieza.material.nombre} (programada {p.fecha_programada})"
            )
        if total_pieza > 30:
            self.stdout.write(f"  ... y {total_pieza - 30} más.")

        if not confirmar:
            self.stdout.write(self.style.WARNING(
                "\nEsto fue una SIMULACIÓN. No se borró nada. "
                "Corre de nuevo con --confirmar para borrar de verdad."
            ))
            return

        borradas_material = huerfanas_material.delete()[0]
        borradas_pieza = huerfanas_pieza.delete()[0]
        self.stdout.write(self.style.SUCCESS(
            f"\nListo. Borradas {borradas_material} programación(es) de materiales "
            f"y {borradas_pieza} de piezas."
        ))