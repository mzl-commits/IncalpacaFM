from datetime import timedelta, date
from collections import defaultdict
from django.db import transaction

from apps.inventario.models import Movimiento
from apps.inspeccion.models import PlanInspeccionAnual, ProgramacionInspeccion

UMBRAL_ALTO = 15
UMBRAL_MEDIO = 5

def generar_fechas_escalonadas(fecha_inicio, periodicidad_dias, cantidad):
    """Reparte 'cantidad' fechas dentro de un ciclo de periodicidad_dias para
    que nunca coincidan varias unidades del mismo material el mismo día."""
    if cantidad <= 0:
        return []
    intervalo = periodicidad_dias / cantidad
    return [fecha_inicio + timedelta(days=round(i * intervalo)) for i in range(cantidad)]


def calcular_periodicidad_efectiva(objetivo, periodicidad_base, desde, es_pieza=False):
    """Acorta la periodicidad si el objetivo tuvo mucho uso desde la última inspección."""
    filtro = {"pieza": objetivo} if es_pieza else {"material": objetivo}
    salidas = Movimiento.objects.filter(tipo="salida", fecha__gte=desde, **filtro).count()

    factor = 0.5 if salidas >= UMBRAL_ALTO else 0.75 if salidas >= UMBRAL_MEDIO else 1.0
    return max(round(periodicidad_base * factor), 1)

def construir_materiales_config():
    """
    Arma la lista de materiales_config (formato esperado por generar_plan_anual)
    a partir del catálogo activo: materiales sin control individual van por
    material, materiales con control individual van por pieza suelta/estuche
    (las hijas se inspeccionan dentro del checklist del padre, no aparte).

    Usada tanto por el comando `plan_anual` como por
    `PlanInspeccionAnualViewSet.generar()`, para que ambos apliquen exactamente
    el mismo criterio de selección sin duplicarlo.
    """
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
        padre__isnull=True,  # solo estuches/piezas sueltas — las hijas van dentro del checklist del padre
    ).exclude(estado="Baja"):
        materiales_config.append({
            "pieza": pieza,
            "periodicidad_dias": pieza.material.periodicidad_inspeccion_dias,
        })

    return materiales_config

@transaction.atomic
def generar_plan_anual(anio, fecha_inicio, materiales_config):
    """
    materiales_config: lista de dicts.
    - {"material": Material, "periodicidad_dias": int} para materiales sin control individual.
    - {"pieza": Pieza, "periodicidad_dias": int} para piezas con control individual.
    """
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
            # Se agrupan por periodicidad (no por material_id, porque acá cada
            # material aparece una sola vez) para escalonar sus fechas dentro
            # del ciclo en vez de amontonarlas todas en fecha_inicio.
            por_periodicidad[item["periodicidad_dias"]].append(item)

    for items in por_periodicidad.values():
        fechas = generar_fechas_escalonadas(fecha_inicio, items[0]["periodicidad_dias"], len(items))
        for item, fecha in zip(items, fechas):
            creadas.append(ProgramacionInspeccion.objects.create(
                plan=plan, material=item["material"],
                periodicidad_dias=item["periodicidad_dias"],
                fecha_programada=fecha,
            ))

    for items in por_material.values():
        fechas = generar_fechas_escalonadas(fecha_inicio, items[0]["periodicidad_dias"], len(items))
        for item, fecha in zip(items, fechas):
            creadas.append(ProgramacionInspeccion.objects.create(
                plan=plan, pieza=item["pieza"],
                periodicidad_dias=item["periodicidad_dias"],
                fecha_programada=fecha,
            ))
    return plan, creadas

def registrar_inspeccion_completada(programacion, inspeccion, generar_siguiente=True):
    """Cierra esta programación. Si generar_siguiente=True (default), crea la
    siguiente con la periodicidad ajustada según el uso reciente. Pasa False
    cuando la inspección terminó en baja/reemplazo: la pieza ya no existe
    operativamente, así que no tiene sentido programarle otra inspección."""
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