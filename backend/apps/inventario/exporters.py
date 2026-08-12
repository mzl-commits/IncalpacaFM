"""
Exportadores Excel para el módulo de Inventario/Movimientos.
Patrón: Workbook() desde cero con openpyxl, igual que generar_excel_inspeccion
en apps/inspeccion/exporters.py.
"""
import io
from collections import defaultdict
from datetime import date as date_type

from django.utils import timezone
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from apps.inventario.models import Movimiento

# ─── Estilo institucional ─────────────────────────────────────────────────────
COLOR_HEADER = "2D2D2D"     # Gris oscuro institucional
COLOR_HEADER_FONT = "FFFFFF"
COLOR_SUBHEADER = "E8E8E8"
COLOR_SALIDA = "FFF3CD"
COLOR_BAJA = "F8D7DA"
COLOR_ENTRADA = "D4EDDA"


def _header_font(bold=True, color=COLOR_HEADER_FONT, size=11):
    return Font(bold=bold, color=color, size=size, name="Calibri")


def _normal_font(bold=False, size=10):
    return Font(bold=bold, size=size, name="Calibri")


def _fill(hex_color):
    return PatternFill(start_color=hex_color, end_color=hex_color, fill_type="solid")


def _thin_border():
    thin = Side(style="thin", color="CCCCCC")
    return Border(left=thin, right=thin, top=thin, bottom=thin)


def _write_header_row(ws, row, columns, bg_color=COLOR_HEADER, font_color=COLOR_HEADER_FONT):
    """Escribe una fila de encabezados con fondo y fuente de color."""
    fill = _fill(bg_color)
    font = Font(bold=True, color=font_color, size=10, name="Calibri")
    for col_idx, text in enumerate(columns, start=1):
        cell = ws.cell(row=row, column=col_idx, value=text)
        cell.fill = fill
        cell.font = font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = _thin_border()


def _write_data_row(ws, row, values, row_fill=None):
    """Escribe una fila de datos con borde fino y relleno opcional."""
    for col_idx, value in enumerate(values, start=1):
        cell = ws.cell(row=row, column=col_idx, value=value)
        cell.font = _normal_font()
        cell.border = _thin_border()
        cell.alignment = Alignment(vertical="center", wrap_text=False)
        if row_fill:
            cell.fill = _fill(row_fill)


def _set_col_widths(ws, widths):
    for col_idx, width in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(col_idx)].width = width


def _freeze(ws, cell="A2"):
    ws.freeze_panes = cell


MESES_ES = [
    "", "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
]


# ─── Exportación general (por día/mes/año) ────────────────────────────────────

def _construir_frecuencia_general(movimientos):
    """
    Devuelve 3 diccionarios:
      por_dia:  {(fecha, material_id) -> {nombre, codigo, entrada, salida, baja}}
      por_mes:  {(anio, mes, material_id) -> {...}}
      por_anio: {(anio, material_id) -> {...}}
    """
    por_dia = defaultdict(lambda: {"nombre": "", "codigo": "", "entrada": 0, "salida": 0, "baja": 0})
    por_mes = defaultdict(lambda: {"nombre": "", "codigo": "", "entrada": 0, "salida": 0, "baja": 0})
    por_anio = defaultdict(lambda: {"nombre": "", "codigo": "", "entrada": 0, "salida": 0, "baja": 0})

    for mov in movimientos:
        fecha = mov.fecha.date() if hasattr(mov.fecha, "date") else mov.fecha
        anio, mes = fecha.year, fecha.month
        mid = mov.material_id
        nombre = mov.material.nombre if mov.material else "—"
        codigo = mov.material.codigo if mov.material else "—"
        cantidad = mov.cantidad or 1

        key_d = (fecha, mid)
        key_m = (anio, mes, mid)
        key_a = (anio, mid)

        for d in [por_dia[key_d], por_mes[key_m], por_anio[key_a]]:
            d["nombre"] = nombre
            d["codigo"] = codigo

        por_dia[key_d][mov.tipo] += cantidad
        por_mes[key_m][mov.tipo] += cantidad
        por_anio[key_a][mov.tipo] += cantidad

    return por_dia, por_mes, por_anio


