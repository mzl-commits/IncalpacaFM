import io
import unicodedata
from pathlib import Path

from openpyxl import load_workbook
from openpyxl.styles import Font

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER


TEMPLATE_PATH = Path(__file__).resolve().parent / "plantillas" / "Formato_Inspeccion.xlsx"

# Los nombres de hoja deben coincidir EXACTO con el archivo Formato_Inspeccion.xlsx
# (Ojo: "Electricas con cable " lleva un espacio al final, tal como quedo en la plantilla original).
HOJA_MANUALES = "Manuales"
HOJA_INALAMBRICAS = "Electricas Inalambricas"
HOJA_CON_CABLE = "Electricas con cable "

RESULTADO_COLS = {"apta": "C", "requiere_reparacion": "E", "fuera_servicio": "G"}
ACCION_COLS = {
    "continua_servicio": "A",
    "enviar_reparacion": "C",
    "retirar_servicio": "D",
    "dar_baja": "E",
    "reemplazar": "F",
}

CONFIG_INDIVIDUAL_COMUN = {
    "campos": {
        "codigo_herramienta": "C8",
        "proxima_inspeccion": "G8",
        "marca": "C9",
        "inspector": "C10",
        "fecha_inspeccion": "C11",
        "nombre_herramienta": "C12",
    },
}

CONFIG_HOJAS = {
    HOJA_MANUALES: {
        "tipo": "grupal",
        "criterio_data_start": 15,
        "campos": {
            "tipo_herramienta": "C8",
            "responsable": "G8",
            "cant_inspeccionada": "C9",
            "fecha_inspeccion": "G9",
            "cant_apta": "C10",
            "proxima_inspeccion": "G10",
            "cant_no_apta": "C11",
        },
        "resultado_aptas_row": 44,
        "resultado_observaciones_row": 45,
        "observaciones_generales": "A48",
    },
    HOJA_INALAMBRICAS: {
        "tipo": "individual",
        "criterio_data_start": 16,
        "campos": CONFIG_INDIVIDUAL_COMUN["campos"],
        "resultado_row": 37,
        "accion_row": 41,
        "observaciones_generales": "A44",
    },
    HOJA_CON_CABLE: {
        "tipo": "individual",
        "criterio_data_start": 16,
        "campos": CONFIG_INDIVIDUAL_COMUN["campos"],
        "resultado_row": 35,
        "accion_row": 39,
        "observaciones_generales": "A42",
    },
}


def _normalizar(texto):
    """Quita tildes/mayusculas y corrige mojibake comun (utf-8 mal leido como latin-1)."""
    if not texto:
        return ""
    try:
        texto = texto.encode("latin-1").decode("utf-8")
    except (UnicodeDecodeError, UnicodeEncodeError):
        pass
    texto = unicodedata.normalize("NFKD", texto)
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    return texto.lower()


def _detectar_hoja(plantilla_nombre):
    nombre = _normalizar(plantilla_nombre)
    if "manual" in nombre:
        return HOJA_MANUALES
    if "cable" in nombre:
        return HOJA_CON_CABLE
    if "inalambric" in nombre or "bateria" in nombre:
        return HOJA_INALAMBRICAS
    return None


def _fecha(valor):
    return valor.strftime("%d/%m/%Y") if valor else ""


def _codigo_documento(inspeccion):
    """Genera el código de documento SST: FOR-SST-00XXX (basado en el ID de la inspección)."""
    return f"FOR-SST-{inspeccion.id:05d}"


def _fecha_emision_hoy():
    from datetime import date
    return date.today().strftime("%d/%m/%Y")


# ─────────────────────────────────────────────────────────────────────────────
# EXCEL
# ─────────────────────────────────────────────────────────────────────────────

