from datetime import timedelta, date
from collections import defaultdict
from django.db import transaction

from apps.inventario.models import Movimiento
from apps.inspeccion.models import PlanInspeccionAnual, ProgramacionInspeccion, Inspeccion

UMBRAL_ALTO = 15
UMBRAL_MEDIO = 5

# Máximo de inspecciones por día laborable (configurable al llamar generar_plan_anual)
MAX_INSPECCIONES_DIA_DEFAULT = 5


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
    """Solo días de Lunes a Viernes (0 a 4). Sábados (5) y Domingos (6) son días libres."""
    return d.weekday() < 5


def _ajustar_dia_laborable(d: date) -> date:
    while not _es_dia_laborable(d):
        d += timedelta(days=1)
    return d


def sumar_dias_laborables(fecha_base: date, dias_laborables: int) -> date:
    """Avanza 'dias_laborables' días hábiles (Lunes a Viernes) a partir de fecha_base."""
    actual = fecha_base
    agregados = 0
    while agregados < dias_laborables:
        actual += timedelta(days=1)
        if _es_dia_laborable(actual):
            agregados += 1
    return actual


def _obtener_ultima_inspeccion_fecha(objetivo, es_pieza: bool):
    filtro = {"pieza": objetivo} if es_pieza else {"material": objetivo}
    ultima = Inspeccion.objects.filter(**filtro).order_by("-fecha").first()
    if ultima:
        return ultima.fecha.date()
    return None


def _siguiente_dia_disponible(fecha_actual: date, carga_dia: dict, max_por_dia: int) -> date:
    """
    Devuelve el próximo día laborable que aún tenga capacidad (< max_por_dia inspecciones).
    Avanza de día en día saltando fines de semana y días llenos.
    """
    d = _ajustar_dia_laborable(fecha_actual)
    while carga_dia.get(d, 0) >= max_por_dia:
        d += timedelta(days=1)
        d = _ajustar_dia_laborable(d)
    return d


@transaction.atomic
def generar_plan_anual(anio, fecha_inicio, materiales_config, almacen, max_por_dia: int = MAX_INSPECCIONES_DIA_DEFAULT):
    """materiales_config: lista de dicts con {"material" o "pieza", "periodicidad_dias"}.
    Fase 6: el plan queda scoped por (anio, almacen); 'almacen' es obligatorio.
    Distribuye y escalona las fechas a lo largo de los días laborables (Lunes a Viernes)
    para evitar saturar la jornada del inspector, dejando libres los fines de semana.

    max_por_dia: máximo de inspecciones que se pueden agendar en un mismo día laborable.
    Por defecto = 5. Controla que el calendario no acumule +15 inspecciones en un día.
    """
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

    # carga_dia: cuántas inspecciones ya están agendadas para cada día
    # (incluye las pre-existentes con última inspección real)
    carga_dia: dict[date, int] = defaultdict(int)

    # ── Fase 1: items CON inspección previa — fecha anclada a la real ────────
    items_sin_historial = []
    creadas = []

    for item in materiales_config:
        es_pieza = "pieza" in item
        objetivo = item["pieza"] if es_pieza else item["material"]
        periodicidad_dias = item["periodicidad_dias"]

        ultima_fecha = _obtener_ultima_inspeccion_fecha(objetivo, es_pieza)
        if ultima_fecha:
            fecha_natural = _ajustar_dia_laborable(ultima_fecha + timedelta(days=periodicidad_dias))
            # Respetar max_por_dia incluso para items con historial
            fecha_prog = _siguiente_dia_disponible(fecha_natural, carga_dia, max_por_dia)
            carga_dia[fecha_prog] += 1
            creadas.append(ProgramacionInspeccion.objects.create(
                plan=plan,
                material=None if es_pieza else objetivo,
                pieza=objetivo if es_pieza else None,
                almacen=almacen_obj,
                periodicidad_dias=periodicidad_dias,
                fecha_programada=fecha_prog,
            ))
        else:
            items_sin_historial.append(item)

    # ── Fase 2: items SIN historial — rellenar días hasta max_por_dia ────────
    # Ordenar por periodicidad para agrupar materiales del mismo ciclo
    items_sin_historial.sort(key=lambda x: x["periodicidad_dias"])

    # Cursor de fecha: arranca en el primer día laborable desde fecha_base
    cursor = _ajustar_dia_laborable(fecha_base)

    for item in items_sin_historial:
        es_pieza = "pieza" in item
        objetivo = item["pieza"] if es_pieza else item["material"]
        periodicidad_dias = item["periodicidad_dias"]

        # Si el día actual ya está lleno, avanzar al siguiente día disponible
        if carga_dia[cursor] >= max_por_dia:
            cursor = _siguiente_dia_disponible(
                _ajustar_dia_laborable(cursor + timedelta(days=1)),
                carga_dia,
                max_por_dia,
            )

        fecha_prog = cursor
        carga_dia[fecha_prog] += 1

        creadas.append(ProgramacionInspeccion.objects.create(
            plan=plan,
            material=None if es_pieza else objetivo,
            pieza=objetivo if es_pieza else None,
            almacen=almacen_obj,
            periodicidad_dias=periodicidad_dias,
            fecha_programada=fecha_prog,
        ))

        # NO avanzamos el cursor aquí — el siguiente item puede ir al mismo día
        # si todavía hay capacidad (carga_dia[cursor] < max_por_dia)

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
    fecha_base_sig = inspeccion.fecha.date() if hasattr(inspeccion.fecha, 'date') else inspeccion.fecha
    fecha_prog_sig = _ajustar_dia_laborable(fecha_base_sig + timedelta(days=nueva_periodicidad))
    ProgramacionInspeccion.objects.create(
        plan=programacion.plan, material=programacion.material, pieza=programacion.pieza,
        almacen=programacion.almacen,
        periodicidad_dias=nueva_periodicidad,
        fecha_programada=fecha_prog_sig,
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
    fecha_prog = _ajustar_dia_laborable(date.today() + timedelta(days=periodicidad))
    return ProgramacionInspeccion.objects.create(
        plan=plan_actual, material=material, pieza=pieza, almacen=almacen,
        periodicidad_dias=periodicidad,
        fecha_programada=fecha_prog,
    )