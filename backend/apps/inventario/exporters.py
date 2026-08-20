"""
Exportadores Excel para el módulo de Inventario/Movimientos.
Genera reportes profesionales con diseño institucional oscuro, gráficos y tablas de resumen.
"""
import io
from collections import defaultdict

from django.utils import timezone
from openpyxl import Workbook
from openpyxl.chart import BarChart, Reference
from openpyxl.chart.label import DataLabelList
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter

from apps.inventario.models import Movimiento

# ─── Paleta de colores profesional (tonos oscuros y sobrios) ───────────────────
COLOR_HEADER = "1E293B"         # Carbón / Slate oscuro institucional
COLOR_HEADER_FONT = "FFFFFF"
COLOR_SUBHEADER = "334155"      # Slate medio oscuro
COLOR_SUBHEADER_FONT = "FFFFFF"
COLOR_ACCENT = "0EA5E9"         # Azul cyan moderno para destaques
COLOR_ROW_ALT = "F1F5F9"        # Fondo gris medio-suave para filas alternadas (zebra striping)
COLOR_ROW_BASE = "FFFFFF"       # Fondo base blanco limpio
COLOR_BORDER = "CBD5E1"         # Borde gris sutil y elegante
COLOR_TEXT = "0F172A"           # Texto principal oscuro de alta legibilidad

# Colores de tipo de movimiento (versión oscura y saturada con texto claro)
COLOR_SALIDA_BG = "1E40AF"      # Azul marino saturado
COLOR_SALIDA_TXT = "FFFFFF"     # Texto blanco
COLOR_BAJA_BG = "991B1B"        # Rojo oscuro saturado
COLOR_BAJA_TXT = "FFFFFF"       # Texto blanco
COLOR_ENTRADA_BG = "065F46"     # Verde esmeralda oscuro saturado
COLOR_ENTRADA_TXT = "FFFFFF"    # Texto blanco


def _header_font(bold=True, color=COLOR_HEADER_FONT, size=11):
    return Font(bold=bold, color=color, size=size, name="Calibri")


def _normal_font(bold=False, size=10, color=COLOR_TEXT):
    return Font(bold=bold, size=size, color=color, name="Calibri")


def _fill(hex_color):
    return PatternFill(start_color=hex_color, end_color=hex_color, fill_type="solid")


def _thin_border():
    thin = Side(style="thin", color=COLOR_BORDER)
    return Border(left=thin, right=thin, top=thin, bottom=thin)


def _write_header_row(ws, row, columns, bg_color=COLOR_HEADER, font_color=COLOR_HEADER_FONT):
    """Escribe una fila de encabezados con fondo oscuro y texto blanco."""
    fill = _fill(bg_color)
    font = _header_font(bold=True, color=font_color, size=11)
    ws.row_dimensions[row].height = 26
    for col_idx, text in enumerate(columns, start=1):
        cell = ws.cell(row=row, column=col_idx, value=text)
        cell.fill = fill
        cell.font = font
        cell.alignment = Alignment(horizontal="center", vertical="center", wrap_text=True)
        cell.border = _thin_border()


def _write_data_row(ws, row, values, row_fill=None, is_alt=False, alignments=None, cell_styles=None):
    """
    Escribe una fila de datos con bordes sutiles, zebra striping y alineación.
    Permite cell_styles={col_idx: (bg_color, font_color, bold)} para celdas individuales (ej. Tipo).
    """
    bg = row_fill or (COLOR_ROW_ALT if is_alt else COLOR_ROW_BASE)
    fill = _fill(bg) if bg else None
    ws.row_dimensions[row].height = 20
    for col_idx, value in enumerate(values, start=1):
        cell = ws.cell(row=row, column=col_idx, value=value)
        cell.border = _thin_border()
        
        if cell_styles and col_idx in cell_styles:
            c_bg, c_fc, c_bold = cell_styles[col_idx]
            cell.fill = _fill(c_bg)
            cell.font = _normal_font(bold=c_bold, color=c_fc, size=10)
        else:
            if fill:
                cell.fill = fill
            cell.font = _normal_font(bold=False, color=COLOR_TEXT, size=10)

        align = alignments.get(col_idx, "left") if alignments else "left"
        cell.alignment = Alignment(horizontal=align, vertical="center", wrap_text=False)


def _set_col_widths(ws, widths):
    for col_idx, width in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(col_idx)].width = width


def _freeze(ws, cell="A2"):
    ws.freeze_panes = cell


MESES_ES = [
    "", "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
]


# ─── Exportación general (Top 15 + Frecuencias por día/mes/año) ────────────────