def _hoja_por_dia(wb, por_dia):
    ws = wb.create_sheet("Por Día")
    cols = ["Fecha", "Código", "Material", "Entradas", "Salidas", "Bajas", "Total"]
    widths = [14, 14, 40, 10, 10, 10, 10]
    _write_header_row(ws, 1, cols)
    _set_col_widths(ws, widths)
    _freeze(ws)

    rows = sorted(por_dia.items(), key=lambda x: (x[0][0], -sum([x[1]["entrada"], x[1]["salida"], x[1]["baja"]])))
    for r_idx, ((fecha, _), d) in enumerate(rows, start=2):
        total = d["entrada"] + d["salida"] + d["baja"]
        row_fill = COLOR_BAJA if d["baja"] > 0 and d["salida"] == 0 else None
        _write_data_row(ws, r_idx, [
            fecha.strftime("%d/%m/%Y"),
            d["codigo"], d["nombre"],
            d["entrada"] or "", d["salida"] or "", d["baja"] or "", total,
        ], row_fill=row_fill)
    ws.auto_filter.ref = f"A1:G{max(2, len(rows) + 1)}"


def _hoja_por_mes(wb, por_mes):
    ws = wb.create_sheet("Por Mes")
    cols = ["Año", "Mes", "Código", "Material", "Entradas", "Salidas", "Bajas", "Total"]
    widths = [8, 8, 14, 40, 10, 10, 10, 10]
    _write_header_row(ws, 1, cols)
    _set_col_widths(ws, widths)
    _freeze(ws)

    rows = sorted(por_mes.items(), key=lambda x: (x[0][0], x[0][1], -sum([x[1]["entrada"], x[1]["salida"], x[1]["baja"]])))
    for r_idx, ((anio, mes, _), d) in enumerate(rows, start=2):
        total = d["entrada"] + d["salida"] + d["baja"]
        _write_data_row(ws, r_idx, [
            anio, MESES_ES[mes],
            d["codigo"], d["nombre"],
            d["entrada"] or "", d["salida"] or "", d["baja"] or "", total,
        ])
    ws.auto_filter.ref = f"A1:H{max(2, len(rows) + 1)}"


def _hoja_por_anio(wb, por_anio):
    ws = wb.create_sheet("Por Año")
    cols = ["Año", "Código", "Material", "Entradas", "Salidas", "Bajas", "Total"]
    widths = [8, 14, 40, 10, 10, 10, 10]
    _write_header_row(ws, 1, cols)
    _set_col_widths(ws, widths)
    _freeze(ws)

    rows = sorted(por_anio.items(), key=lambda x: (x[0][0], -sum([x[1]["entrada"], x[1]["salida"], x[1]["baja"]])))
    for r_idx, ((anio, _), d) in enumerate(rows, start=2):
        total = d["entrada"] + d["salida"] + d["baja"]
        _write_data_row(ws, r_idx, [
            anio, d["codigo"], d["nombre"],
            d["entrada"] or "", d["salida"] or "", d["baja"] or "", total,
        ])
    ws.auto_filter.ref = f"A1:G{max(2, len(rows) + 1)}"


# ─── Exportación por material (historial + resumen) ───────────────────────────

def _hoja_historial_material(wb, movimientos, material):
    ws = wb.create_sheet("Historial")
    cols = ["Fecha", "Hora", "Tipo", "Cantidad", "Empaques", "Responsable", "Referencia", "Observaciones"]
    widths = [14, 10, 12, 10, 10, 28, 20, 40]
    _write_header_row(ws, 1, cols)
    _set_col_widths(ws, widths)
    _freeze(ws)

    tipo_fills = {"salida": COLOR_SALIDA, "baja": COLOR_BAJA, "entrada": COLOR_ENTRADA}

    for r_idx, mov in enumerate(movimientos, start=2):
        fecha = mov.fecha.date() if hasattr(mov.fecha, "date") else mov.fecha
        hora = mov.fecha.strftime("%H:%M") if hasattr(mov.fecha, "strftime") else ""
        responsable = (
            mov.responsable.get_full_name() or mov.responsable.username
            if mov.responsable else "N/A"
        )
        row_fill = tipo_fills.get(mov.tipo)
        _write_data_row(ws, r_idx, [
            fecha.strftime("%d/%m/%Y"), hora,
            mov.get_tipo_display(),
            mov.cantidad, mov.cantidad_cajas or "",
            responsable,
            mov.referencia_externa or "",
            mov.observaciones or "",
        ], row_fill=row_fill)


