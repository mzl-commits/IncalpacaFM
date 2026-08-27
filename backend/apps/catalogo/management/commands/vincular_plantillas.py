"""
Management command: vincular_plantillas

Asigna la PlantillaCriterio correspondiente a cada Subcategoria, según un
mapeo (categoría, subcategoría) -> nombre de plantilla.

Requiere que ya existan:
  - Categorias/Subcategorias  (python manage.py seed_categorias ...)
  - PlantillaCriterio + Criterio  (tu comando de carga de criterios)

Es seguro correrlo varias veces: solo actualiza el campo plantilla_inspeccion,
no crea ni borra nada más. Las subcategorías que no estén en el mapeo se
reportan al final como pendientes, sin detener la ejecución.

Uso:
    python manage.py vincular_plantillas
"""
from django.core.management.base import BaseCommand

from apps.catalogo.models import Subcategoria
from apps.inspeccion.models import PlantillaCriterio

# (nombre de categoría, nombre de subcategoría) -> nombre de PlantillaCriterio
# Ve agregando líneas aquí a medida que definas criterios para más rubros
# (Gasfitería, Carpintería, Acabados, Electricidad, Luminaria, Redes, EPP, Albañilería...).
MAPEO = {
    ("Herramientas", "Manual"): "Manual",
    ("Herramientas", "Eléctrica"): "Eléctrica",
    ("Herramientas", "Inalámbrica"): "Inalámbrica",
    ("Herramientas", "Electricidad"): "Manual",
    ("Herramientas", "Accesorios"): "Manual",
    ("Equipo de Protección Personal", "Protección contra Caídas"): "EPP (equipo de protección personal)",
    ("Equipo de Protección Personal", "Protección Corporal"): "EPP (equipo de protección personal)",
    ("Equipo de Protección Personal", "Protección para Manos"): "EPP (equipo de protección personal)",
    ("Equipo de Protección Personal", "Protección para Pies"): "EPP (equipo de protección personal)",
    ("Equipo de Protección Personal", "Protección Visual"): "EPP (equipo de protección personal)",
    ("Equipo de Protección Personal", "Ropa de Protección Climática"): "EPP (equipo de protección personal)",
}


class Command(BaseCommand):
    help = "Vincula cada Subcategoria con su PlantillaCriterio según el mapeo definido en este comando."

    def handle(self, *args, **options):
        vinculadas = 0
        errores = []

        for (cat_nombre, sub_nombre), plantilla_nombre in MAPEO.items():
            try:
                sub = Subcategoria.objects.get(
                    categoria__nombre=cat_nombre, nombre=sub_nombre
                )
            except Subcategoria.DoesNotExist:
                errores.append(f"No existe la subcategoría '{cat_nombre} -> {sub_nombre}'.")
                continue

            try:
                plantilla = PlantillaCriterio.objects.get(nombre=plantilla_nombre)
            except PlantillaCriterio.DoesNotExist:
                errores.append(
                    f"No existe la plantilla '{plantilla_nombre}' "
                    f"(requerida por '{cat_nombre} -> {sub_nombre}')."
                )
                continue

            if sub.plantilla_inspeccion_id != plantilla.id:
                sub.plantilla_inspeccion = plantilla
                sub.save(update_fields=["plantilla_inspeccion"])
                self.stdout.write(f"  [OK] {cat_nombre} -> {sub_nombre} => {plantilla_nombre}")
            else:
                self.stdout.write(f"  [--] {cat_nombre} -> {sub_nombre} ya estaba vinculada.")
            vinculadas += 1

        # Reporte de subcategorías que quedaron sin ningún mapeo (ni acierto ni error arriba)
        mapeadas_ids = set(
            Subcategoria.objects.filter(
                categoria__nombre__in=[c for c, _ in MAPEO.keys()],
                nombre__in=[s for _, s in MAPEO.keys()],
            ).values_list("id", flat=True)
        )
        pendientes = Subcategoria.objects.exclude(id__in=mapeadas_ids).exclude(
            plantilla_inspeccion__isnull=False
        )

        self.stdout.write(self.style.SUCCESS(f"\n{vinculadas} subcategoria(s) vinculada(s) u ok."))

        if errores:
            self.stdout.write(self.style.ERROR(f"\n{len(errores)} error(es):"))
            for e in errores:
                self.stdout.write(f"  - {e}")

        if pendientes.exists():
            self.stdout.write(self.style.WARNING(
                f"\n{pendientes.count()} subcategoria(s) sin plantilla asignada todavia "
                f"(sus materiales se seguirán saltando en inicializar_inspecciones_julio):"
            ))
            for s in pendientes:
                self.stdout.write(f"  - {s.categoria.nombre} -> {s.nombre}")