def _hoja_top_materiales(wb, movimientos):
    """
    Hoja 1: Resumen con KPI Cards (material con más/menos movimientos) y Top 15 con BarChart.
    """
    ws = wb.create_sheet("Top 15 Materiales")

    # Contabilizar movimientos por material
    stats = defaultdict(lambda: {
        "codigo": "", "nombre": "", "total_movs": 0, "entradas": 0, "salidas": 0, "bajas": 0
    })

    for mov in movimientos:
        mid = mov.material_id
        if not mid:
            continue
        st = stats[mid]
        st["codigo"] = mov.material.codigo if mov.material else str(mid)
        st["nombre"] = mov.material.nombre if mov.material else "—"
        st["total_movs"] += 1
        if mov.tipo == "entrada":
            st["entradas"] += (mov.cantidad or 1)
        elif mov.tipo == "salida":
            st["salidas"] += (mov.cantidad or 1)
        elif mov.tipo == "baja":
            st["bajas"] += (mov.cantidad or 1)

    sorted_mats = sorted(stats.values(), key=lambda x: x["total_movs"], reverse=True)

    # 1. Título General
    ws.merge_cells("A1:G1")
    title_cell = ws["A1"]
    title_cell.value = "INCALPACA TOPS S.A. — REPORTE GENERAL DE MOVIMIENTOS DE ALMACÉN"
    title_cell.font = Font(bold=True, size=13, color="FFFFFF", name="Calibri")
    title_cell.fill = _fill(COLOR_HEADER)
    title_cell.alignment = Alignment(horizontal="center", vertical="center")
    ws.row_dimensions[1].height = 30

    # 2. Tarjetas de Resumen (Más / Menos movimientos)
    max_mat = sorted_mats[0] if sorted_mats else {"codigo": "—", "nombre": "Sin datos", "total_movs": 0}
    min_mat = sorted_mats[-1] if sorted_mats else {"codigo": "—", "nombre": "Sin datos", "total_movs": 0}

    # Tarjeta 1: Más movimientos (A3:C4)
    ws.merge_cells("A3:C3")
    card1_title = ws["A3"]
    card1_title.value = "MATERIAL CON MÁS MOVIMIENTOS"
    card1_title.font = Font(bold=True, size=10, color="FFFFFF", name="Calibri")
    card1_title.fill = _fill("0F766E")  # Teal oscuro
    card1_title.alignment = Alignment(horizontal="center", vertical="center")

    ws.merge_cells("A4:C4")
    card1_val = ws["A4"]
    card1_val.value = f"{max_mat['codigo']} — {max_mat['nombre']} ({max_mat['total_movs']} movs.)"
    card1_val.font = Font(bold=True, size=10, color="0F172A", name="Calibri")
    card1_val.fill = _fill("CCFBF1")
    card1_val.alignment = Alignment(horizontal="center", vertical="center")
    card1_val.border = _thin_border()

    # Tarjeta 2: Menos movimientos (E3:G3)
    ws.merge_cells("E3:G3")
    card2_title = ws["E3"]
    card2_title.value = "MATERIAL CON MENOS MOVIMIENTOS"
    card2_title.font = Font(bold=True, size=10, color="FFFFFF", name="Calibri")
    card2_title.fill = _fill("B45309")  # Ámbar oscuro
    card2_title.alignment = Alignment(horizontal="center", vertical="center")

    ws.merge_cells("E4:G4")
    card2_val = ws["E4"]
    card2_val.value = f"{min_mat['codigo']} — {min_mat['nombre']} ({min_mat['total_movs']} movs.)"
    card2_val.font = Font(bold=True, size=10, color="0F172A", name="Calibri")
    card2_val.fill = _fill("FEF3C7")
    card2_val.alignment = Alignment(horizontal="center", vertical="center")
    card2_val.border = _thin_border()

    ws.row_dimensions[3].height = 20
    ws.row_dimensions[4].height = 24

    # 3. Tabla Top 15 (Filas 6 en adelante)
    top_15 = sorted_mats[:15]
    cols = ["Puesto", "Código", "Material", "Movimientos", "Entradas (u.)", "Salidas (u.)", "Bajas (u.)"]
    widths = [8, 14, 38, 14, 14, 14, 14]
    _write_header_row(ws, 6, cols, bg_color=COLOR_HEADER)
    _set_col_widths(ws, widths)

    alignments = {1: "center", 2: "center", 3: "left", 4: "center", 5: "center", 6: "center", 7: "center"}

    for idx, mat in enumerate(top_15, start=1):
        row_num = 6 + idx
        _write_data_row(ws, row_num, [
            idx,
            mat["codigo"],
            mat["nombre"],
            mat["total_movs"],
            mat["entradas"],
            mat["salidas"],
            mat["bajas"],
        ], is_alt=(idx % 2 == 0), alignments=alignments)

    # 4. Insertar Gráfico de Barras con nombres de material claros y etiquetas de valor
    if top_15:
        chart = BarChart()
        chart.type = "col"
        chart.style = 10
        chart.title = "Top 15 Materiales con Más Movimientos"
        chart.y_axis.title = "Total Movimientos"
        chart.x_axis.tickLblPos = "low"
        chart.x_axis.tickLblSkip = 1
        chart.legend = None
        chart.width = 22
        chart.height = 14

        # Etiquetas con valor numérico sobre cada barra
        chart.dataLabels = DataLabelList()
        chart.dataLabels.showVal = True

        data = Reference(ws, min_col=4, min_row=6, max_row=6 + len(top_15))
        cats = Reference(ws, min_col=3, min_row=7, max_row=6 + len(top_15))
        chart.add_data(data, titles_from_data=True)
        chart.set_categories(cats)

        ws.add_chart(chart, "I6")