def generar_excel_inspeccion(inspeccion):
    hoja_nombre = _detectar_hoja(inspeccion.plantilla.nombre)

    if hoja_nombre is None or not TEMPLATE_PATH.exists():
        return _generar_excel_simple(inspeccion)

    wb = load_workbook(TEMPLATE_PATH)
    for nombre in list(wb.sheetnames):
        if nombre != hoja_nombre:
            del wb[nombre]
    ws = wb[hoja_nombre]

    config = CONFIG_HOJAS[hoja_nombre]
    campos = config["campos"]

    inspector_nombre = (
        inspeccion.inspector.get_full_name() or inspeccion.inspector.username
        if inspeccion.inspector else ""
    )
    codigo_objetivo = inspeccion.pieza.codigo if inspeccion.pieza else inspeccion.material.codigo

    # Código del documento SST (H1) y fecha de emisión (H3)
    try:
        ws["H1"] = _codigo_documento(inspeccion)
        ws["H3"] = _fecha_emision_hoy()
    except Exception:
        pass

    if config["tipo"] == "grupal":
        ws[campos["tipo_herramienta"]] = inspeccion.material.nombre
        ws[campos["responsable"]] = inspector_nombre
        ws[campos["cant_inspeccionada"]] = inspeccion.cantidad_inspeccionada or ""
        ws[campos["fecha_inspeccion"]] = _fecha(inspeccion.fecha)
        ws[campos["cant_apta"]] = inspeccion.cantidad_apta or ""
        ws[campos["proxima_inspeccion"]] = _fecha(inspeccion.proxima_inspeccion)
        ws[campos["cant_no_apta"]] = inspeccion.cantidad_no_apta or ""
    else:
        ws[campos["codigo_herramienta"]] = codigo_objetivo
        ws[campos["proxima_inspeccion"]] = _fecha(inspeccion.proxima_inspeccion)
        ws[campos["marca"]] = inspeccion.material.marca
        ws[campos["inspector"]] = inspector_nombre
        ws[campos["fecha_inspeccion"]] = _fecha(inspeccion.fecha)
        ws[campos["nombre_herramienta"]] = inspeccion.material.nombre

    # Criterios: se apoya en el orden del criterio para ubicar la fila correcta.
    col_valor = {"cumple": "C", "no_cumple": "D", "no_aplica": "E"}
    fila_base = config["criterio_data_start"] - 1  # criterio orden=1 -> primera fila de datos
    for resp in inspeccion.respuestas.select_related("criterio").all():
        fila = fila_base + resp.criterio.orden
        col = col_valor.get(resp.valor)
        if col:
            ws[f"{col}{fila}"] = "X"
        if resp.observacion:
            ws[f"F{fila}"] = resp.observacion

    if config["tipo"] == "grupal":
        aptas_row = config["resultado_aptas_row"]
        obs_row = config["resultado_observaciones_row"]
        if inspeccion.cantidad_no_apta:
            ws[f"A{aptas_row}"] = "\u2610 Todas las herramientas inspeccionadas se encuentran aptas."
            ws[f"A{obs_row}"] = "\u2611 Existen herramientas con observaciones (ver tabla anterior)."
        else:
            ws[f"A{aptas_row}"] = "\u2611 Todas las herramientas inspeccionadas se encuentran aptas."
            ws[f"A{obs_row}"] = "\u2610 Existen herramientas con observaciones (ver tabla anterior)."
    else:
        col_resultado = RESULTADO_COLS.get(inspeccion.resultado_general)
        if col_resultado:
            celda = ws[f"{col_resultado}{config['resultado_row']}"]
            celda.value = "X"
            celda.font = Font(bold=True, size=14)

        col_accion = ACCION_COLS.get(inspeccion.accion_tomada)
        if col_accion:
            celda = ws[f"{col_accion}{config['accion_row']}"]
            celda.value = "X"
            celda.font = Font(bold=True, size=14)

    if inspeccion.observaciones:
        ws[config["observaciones_generales"]] = inspeccion.observaciones

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer


def _generar_excel_simple(inspeccion):
    """Respaldo: formato basico usado antes, para plantillas que no coincidan con ninguna hoja conocida."""
    from openpyxl import Workbook

    wb = Workbook()
    ws = wb.active
    ws.title = "Inspeccion"

    objetivo = inspeccion.pieza.codigo if inspeccion.pieza else inspeccion.material.codigo
    codigo_doc = _codigo_documento(inspeccion)
    fecha_emision = _fecha_emision_hoy()

    ws.append(["INCALPACA TOPS S.A. - Formato de Inspección de Herramientas"])
    ws["A1"].font = Font(bold=True, size=14)
    ws.append([])
    ws.append(["Código documento:", codigo_doc, "", "Fecha de emisión:", fecha_emision])
    ws[f"A3"].font = Font(bold=True)
    ws[f"D3"].font = Font(bold=True)
    ws.append(["Código herramienta:", objetivo])
    ws.append(["Material:", inspeccion.material.nombre])
    ws.append(["Tipo:", inspeccion.get_tipo_display()])
    ws.append(["Plantilla:", inspeccion.plantilla.nombre])
    inspector_nombre = inspeccion.inspector.get_full_name() or inspeccion.inspector.username
    ws.append(["Inspector:", inspector_nombre])
    ws.append(["Fecha inspeción:", _fecha(inspeccion.fecha)])
    ws.append([])

    ws.append(["N", "Criterio", "Cumple", "No cumple", "No aplica", "Observaciones"])
    for cell in ws[ws.max_row]:
        cell.font = Font(bold=True)

    for resp in inspeccion.respuestas.select_related("criterio").order_by("criterio__orden"):
        ws.append([
            resp.criterio.orden,
            resp.criterio.texto,
            "X" if resp.valor == "cumple" else "",
            "X" if resp.valor == "no_cumple" else "",
            "X" if resp.valor == "no_aplica" else "",
            resp.observacion,
        ])

    ws.append([])
    ws.append(["Resultado general:", inspeccion.get_resultado_general_display()])
    ws.append(["Accion tomada:", inspeccion.get_accion_tomada_display()])
    ws.append(["Observaciones generales:", inspeccion.observaciones])
    ws.append([])
    ws.append(["FIRMAS DE CONFORMIDAD"])
    ws.append(["Inspector", "", "Supervisor SST / Mantenimiento", "", "Responsable de Area"])
    ws.append(["Fecha: ____________", "", "Fecha: ____________", "", "Fecha: ____________"])

    for col in ["A", "B", "C", "D", "E", "F"]:
        ws.column_dimensions[col].width = 22

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer


