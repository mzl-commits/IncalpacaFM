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

    subcat = getattr(material, "subcategoria", None)
    subcat_nombre = (subcat.nombre if subcat else "").lower()
    plantilla_nombre = (subcat.plantilla_inspeccion.nombre if subcat and getattr(subcat, "plantilla_inspeccion", None) else "").lower()
    cat_nombre = (subcat.categoria.nombre if subcat and subcat.categoria else "").lower()
    mat_nombre = (material.nombre or "").lower()

    es_electrico_o_inalambrico = (
        "inalambric" in subcat_nombre
        or "electri" in subcat_nombre
        or "inalambric" in plantilla_nombre
        or "electri" in plantilla_nombre
        or "inalámbric" in mat_nombre
        or "eléctric" in mat_nombre
        or "taladro" in mat_nombre
        or "amoladora" in mat_nombre
        or "esmeril" in mat_nombre
        or "rotomartillo" in mat_nombre
        or "sierra circular" in mat_nombre
        or "caladora" in mat_nombre
        or "lijadora" in mat_nombre
        or "mezclador" in mat_nombre
    )

    if es_inactiva_reciente:
        categoria_abc = "C"
        frecuencia = "bimestral" if es_electrico_o_inalambrico else "trimestral"
        periodicidad_dias = 60 if es_electrico_o_inalambrico else 90
        label = "Bimestral (eléctrica/inalámbrica sin uso reciente)" if es_electrico_o_inalambrico else "Trimestral (sin uso reciente)"
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
        frecuencia = "bimestral" if es_electrico_o_inalambrico else "trimestral"
        periodicidad_dias = 60 if es_electrico_o_inalambrico else 90
        label = "Bimestral (norma SST herramientas eléctricas e inalámbricas)" if es_electrico_o_inalambrico else "Trimestral (bajo uso)"

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



# ── Sistema de colores 5S por trimestre y bimestre (según estándar oficial SST) ──

LEYENDA_COLORES_TRIMESTRAL = [
    {
        "periodo": 1,
        "trimestre": 1,
        "label": "I Trimestre",
        "nombre": "Amarillo",
        "hex": "#FFFF00",
        "meses": "Enero - Febrero - Marzo",
        "meses_num": [1, 2, 3],
        "rgb_excel": "FFFF00",
        "txt_color": "000000",
    },
    {
        "periodo": 2,
        "trimestre": 2,
        "label": "II Trimestre",
        "nombre": "Verde",
        "hex": "#00B050",
        "meses": "Abril - Mayo - Junio",
        "meses_num": [4, 5, 6],
        "rgb_excel": "00B050",
        "txt_color": "FFFFFF",
    },
    {
        "periodo": 3,
        "trimestre": 3,
        "label": "III Trimestre",
        "nombre": "Azul",
        "hex": "#0070C0",
        "meses": "Julio - Agosto - Septiembre",
        "meses_num": [7, 8, 9],
        "rgb_excel": "0070C0",
        "txt_color": "FFFFFF",
    },
    {
        "periodo": 4,
        "trimestre": 4,
        "label": "IV Trimestre",
        "nombre": "Rojo",
        "hex": "#FF0000",
        "meses": "Octubre - Noviembre - Diciembre",
        "meses_num": [10, 11, 12],
        "rgb_excel": "FF0000",
        "txt_color": "FFFFFF",
    },
]

LEYENDA_COLORES_BIMESTRAL = [
    {
        "periodo": 1,
        "bimestre": 1,
        "label": "I Bimestre",
        "nombre": "Amarillo",
        "hex": "#FFFF00",
        "meses": "Enero - Febrero",
        "meses_num": [1, 2],
        "rgb_excel": "FFFF00",
        "txt_color": "000000",
    },
    {
        "periodo": 2,
        "bimestre": 2,
        "label": "II Bimestre",
        "nombre": "Verde",
        "hex": "#00B050",
        "meses": "Marzo - Abril",
        "meses_num": [3, 4],
        "rgb_excel": "00B050",
        "txt_color": "FFFFFF",
    },
    {
        "periodo": 3,
        "bimestre": 3,
        "label": "III Bimestre",
        "nombre": "Rojo",
        "hex": "#FF0000",
        "meses": "Mayo - Junio",
        "meses_num": [5, 6],
        "rgb_excel": "FF0000",
        "txt_color": "FFFFFF",
    },
    {
        "periodo": 4,
        "bimestre": 4,
        "label": "IV Bimestre",
        "nombre": "Azul",
        "hex": "#0070C0",
        "meses": "Julio - Agosto",
        "meses_num": [7, 8],
        "rgb_excel": "0070C0",
        "txt_color": "FFFFFF",
    },
    {
        "periodo": 5,
        "bimestre": 5,
        "label": "V Bimestre",
        "nombre": "Negro",
        "hex": "#000000",
        "meses": "Septiembre - Octubre",
        "meses_num": [9, 10],
        "rgb_excel": "000000",
        "txt_color": "FFFFFF",
    },
    {
        "periodo": 6,
        "bimestre": 6,
        "label": "VI Bimestre",
        "nombre": "Blanco",
        "hex": "#FFFFFF",
        "meses": "Noviembre - Diciembre",
        "meses_num": [11, 12],
        "rgb_excel": "FFFFFF",
        "txt_color": "000000",
    },
]

LEYENDA_COLORES = LEYENDA_COLORES_TRIMESTRAL


def color_inspeccion_actual(para_fecha: date | None = None, frecuencia: str = "trimestral") -> dict:
    """
    Devuelve el color del periodo actual (bimestre o trimestre) y la leyenda completa.

    Args:
        para_fecha: Fecha base para determinar el mes.
        frecuencia: 'bimestral', 'trimestral' u otra.

    Returns:
        {
          "tipo_periodo": "bimestral" | "trimestral",
          "actual": { ... datos del color y periodo activo ... },
          "leyenda": [ ... lista de colores del esquema ... ],
        }
    """
    hoy = para_fecha or date.today()
    mes = hoy.month  # 1 a 12
    freq_norm = (frecuencia or "trimestral").lower()

    if freq_norm == "bimestral":
        bimestre_idx = (mes - 1) // 2  # 0 a 5
        actual = LEYENDA_COLORES_BIMESTRAL[bimestre_idx]
        return {
            "tipo_periodo": "bimestral",
            "actual": actual,
            "leyenda": LEYENDA_COLORES_BIMESTRAL,
        }
    else:
        trimestre_idx = (mes - 1) // 3  # 0 a 3
        actual = LEYENDA_COLORES_TRIMESTRAL[trimestre_idx]
        return {
            "tipo_periodo": "trimestral",
            "actual": actual,
            "leyenda": LEYENDA_COLORES_TRIMESTRAL,
        }