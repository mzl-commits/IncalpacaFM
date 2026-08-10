from django.core.management.base import BaseCommand
from django.db.models import Count

from apps.inspeccion.models import ProgramacionInspeccion


class Command(BaseCommand):
    help = (
        "Limpia duplicados de ProgramacionInspeccion con estado='pendiente' "
        "(mismo plan + mismo material/pieza), dejando solo la más antigua "
        "por fecha_programada. Nunca toca filas con estado='realizada'."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Solo muestra qué se eliminaría, sin borrar nada.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        dupes = (
            ProgramacionInspeccion.objects
            .filter(estado="pendiente")
            .values("plan_id", "material_id", "pieza_id")
            .annotate(n=Count("id"))
            .filter(n__gt=1)
        )

        total_eliminadas = 0
        total_grupos = 0

        for d in dupes:
            total_grupos += 1
            filtro = {"plan_id": d["plan_id"], "estado": "pendiente"}
            if d["material_id"]:
                filtro["material_id"] = d["material_id"]
            else:
                filtro["pieza_id"] = d["pieza_id"]

            qs = ProgramacionInspeccion.objects.filter(**filtro).order_by("fecha_programada", "id")
            a_mantener = qs.first()
            a_eliminar = qs.exclude(pk=a_mantener.pk)
            cantidad = a_eliminar.count()

            self.stdout.write(
                f"plan={d['plan_id']} material={d['material_id']} pieza={d['pieza_id']}: "
                f"mantener #{a_mantener.pk} ({a_mantener.fecha_programada}), "
                f"{'eliminaría' if dry_run else 'eliminando'} {cantidad}"
            )

            if not dry_run:
                a_eliminar.delete()

            total_eliminadas += cantidad

        if total_grupos == 0:
            self.stdout.write(self.style.SUCCESS("No se encontraron duplicados."))
        else:
            verbo = "Se eliminarían" if dry_run else "Se eliminaron"
            self.stdout.write(self.style.SUCCESS(
                f"\n{verbo} {total_eliminadas} programaciones duplicadas "
                f"en {total_grupos} grupo(s)."
            ))