def _hoja_resumen_dia_material(wb, movimientos):
    ws = wb.create_sheet("Resumen por Día")
    cols = ["Fecha", "Entradas", "Salidas", "Bajas", "Total"]
    widths = [14, 12, 12, 12, 12]
    _write_header_row(ws, 1, cols)
    _set_col_widths(ws, widths)
    _freeze(ws)

    por_dia = defaultdict(lambda: {"entrada": 0, "salida": 0, "baja": 0})
    for mov in movimientos:
        fecha = mov.fecha.date() if hasattr(mov.fecha, "date") else mov.fecha
        por_dia[fecha][mov.tipo] += mov.cantidad or 1

    for r_idx, (fecha, d) in enumerate(sorted(por_dia.items()), start=2):
        total = d["entrada"] + d["salida"] + d["baja"]
        _write_data_row(ws, r_idx, [
            fecha.strftime("%d/%m/%Y"),
            d["entrada"] or "", d["salida"] or "", d["baja"] or "", total,
        ])


def _hoja_resumen_mes_material(wb, movimientos):
    ws = wb.create_sheet("Resumen por Mes")
    cols = ["Año", "Mes", "Entradas", "Salidas", "Bajas", "Total"]
    widths = [8, 8, 12, 12, 12, 12]
    _write_header_row(ws, 1, cols)
    _set_col_widths(ws, widths)
    _freeze(ws)

    por_mes = defaultdict(lambda: {"entrada": 0, "salida": 0, "baja": 0})
    for mov in movimientos:
        fecha = mov.fecha.date() if hasattr(mov.fecha, "date") else mov.fecha
        por_mes[(fecha.year, fecha.month)][mov.tipo] += mov.cantidad or 1

    for r_idx, ((anio, mes), d) in enumerate(sorted(por_mes.items()), start=2):
        total = d["entrada"] + d["salida"] + d["baja"]
        _write_data_row(ws, r_idx, [
            anio, MESES_ES[mes],
            d["entrada"] or "", d["salida"] or "", d["baja"] or "", total,
        ])


# ─── Punto de entrada principal ───────────────────────────────────────────────

def generar_excel_movimientos(material_id=None):
    """
    Genera el Excel de movimientos.
    - Sin material_id: 3 hojas de frecuencia general (Por Día, Por Mes, Por Año).
    - Con material_id: 3 hojas del historial de ese material (Historial, Resumen por Día, Resumen por Mes).
    Devuelve (buffer, filename).
    """
    from apps.catalogo.models import Material as MaterialModel

    wb = Workbook()
    # Eliminar hoja por defecto
    wb.remove(wb.active)

    hoy = timezone.localdate()

    if material_id:
        qs = Movimiento.objects.filter(
            material_id=material_id
        ).select_related("material", "responsable").order_by("-fecha")

        material = None
        try:
            material = MaterialModel.objects.get(pk=material_id)
        except MaterialModel.DoesNotExist:
            pass

        movimientos = list(qs)
        _hoja_historial_material(wb, movimientos, material)
        _hoja_resumen_dia_material(wb, movimientos)
        _hoja_resumen_mes_material(wb, movimientos)

        codigo = (material.codigo or str(material_id)) if material else str(material_id)
        nombre = (material.nombre[:20] if material else "material").replace("/", "-").replace("\\", "-")
        filename = f"historial_{codigo}_{nombre}_{hoy.isoformat()}.xlsx"

    else:
        qs = Movimiento.objects.select_related("material", "responsable").order_by("-fecha")
        movimientos = list(qs)
        por_dia, por_mes, por_anio = _construir_frecuencia_general(movimientos)

        _hoja_por_dia(wb, por_dia)
        _hoja_por_mes(wb, por_mes)
        _hoja_por_anio(wb, por_anio)

        filename = f"movimientos_frecuencia_{hoy.isoformat()}.xlsx"

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer, filename