# ─────────────────────────────────────────────────────────────────────────────
# PDF
# ─────────────────────────────────────────────────────────────────────────────

TITULOS_PDF = {
    HOJA_MANUALES: "FORMATO DE INSPECCIÓN GRUPAL DE HERRAMIENTAS MANUALES",
    HOJA_INALAMBRICAS: "FORMATO DE INSPECCIÓN DE HERRAMIENTAS ELÉCTRICAS INALÁMBRICAS",
    HOJA_CON_CABLE: "FORMATO DE INSPECCIÓN DE HERRAMIENTAS ELÉCTRICAS CON CABLE",
}

AZUL_INCALPACA = colors.HexColor("#0f1f3d")


def generar_pdf_inspeccion(inspeccion):
    hoja_nombre = _detectar_hoja(inspeccion.plantilla.nombre)
    titulo = TITULOS_PDF.get(hoja_nombre, "FORMATO DE INSPECCIÓN DE HERRAMIENTAS")

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=letter,
        topMargin=1.2 * cm, bottomMargin=1.2 * cm,
        leftMargin=1.5 * cm, rightMargin=1.5 * cm,
    )
    styles = getSampleStyleSheet()
    titulo_style = ParagraphStyle(
        "TituloInspeccion", parent=styles["Title"], fontSize=13, leading=16,
        textColor=colors.white, alignment=TA_CENTER,
    )
    subtitulo_style = ParagraphStyle(
        "Subtitulo", parent=styles["Normal"], fontSize=8, textColor=colors.white,
        alignment=TA_CENTER,
    )
    seccion_style = ParagraphStyle(
        "Seccion", parent=styles["Heading3"], fontSize=10, textColor=colors.white,
    )
    elementos = []

    # ── Encabezado ──
    codigo_doc = _codigo_documento(inspeccion)
    fecha_emision = _fecha_emision_hoy()
    meta_style = ParagraphStyle(
        "MetaDoc", parent=styles["Normal"], fontSize=7.5,
        textColor=colors.white, alignment=TA_CENTER,
    )
    encabezado = Table(
        [[Paragraph("INCALPACA", ParagraphStyle("logo", fontSize=16, textColor=colors.white, fontName="Helvetica-Bold"))],
         [Paragraph(titulo, titulo_style)],
         [Paragraph("Área: Mantenimiento de Servicios Generales", subtitulo_style)],
         [Paragraph(f"Código: <b>{codigo_doc}</b>  |  Fecha de emisión: <b>{fecha_emision}</b>", meta_style)]],
        colWidths=[18 * cm],
    )
    encabezado.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), AZUL_INCALPACA),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    elementos.append(encabezado)
    elementos.append(Spacer(1, 10))

    # ── Datos generales ──
    inspector_nombre = (
        inspeccion.inspector.get_full_name() or inspeccion.inspector.username
        if inspeccion.inspector else ""
    )
    codigo_objetivo = inspeccion.pieza.codigo if inspeccion.pieza else inspeccion.material.codigo

    if hoja_nombre == HOJA_MANUALES:
        datos = [
            ["Tipo de herramienta:", inspeccion.material.nombre, "Responsable:", inspector_nombre],
            ["Cantidad inspeccionada:", inspeccion.cantidad_inspeccionada or "-", "Fecha de inspección:", _fecha(inspeccion.fecha)],
            ["Cantidad apta:", inspeccion.cantidad_apta or "-", "Próxima inspección:", _fecha(inspeccion.proxima_inspeccion)],
            ["Cantidad no apta:", inspeccion.cantidad_no_apta or "-", "", ""],
        ]
    else:
        datos = [
            ["Código de la herramienta:", codigo_objetivo, "Próxima inspección:", _fecha(inspeccion.proxima_inspeccion)],
            ["Marca:", inspeccion.material.marca or "-", "", ""],
            ["Inspector responsable:", inspector_nombre, "", ""],
            ["Fecha de inspección:", _fecha(inspeccion.fecha), "", ""],
            ["Nombre de la herramienta:", inspeccion.material.nombre, "", ""],
        ]

    tabla_datos = Table(datos, colWidths=[4.3 * cm, 4.7 * cm, 4.3 * cm, 4.7 * cm])
    tabla_datos.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elementos.append(tabla_datos)
    elementos.append(Spacer(1, 10))

    # ── Criterios ──
    data = [["N°", "Criterio de inspección", "Cumple", "No cumple", "No aplica", "Obs."]]
    for resp in inspeccion.respuestas.select_related("criterio").order_by("criterio__orden"):
        data.append([
            resp.criterio.orden,
            Paragraph(resp.criterio.texto, styles["Normal"]),
            "X" if resp.valor == "cumple" else "",
            "X" if resp.valor == "no_cumple" else "",
            "X" if resp.valor == "no_aplica" else "",
            resp.observacion,
        ])

    tabla = Table(data, colWidths=[1.2 * cm, 7.3 * cm, 1.9 * cm, 2.1 * cm, 1.9 * cm, 3.6 * cm], repeatRows=1)
    tabla.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), AZUL_INCALPACA),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("ALIGN", (2, 0), (4, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f2f5fa")]),
    ]))
    elementos.append(tabla)
    elementos.append(Spacer(1, 12))

    # ── Resultado y acción ──
    def _marca(activo):
        return "\u2611" if activo else "\u2610"

    if hoja_nombre != HOJA_MANUALES:
        resultado_txt = (
            f"{_marca(inspeccion.resultado_general == 'apta')} Apta &nbsp;&nbsp;&nbsp;"
            f"{_marca(inspeccion.resultado_general == 'requiere_reparacion')} Requiere reparación &nbsp;&nbsp;&nbsp;"
            f"{_marca(inspeccion.resultado_general == 'fuera_servicio')} Fuera de servicio"
        )
        accion_txt = (
            f"{_marca(inspeccion.accion_tomada == 'continua_servicio')} Continúa en servicio &nbsp;&nbsp;"
            f"{_marca(inspeccion.accion_tomada == 'enviar_reparacion')} Enviar a reparación &nbsp;&nbsp;"
            f"{_marca(inspeccion.accion_tomada == 'retirar_servicio')} Retirar del servicio &nbsp;&nbsp;"
            f"{_marca(inspeccion.accion_tomada == 'dar_baja')} Dar de baja &nbsp;&nbsp;"
            f"{_marca(inspeccion.accion_tomada == 'reemplazar')} Reemplazar"
        )
        elementos.append(Paragraph("<b>RESULTADO DE LA INSPECCIÓN</b>", styles["Heading4"]))
        elementos.append(Paragraph(resultado_txt, styles["Normal"]))
        elementos.append(Spacer(1, 6))
        elementos.append(Paragraph("<b>ACCIÓN TOMADA</b>", styles["Heading4"]))
        elementos.append(Paragraph(accion_txt, styles["Normal"]))
    else:
        aptas_txt = (
            f"{_marca(not inspeccion.cantidad_no_apta)} Todas las herramientas inspeccionadas se encuentran aptas.<br/>"
            f"{_marca(bool(inspeccion.cantidad_no_apta))} Existen herramientas con observaciones."
        )
        elementos.append(Paragraph("<b>RESULTADO FINAL</b>", styles["Heading4"]))
        elementos.append(Paragraph(aptas_txt, styles["Normal"]))

    elementos.append(Spacer(1, 10))
    elementos.append(Paragraph("<b>OBSERVACIONES GENERALES</b>", styles["Heading4"]))
    elementos.append(Paragraph(inspeccion.observaciones or "-", styles["Normal"]))
    elementos.append(Spacer(1, 24))

    # ── Firmas ──
    firmas = Table(
        [["Inspector", "Supervisor SST / Mantenimiento", "Responsable del Área"],
         ["Fecha: ____________", "Fecha: ____________", "Fecha: ____________"]],
        colWidths=[6 * cm, 6 * cm, 6 * cm],
    )
    firmas.setStyle(TableStyle([
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("LINEABOVE", (0, 0), (-1, 0), 0.7, colors.black),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
    ]))
    elementos.append(firmas)

    doc.build(elementos)
    buffer.seek(0)
    return buffer