def _obtener_ot_code(mov):
    """Extrae el código de OT del movimiento (desde referencia_externa o atributo work_order)."""
    if hasattr(mov, "work_order") and mov.work_order:
        return mov.work_order.code
    ref = (mov.referencia_externa or "").strip()
    if ref and ("OT" in ref.upper() or "-" in ref):
        return ref
    elif ref:
        return ref
    return None


def _construir_frecuencia_general(movimientos):
    """
    Devuelve 3 diccionarios agrupados con órdenes de trabajo asociadas:
      por_dia:  {(fecha, material_id) -> {nombre, codigo, entrada, salida, baja, ots: set()}}
      por_mes:  {(anio, mes, material_id) -> {...}}
      por_anio: {(anio, material_id) -> {...}}
    """
    por_dia = defaultdict(lambda: {"nombre": "", "codigo": "", "entrada": 0, "salida": 0, "baja": 0, "ots": set()})
    por_mes = defaultdict(lambda: {"nombre": "", "codigo": "", "entrada": 0, "salida": 0, "baja": 0, "ots": set()})
    por_anio = defaultdict(lambda: {"nombre": "", "codigo": "", "entrada": 0, "salida": 0, "baja": 0, "ots": set()})

    for mov in movimientos:
        fecha = mov.fecha.date() if hasattr(mov.fecha, "date") else mov.fecha
        anio, mes = fecha.year, fecha.month
        mid = mov.material_id
        nombre = mov.material.nombre if mov.material else "—"
        codigo = mov.material.codigo if mov.material else "—"
        cantidad = mov.cantidad or 1
        ot_code = _obtener_ot_code(mov)

        key_d = (fecha, mid)
        key_m = (anio, mes, mid)
        key_a = (anio, mid)

        for d in [por_dia[key_d], por_mes[key_m], por_anio[key_a]]:
            d["nombre"] = nombre
            d["codigo"] = codigo
            if ot_code:
                d["ots"].add(ot_code)

        por_dia[key_d][mov.tipo] += cantidad
        por_mes[key_m][mov.tipo] += cantidad
        por_anio[key_a][mov.tipo] += cantidad

    return por_dia, por_mes, por_anio


def _hoja_por_dia(wb, por_dia):
    ws = wb.create_sheet("Por Día")
    cols = ["Fecha", "Código", "Material", "Entradas", "Salidas", "Bajas", "Total", "Órdenes de Trabajo asociadas"]
    widths = [14, 14, 38, 10, 10, 10, 10, 32]
    _write_header_row(ws, 1, cols)
    _set_col_widths(ws, widths)
    _freeze(ws)

    alignments = {1: "center", 2: "center", 3: "left", 4: "center", 5: "center", 6: "center", 7: "center", 8: "left"}

    rows = sorted(por_dia.items(), key=lambda x: (x[0][0], -sum([x[1]["entrada"], x[1]["salida"], x[1]["baja"]])))
    for r_idx, ((fecha, _), d) in enumerate(rows, start=2):
        total = d["entrada"] + d["salida"] + d["baja"]
        ots_str = ", ".join(sorted(d["ots"])) if d["ots"] else "—"
        _write_data_row(ws, r_idx, [
            fecha.strftime("%d/%m/%Y"),
            d["codigo"], d["nombre"],
            d["entrada"] or "", d["salida"] or "", d["baja"] or "", total,
            ots_str,
        ], is_alt=(r_idx % 2 == 0), alignments=alignments)
    ws.auto_filter.ref = f"A1:H{max(2, len(rows) + 1)}"


