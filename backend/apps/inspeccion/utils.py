"""
utils.py — Utilidades de lógica de inspección para IncalpacaFM

Contiene:
  - calcular_frecuencia_sugerida()  → Clasificación ABC de uso (Tarea 4)
  - color_inspeccion_actual()       → Color del mes por trimestre 5S (Tarea 5)
  - LEYENDA_COLORES                 → Lista completa de colores para la leyenda
"""
from datetime import date, timedelta


# ── Configuración ABC de uso (ajustable sin nuevo deploy) ─────────────────────
UMBRAL_USO_ALTO = 20   # >20 salidas/mes → inspección semanal
UMBRAL_USO_MEDIO = 5   # 5-20 salidas/mes → inspección mensual
                       # <5 salidas/mes  → inspección trimestral


def calcular_frecuencia_sugerida(material, meses: int = 3) -> dict:
    """
    Calcula la frecuencia de inspección sugerida para un material basándose en:
      1. Frecuencia de uso = total_salidas en ventana de `meses` meses (ej. 90 días).
      2. Tasa de incidencias = inspecciones con no_cumple / total de inspecciones.
      3. Recencia = días desde el último movimiento (salida/préstamo).
      4. Clasificación ABC ponderada (Uso x Criticidad/Incidencias).

    Clasificación ABC:
      - Categoría A (Alto uso/riesgo: >20 usos/mes o uso moderado con alta incidencia) → "semanal"
      - Categoría B (Uso medio: 5–20 usos/mes) → "mensual" (o "quincenal" si hay incidencias)
      - Categoría C (Bajo uso o inactivo >90 días: <5 usos/mes) → "trimestral"
    """
    from apps.inventario.models import Movimiento
    from apps.inspeccion.models import Inspeccion, RespuestaCriterio
    from django.utils import timezone

    hoy = timezone.localdate()
    ventana_dias = 30 * meses
    desde = hoy - timedelta(days=ventana_dias)

    # 1. Total de salidas en la ventana
    salidas_qs = Movimiento.objects.filter(
        material=material,
        tipo="salida",
        fecha__date__gte=desde,
    )
    total_salidas = salidas_qs.count()
    usos_por_mes = round(total_salidas / max(meses, 1), 2)

    # 2. Recencia: días desde el último uso
    ultimo_mov = Movimiento.objects.filter(
        material=material,
        tipo="salida",
    ).order_by("-fecha").first()

    dias_sin_uso = None
    if ultimo_mov and ultimo_mov.fecha:
        dias_sin_uso = (hoy - ultimo_mov.fecha.date()).days

    # 3. Tasa de incidencias del check list (hallazgos no conformes)
    inspecciones_mat = Inspeccion.objects.filter(
        material=material,
        fecha__date__gte=desde,
    )
    total_inspecciones = inspecciones_mat.count()

    fallas_count = RespuestaCriterio.objects.filter(
        inspeccion__in=inspecciones_mat,
        valor="no_cumple",
    ).count()

    tasa_incidencias = (
        round(fallas_count / total_inspecciones, 2) if total_inspecciones > 0 else 0.0
    )

    # 4. Cálculo de puntuación de riesgo y categorización ABC
    # Si la herramienta lleva más de 90 días sin usarse, decae a bajo uso aunque tuviera historial pasado
    es_inactiva_reciente = dias_sin_uso is not None and dias_sin_uso > 90 and total_salidas == 0

    if es_inactiva_reciente:
        categoria_abc = "C"
        frecuencia = "trimestral"
        periodicidad_dias = 90
        label = "Trimestral (sin uso reciente)"
    elif usos_por_mes > UMBRAL_USO_ALTO or (usos_por_mes >= 12 and tasa_incidencias >= 0.25):
        categoria_abc = "A"
        frecuencia = "semanal"
        periodicidad_dias = 7
        label = "Semanal (alto uso / criticidad)"
    elif usos_por_mes >= UMBRAL_USO_MEDIO:
        if tasa_incidencias >= 0.30:
            categoria_abc = "B"
            frecuencia = "quincenal"
            periodicidad_dias = 15
            label = "Quincenal (uso medio con incidencias)"
        else:
            categoria_abc = "B"
            frecuencia = "mensual"
            periodicidad_dias = 30
            label = "Mensual (uso medio)"
    else:
        categoria_abc = "C"
        frecuencia = "trimestral"
        periodicidad_dias = 90
        label = "Trimestral (bajo uso)"

    return {
        "categoria_abc": categoria_abc,
        "usos_por_mes": usos_por_mes,
        "total_salidas_90d": total_salidas,
        "dias_sin_uso": dias_sin_uso,
        "total_inspecciones": total_inspecciones,
        "total_hallazgos": fallas_count,
        "tasa_incidencias": tasa_incidencias,
        "frecuencia": frecuencia,
        "frecuencia_sugerida": frecuencia,
        "periodicidad_dias": periodicidad_dias,
        "label": label,
    }


