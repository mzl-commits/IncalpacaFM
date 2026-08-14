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

def construir_materiales_config(almacen):
    """Arma materiales_config para UN almacén específico. Fase 6: antes
    recorría todo el catálogo sin distinguir almacén; ahora 'almacen' es
    obligatorio (id o instancia de Almacen).
    Usada por el comando plan_anual y por PlanInspeccionAnualViewSet.generar()."""
    from apps.catalogo.models import Material, Pieza, Almacen

    if isinstance(almacen, Almacen):
        almacen_obj = almacen
    else:
        almacen_obj = Almacen.objects.get(pk=almacen)

    base = Material.objects.inspeccionables().filter(almacen=almacen_obj)

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

def _es_dia_laborable(d: date) -> bool:
    """Evita domingos (weekday == 6)."""
    return d.weekday() != 6

def _ajustar_dia_laborable(d: date) -> date:
    while not _es_dia_laborable(d):
        d += timedelta(days=1)
    return d

def _obtener_ultima_inspeccion_fecha(objetivo, es_pieza: bool):
    filtro = {"pieza": objetivo} if es_pieza else {"material": objetivo}
    ultima = Inspeccion.objects.filter(**filtro).order_by("-fecha").first()
    if ultima:
        return ultima.fecha.date()
    return None

@transaction.atomic
def generar_plan_anual(anio, fecha_inicio, materiales_config, almacen):
    """materiales_config: lista de dicts con {"material" o "pieza", "periodicidad_dias"}.
    Fase 6: el plan queda scoped por (anio, almacen); 'almacen' es obligatorio.
    Distribuye y escalona las fechas a lo largo de los ciclos de periodicidad para evitar
    saturar la jornada del inspector en un solo día, excluyendo domingos."""
    from apps.catalogo.models import Almacen

    if isinstance(almacen, Almacen):
        almacen_obj = almacen
    else:
        almacen_obj = Almacen.objects.get(pk=almacen)

    plan, _ = PlanInspeccionAnual.objects.get_or_create(
        anio=anio, almacen=almacen_obj,
        defaults={"fecha_inicio": fecha_inicio, "fecha_fin": date(anio, 12, 31)},
    )

    fecha_base = max(fecha_inicio, date.today())

    # Agrupar todos los items por periodicidad para escalonar uniformemente
    por_periodicidad = defaultdict(list)
    for item in materiales_config:
        por_periodicidad[item["periodicidad_dias"]].append(item)

    creadas = []
    for periodicidad_dias, items in por_periodicidad.items():
        n = len(items)
        for i, item in enumerate(items):
            es_pieza = "pieza" in item
            objetivo = item["pieza"] if es_pieza else item["material"]

            # Si ya tiene una inspección previa registrada, respetar su fecha real
            ultima_fecha = _obtener_ultima_inspeccion_fecha(objetivo, es_pieza)
            if ultima_fecha:
                fecha_prog = _ajustar_dia_laborable(ultima_fecha + timedelta(days=periodicidad_dias))
            else:
                # Escalonar uniformemente en el intervalo [1, periodicidad_dias]
                dias_offset = 1 + int(round(i * (periodicidad_dias - 1) / max(n - 1, 1)))
                fecha_prog = _ajustar_dia_laborable(fecha_base + timedelta(days=dias_offset))

            creadas.append(ProgramacionInspeccion.objects.create(
                plan=plan,
                material=None if es_pieza else objetivo,
                pieza=objetivo if es_pieza else None,
                almacen=almacen_obj,
                periodicidad_dias=periodicidad_dias,
                fecha_programada=fecha_prog,
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
        almacen=programacion.almacen,  # NUEVO Fase 6: se hereda de la programación que se cierra
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

    # El almacén se deriva del material (o del material dueño si es pieza) — nunca se pide como parámetro aparte, para que no se
    # pueda desalinear del almacén real del objeto.
    almacen = pieza.material.almacen if pieza else material.almacen

    plan_actual, _ = PlanInspeccionAnual.objects.get_or_create(
        anio=date.today().year, almacen=almacen,
        defaults={"fecha_inicio": date(date.today().year, 1, 1), "fecha_fin": date(date.today().year, 12, 31)},
    )
    periodicidad = (pieza.material if pieza else material).periodicidad_inspeccion_dias
    return ProgramacionInspeccion.objects.create(
        plan=plan_actual, material=material, pieza=pieza, almacen=almacen,
        periodicidad_dias=periodicidad,
        fecha_programada=date.today() + timedelta(days=periodicidad),
    )