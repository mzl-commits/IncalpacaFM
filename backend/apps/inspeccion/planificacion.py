from datetime import timedelta, date
from collections import defaultdict
from django.db import transaction

from apps.inventario.models import Movimiento
from apps.inspeccion.models import PlanInspeccionAnual, ProgramacionInspeccion, Inspeccion

UMBRAL_ALTO = 15
UMBRAL_MEDIO = 5

def calcular_periodicidad_efectiva(objetivo, periodicidad_base, desde, es_pieza=False):
    """Acorta la periodicidad si hubo mucho uso desde la última inspección."""
    filtro = {"pieza": objetivo} if es_pieza else {"material": objetivo}
    salidas = Movimiento.objects.filter(tipo="salida", fecha__gte=desde, **filtro).count()

    factor = 0.5 if salidas >= UMBRAL_ALTO else 0.75 if salidas >= UMBRAL_MEDIO else 1.0
    return max(round(periodicidad_base * factor), 1)

def construir_materiales_config():
    """Arma materiales_config desde el catálogo activo: sin control individual
    va por material; con control individual va por pieza suelta/estuche
    (las hijas se inspeccionan dentro del checklist del padre).
    Usada por el comando plan_anual y por PlanInspeccionAnualViewSet.generar()."""
    from apps.catalogo.models import Material, Pieza

    base = Material.objects.inspeccionables()

    materiales_config = []
    for material in base.filter(control_individual=False):
        materiales_config.append({
            "material": material,
            "periodicidad_dias": material.periodicidad_inspeccion_dias,
        })

    for pieza in Pieza.objects.filter(
        material__in=base.filter(control_individual=True),
        padre__isnull=True,  # solo estuches/piezas sueltas
    ).exclude(estado="Baja"):
        materiales_config.append({
            "pieza": pieza,
            "periodicidad_dias": pieza.material.periodicidad_inspeccion_dias,
        })

    return materiales_config

@transaction.atomic
def generar_plan_anual(anio, fecha_inicio, materiales_config):
    """materiales_config: lista de dicts con {"material" o "pieza", "periodicidad_dias"}."""
    plan, _ = PlanInspeccionAnual.objects.get_or_create(
        anio=anio,
        defaults={"fecha_inicio": fecha_inicio, "fecha_fin": date(anio, 12, 31)},
    )

    creadas = []
    por_material = defaultdict(list)
    por_periodicidad = defaultdict(list)
    for item in materiales_config:
        if "pieza" in item:
            por_material[item["pieza"].material_id].append(item)
        else:
            # se agrupan por periodicidad para escalonar fechas en vez de amontonarlas
            por_periodicidad[item["periodicidad_dias"]].append(item)

    for items in por_periodicidad.values():
        for item in items:
            ancla = _fecha_ancla(item["material"], item["periodicidad_dias"], False, fecha_inicio)
            creadas.append(ProgramacionInspeccion.objects.create(
                plan=plan, material=item["material"],
                periodicidad_dias=item["periodicidad_dias"],
                fecha_programada=ancla + timedelta(days=item["periodicidad_dias"]),
            ))

    for items in por_material.values():
        for item in items:
            ancla = _fecha_ancla(item["pieza"], item["periodicidad_dias"], True, fecha_inicio)
            creadas.append(ProgramacionInspeccion.objects.create(
                plan=plan, pieza=item["pieza"],
                periodicidad_dias=item["periodicidad_dias"],
                fecha_programada=ancla + timedelta(days=item["periodicidad_dias"]),
            ))
    return plan, creadas

def registrar_inspeccion_completada(programacion, inspeccion, generar_siguiente=True):
    """Cierra la programación. Si generar_siguiente=True crea la siguiente con
    periodicidad ajustada según uso reciente. Pasa False cuando la inspección
    terminó en baja/reemplazo (la pieza ya no existe operativamente)."""
    programacion.inspeccion = inspeccion
    programacion.estado = "realizada"
    programacion.save(update_fields=["inspeccion", "estado"])

    if not generar_siguiente:
        return

    objetivo = programacion.pieza or programacion.material
    es_pieza = programacion.pieza_id is not None
    nueva_periodicidad = calcular_periodicidad_efectiva(
        objetivo, programacion.periodicidad_dias,
        desde=programacion.fecha_programada, es_pieza=es_pieza,
    )
    ProgramacionInspeccion.objects.create(
        plan=programacion.plan, material=programacion.material, pieza=programacion.pieza,
        periodicidad_dias=nueva_periodicidad,
        fecha_programada=inspeccion.fecha + timedelta(days=nueva_periodicidad),
    )

def _fecha_ancla(objetivo, periodicidad_dias, es_pieza, fecha_inicio):
    """Ancla la próxima fecha_programada a la última inspección real. Si nunca
    se inspeccionó, ancla a hoy (o fecha_inicio si es en el futuro) — nunca a
    una fecha de calendario fija que puede haber quedado en el pasado."""
    filtro = {"pieza": objetivo} if es_pieza else {"material": objetivo}
    ultima = Inspeccion.objects.filter(**filtro).order_by("-fecha").first()
    if ultima:
        return ultima.fecha.date()
    return max(fecha_inicio, date.today())

def asegurar_programacion_inicial(material=None, pieza=None):
    filtro = {"pieza": pieza} if pieza else {"material": material}
    if ProgramacionInspeccion.objects.filter(estado="pendiente", **filtro).exists():
        return None
    plan_actual, _ = PlanInspeccionAnual.objects.get_or_create(
        anio=date.today().year,
        defaults={"fecha_inicio": date(date.today().year, 1, 1), "fecha_fin": date(date.today().year, 12, 31)},
    )
    periodicidad = (pieza.material if pieza else material).periodicidad_inspeccion_dias
    return ProgramacionInspeccion.objects.create(
        plan=plan_actual, material=material, pieza=pieza,
        periodicidad_dias=periodicidad,
        fecha_programada=date.today() + timedelta(days=periodicidad),
    )