def calcular_frecuencia_categoria(almacen, categoria_nombre: str, meses: int = 3) -> dict:
    """
    Calcula la frecuencia sugerida para TODA UNA CATEGORÍA de herramientas
    (ej. Herramientas de golpe, corte, sujeción...) sumando salidas e incidencias.
    """
    from apps.inventario.models import Movimiento
    from apps.inspeccion.models import Inspeccion, RespuestaCriterio
    from django.utils import timezone

    hoy = timezone.localdate()
    desde = hoy - timedelta(days=30 * meses)

    salidas_qs = Movimiento.objects.filter(
        almacen=almacen,
        material__subcategoria__categoria__nombre__icontains=categoria_nombre,
        tipo="salida",
        fecha__date__gte=desde,
    )
    total_salidas = salidas_qs.count()
    usos_por_mes = round(total_salidas / max(meses, 1), 2)

    # Incidencias por categoría
    inspecciones_cat = Inspeccion.objects.filter(
        material__almacen=almacen,
        material__subcategoria__categoria__nombre__icontains=categoria_nombre,
        fecha__date__gte=desde,
    )
    total_inspecciones = inspecciones_cat.count()
    fallas_count = RespuestaCriterio.objects.filter(
        inspeccion__in=inspecciones_cat,
        valor="no_cumple",
    ).count()
    tasa_incidencias = (
        round(fallas_count / total_inspecciones, 2) if total_inspecciones > 0 else 0.0
    )

    if usos_por_mes > UMBRAL_USO_ALTO or (usos_por_mes >= 12 and tasa_incidencias >= 0.25):
        categoria_abc = "A"
        frecuencia = "semanal"
        periodicidad_dias = 7
        label = "Semanal (alto uso)"
    elif usos_por_mes >= UMBRAL_USO_MEDIO:
        categoria_abc = "B"
        frecuencia = "mensual"
        periodicidad_dias = 30
        label = "Mensual (uso medio)"
    else:
        categoria_abc = "C"
        frecuencia = "trimestral"
        periodicidad_dias = 90
        label = "Trimestral (bajo uso)"

    return {
        "categoria_abc": categoria_abc,
        "usos_por_mes": usos_por_mes,
        "total_salidas_90d": total_salidas,
        "total_inspecciones": total_inspecciones,
        "total_hallazgos": fallas_count,
        "tasa_incidencias": tasa_incidencias,
        "frecuencia": frecuencia,
        "frecuencia_sugerida": frecuencia,
        "periodicidad_dias": periodicidad_dias,
        "label": label,
    }



# ── Sistema de colores 5S por trimestre (según Tabla 5 oficial) ─────────────

LEYENDA_COLORES = [
    {
        "trimestre": 1,
        "nombre": "Amarillo",
        "hex": "#EAB308",
        "meses": "Enero – Febrero – Marzo",
        "meses_num": [1, 2, 3],
        "rgb_excel": "EAB308",   # para openpyxl
    },
    {
        "trimestre": 2,
        "nombre": "Verde",
        "hex": "#22C55E",
        "meses": "Abril – Mayo – Junio",
        "meses_num": [4, 5, 6],
        "rgb_excel": "22C55E",
    },
    {
        "trimestre": 3,
        "nombre": "Azul",
        "hex": "#2563EB",
        "meses": "Julio – Agosto – Septiembre",
        "meses_num": [7, 8, 9],
        "rgb_excel": "2563EB",
    },
    {
        "trimestre": 4,
        "nombre": "Rojo",
        "hex": "#DC2626",
        "meses": "Octubre – Noviembre – Diciembre",
        "meses_num": [10, 11, 12],
        "rgb_excel": "DC2626",
    },
]


def color_inspeccion_actual(para_fecha: date | None = None) -> dict:
    """
    Devuelve el color del trimestre actual (o de la fecha indicada) y la leyenda completa.

    Returns:
        {
          "actual": {
            "trimestre": int,
            "nombre": str,
            "hex": str,
            "meses": str,
            "rgb_excel": str,
          },
          "leyenda": [ ... lista de los 4 colores ... ],
        }
    """
    hoy = para_fecha or date.today()
    trimestre_idx = (hoy.month - 1) // 3  # 0, 1, 2, 3
    return {
        "actual": LEYENDA_COLORES[trimestre_idx],
        "leyenda": LEYENDA_COLORES,
    }