def _hoja_por_mes(wb, por_mes):
    ws = wb.create_sheet("Por Mes")
    cols = ["Año", "Mes", "Código", "Material", "Entradas", "Salidas", "Bajas", "Total", "Órdenes de Trabajo asociadas"]
    widths = [8, 8, 14, 38, 10, 10, 10, 10, 32]
    _write_header_row(ws, 1, cols)
    _set_col_widths(ws, widths)
    _freeze(ws)

    alignments = {1: "center", 2: "center", 3: "center", 4: "left", 5: "center", 6: "center", 7: "center", 8: "center", 9: "left"}

    rows = sorted(por_mes.items(), key=lambda x: (x[0][0], x[0][1], -sum([x[1]["entrada"], x[1]["salida"], x[1]["baja"]])))
    for r_idx, ((anio, mes, _), d) in enumerate(rows, start=2):
        total = d["entrada"] + d["salida"] + d["baja"]
        ots_str = ", ".join(sorted(d["ots"])) if d["ots"] else "—"
        _write_data_row(ws, r_idx, [
            anio, MESES_ES[mes],
            d["codigo"], d["nombre"],
            d["entrada"] or "", d["salida"] or "", d["baja"] or "", total,
            ots_str,
        ], is_alt=(r_idx % 2 == 0), alignments=alignments)
    ws.auto_filter.ref = f"A1:I{max(2, len(rows) + 1)}"


def _hoja_por_anio(wb, por_anio):
    ws = wb.create_sheet("Por Año")
    cols = ["Año", "Código", "Material", "Entradas", "Salidas", "Bajas", "Total", "Órdenes de Trabajo asociadas"]
    widths = [8, 14, 38, 10, 10, 10, 10, 32]
    _write_header_row(ws, 1, cols)
    _set_col_widths(ws, widths)
    _freeze(ws)

    alignments = {1: "center", 2: "center", 3: "left", 4: "center", 5: "center", 6: "center", 7: "center", 8: "left"}

    rows = sorted(por_anio.items(), key=lambda x: (x[0][0], -sum([x[1]["entrada"], x[1]["salida"], x[1]["baja"]])))
    for r_idx, ((anio, _), d) in enumerate(rows, start=2):
        total = d["entrada"] + d["salida"] + d["baja"]
        ots_str = ", ".join(sorted(d["ots"])) if d["ots"] else "—"
        _write_data_row(ws, r_idx, [
            anio, d["codigo"], d["nombre"],
            d["entrada"] or "", d["salida"] or "", d["baja"] or "", total,
            ots_str,
        ], is_alt=(r_idx % 2 == 0), alignments=alignments)
    ws.auto_filter.ref = f"A1:H{max(2, len(rows) + 1)}"


# ─── Exportación por material (historial + resumen) ───────────────────────────

def _hoja_historial_material(wb, movimientos, material):
    ws = wb.create_sheet("Historial")
    cols = ["Fecha", "Hora", "Tipo", "Cantidad", "Empaques", "Responsable", "Referencia", "Orden de Trabajo", "Observaciones"]
    widths = [14, 10, 14, 10, 10, 26, 18, 18, 38]
    _write_header_row(ws, 1, cols)
    _set_col_widths(ws, widths)
    _freeze(ws)

    tipo_styles = {
        "salida": (COLOR_SALIDA_BG, COLOR_SALIDA_TXT, True),
        "baja": (COLOR_BAJA_BG, COLOR_BAJA_TXT, True),
        "entrada": (COLOR_ENTRADA_BG, COLOR_ENTRADA_TXT, True),
    }

    alignments = {
        1: "center", 2: "center", 3: "center", 4: "center", 5: "center",
        6: "left", 7: "center", 8: "center", 9: "left",
    }

    for r_idx, mov in enumerate(movimientos, start=2):
        fecha = mov.fecha.date() if hasattr(mov.fecha, "date") else mov.fecha
        hora = mov.fecha.strftime("%H:%M") if hasattr(mov.fecha, "strftime") else ""
        responsable = (
            mov.responsable.get_full_name() or mov.responsable.username
            if mov.responsable else "N/A"
        )
        t_style = tipo_styles.get(mov.tipo)
        cell_styles = {3: t_style} if t_style else None
        ot_code = _obtener_ot_code(mov) or "—"

        _write_data_row(ws, r_idx, [
            fecha.strftime("%d/%m/%Y"), hora,
            mov.get_tipo_display(),
            mov.cantidad, mov.cantidad_cajas or "",
            responsable,
            mov.referencia_externa or "—",
            ot_code,
            mov.observaciones or "—",
        ], is_alt=(r_idx % 2 == 0), alignments=alignments, cell_styles=cell_styles)

    ws.auto_filter.ref = f"A1:I{max(2, len(movimientos) + 1)}"


def _hoja_resumen_dia_material(wb, movimientos):
    ws = wb.create_sheet("Resumen por Día")
    cols = ["Fecha", "Entradas", "Salidas", "Bajas", "Total", "Órdenes de Trabajo asociadas"]
    widths = [14, 12, 12, 12, 12, 30]
    _write_header_row(ws, 1, cols)
    _set_col_widths(ws, widths)
    _freeze(ws)

    alignments = {1: "center", 2: "center", 3: "center", 4: "center", 5: "center", 6: "left"}

    por_dia = defaultdict(lambda: {"entrada": 0, "salida": 0, "baja": 0, "ots": set()})
    for mov in movimientos:
        fecha = mov.fecha.date() if hasattr(mov.fecha, "date") else mov.fecha
        por_dia[fecha][mov.tipo] += mov.cantidad or 1
        ot_code = _obtener_ot_code(mov)
        if ot_code:
            por_dia[fecha]["ots"].add(ot_code)

    rows = sorted(por_dia.items())
    for r_idx, (fecha, d) in enumerate(rows, start=2):
        total = d["entrada"] + d["salida"] + d["baja"]
        ots_str = ", ".join(sorted(d["ots"])) if d["ots"] else "—"
        _write_data_row(ws, r_idx, [
            fecha.strftime("%d/%m/%Y"),
            d["entrada"] or "", d["salida"] or "", d["baja"] or "", total,
            ots_str,
        ], is_alt=(r_idx % 2 == 0), alignments=alignments)

    ws.auto_filter.ref = f"A1:F{max(2, len(rows) + 1)}"


def _hoja_resumen_mes_material(wb, movimientos):
    ws = wb.create_sheet("Resumen por Mes")
    cols = ["Año", "Mes", "Entradas", "Salidas", "Bajas", "Total", "Órdenes de Trabajo asociadas"]
    widths = [8, 8, 12, 12, 12, 12, 30]
    _write_header_row(ws, 1, cols)
    _set_col_widths(ws, widths)
    _freeze(ws)

    alignments = {1: "center", 2: "center", 3: "center", 4: "center", 5: "center", 6: "center", 7: "left"}

    por_mes = defaultdict(lambda: {"entrada": 0, "salida": 0, "baja": 0, "ots": set()})
    for mov in movimientos:
        fecha = mov.fecha.date() if hasattr(mov.fecha, "date") else mov.fecha
        por_mes[(fecha.year, fecha.month)][mov.tipo] += mov.cantidad or 1
        ot_code = _obtener_ot_code(mov)
        if ot_code:
            por_mes[(fecha.year, fecha.month)]["ots"].add(ot_code)

    rows = sorted(por_mes.items())
    for r_idx, ((anio, mes), d) in enumerate(rows, start=2):
        total = d["entrada"] + d["salida"] + d["baja"]
        ots_str = ", ".join(sorted(d["ots"])) if d["ots"] else "—"
        _write_data_row(ws, r_idx, [
            anio, MESES_ES[mes],
            d["entrada"] or "", d["salida"] or "", d["baja"] or "", total,
            ots_str,
        ], is_alt=(r_idx % 2 == 0), alignments=alignments)

    ws.auto_filter.ref = f"A1:G{max(2, len(rows) + 1)}"


# ─── Punto de entrada principal ───────────────────────────────────────────────

def generar_excel_movimientos(material_id=None):
    """
    Genera el Excel de movimientos con diseño profesional y tonalidades oscuras.
    - Sin material_id: Hoja de Top 15 + KPI cards con gráfico y 3 hojas de frecuencia general (Por Día, Por Mes, Por Año).
    - Con material_id: 3 hojas del historial de ese material (Historial, Resumen por Día, Resumen por Mes) con columna OT.
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
        ).select_related("material", "responsable", "pieza").order_by("-fecha")

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
        qs = Movimiento.objects.select_related("material", "responsable", "pieza").order_by("-fecha")
        movimientos = list(qs)
        por_dia, por_mes, por_anio = _construir_frecuencia_general(movimientos)

        _hoja_top_materiales(wb, movimientos)
        _hoja_por_dia(wb, por_dia)
        _hoja_por_mes(wb, por_mes)
        _hoja_por_anio(wb, por_anio)

        filename = f"movimientos_frecuencia_{hoy.isoformat()}.xlsx"

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer, filename
