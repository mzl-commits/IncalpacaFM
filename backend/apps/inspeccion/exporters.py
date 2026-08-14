import io
import unicodedata
from pathlib import Path

from openpyxl import load_workbook
from openpyxl.styles import Font

from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT


TEMPLATE_PATH = Path(__file__).resolve().parent / "plantillas" / "Formato_Inspeccion.xlsx"

# Nombres de hoja deben coincidir EXACTO con Formato_Inspeccion.xlsx (ojo: "Electricas con cable " lleva espacio final)
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
        "num_criterios_nativos": 16,   # filas 15-30 en el template Manuales
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
        "num_criterios_nativos": 20,   # aprox filas 16-35 en Electricas Inalambricas
        "campos": CONFIG_INDIVIDUAL_COMUN["campos"],
        "resultado_row": 37,
        "accion_row": 41,
        "observaciones_generales": "A44",
    },
    HOJA_CON_CABLE: {
        "tipo": "individual",
        "criterio_data_start": 16,
        "num_criterios_nativos": 18,   # aprox filas 16-33 en Electricas con cable
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
    """Detecta la hoja del template Excel según el nombre de la plantilla.
    EPP, escaleras, iluminaria y otros EPP se mapean a Manuales (formato individual genérico).
    """
    nombre = _normalizar(plantilla_nombre)
    # Herramientas manuales o genéricas individuales
    if "manual" in nombre:
        return HOJA_MANUALES
    # Con cable
    if "cable" in nombre:
        return HOJA_CON_CABLE
    # Inalámbricas / batería
    if "inalambric" in nombre or "bateria" in nombre:
        return HOJA_INALAMBRICAS
    # EPP, escaleras, iluminaria, electrica sin cable → usar hoja Manuales como base
    if any(k in nombre for k in ("epp", "proteccion personal", "escalera", "iluminari", "electri", "linterna")):
        return HOJA_MANUALES
    return None

def _fecha(valor):
    return valor.strftime("%d/%m/%Y") if valor else ""

def _codigo_documento(inspeccion):
    """Genera el código de documento SST: FOR-SST-00XXX (basado en el ID de la inspección)."""
    return f"FOR-SST-{inspeccion.id:05d}"

def _fecha_emision_hoy():
    from datetime import date
    return date.today().strftime("%d/%m/%Y")

# ─── EXCEL ─────────────────────────────────────────────────────────────────

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
    # Para plantillas "prestadas" (EPP, escaleras...) que usan una hoja cuya plantilla
    # original tiene criterios distintos, primero borramos los textos existentes en el
    # rango de datos y después escribimos los de la inspección.
    col_valor = {"cumple": "C", "no_cumple": "D", "no_aplica": "E"}
    fila_base = config["criterio_data_start"] - 1  # criterio orden=1 → primera fila de datos

    respuestas = list(inspeccion.respuestas.select_related("criterio").order_by("criterio__orden"))
    num_criterios_plantilla_nativa = config.get("num_criterios_nativos", 0)
    # Si la plantilla tiene más criterios fijos que las respuestas de esta inspección,
    # limpiamos los excedentes del template para que no queden textos fantasma.
    max_fila_usada = fila_base + len(respuestas)
    if num_criterios_plantilla_nativa > len(respuestas):
        for orden_extra in range(len(respuestas) + 1, num_criterios_plantilla_nativa + 1):
            fila_extra = fila_base + orden_extra
            for col_limpiar in ["A", "B", "C", "D", "E", "F"]:
                ws[f"{col_limpiar}{fila_extra}"] = None

    for resp in respuestas:
        fila = fila_base + resp.criterio.orden
        # Siempre sobreescribir número y texto del criterio (importante para plantillas no nativas)
        ws[f"A{fila}"] = resp.criterio.orden
        ws[f"B{fila}"] = resp.criterio.texto
        # Limpiar las tres columnas de valor antes de marcar
        for c in ["C", "D", "E"]:
            ws[f"{c}{fila}"] = None
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

# ─── PDF ───────────────────────────────────────────────────────────────────

TITULOS_PDF = {
    HOJA_MANUALES: "FORMATO DE INSPECCIÓN GRUPAL DE HERRAMIENTAS MANUALES",
    HOJA_INALAMBRICAS: "FORMATO DE INSPECCIÓN DE HERRAMIENTAS ELÉCTRICAS INALÁMBRICAS",
    HOJA_CON_CABLE: "FORMATO DE INSPECCIÓN DE HERRAMIENTAS ELÉCTRICAS CON CABLE",
}

# Paleta profesional en escala de grises (reemplaza el azul saturado anterior).
GRIS_OSCURO = colors.HexColor("#2b2f36")     # títulos de tabla, líneas fuertes
GRIS_MEDIO = colors.HexColor("#6b7280")      # texto secundario
GRIS_CLARO = colors.HexColor("#f3f4f6")      # zebra striping
GRIS_BORDE = colors.HexColor("#c9ccd1")      # bordes de tabla
NEGRO_TEXTO = colors.HexColor("#1a1c20")

LOGO_PATH = Path(__file__).resolve().parent.parent.parent.parent / "frontend" / "public" / "logo-incalpaca.png"


def generar_pdf_inspeccion(inspeccion):
    hoja_nombre = _detectar_hoja(inspeccion.plantilla.nombre)
    titulo = TITULOS_PDF.get(hoja_nombre, "FORMATO DE INSPECCIÓN DE HERRAMIENTAS")

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer, pagesize=letter,
        topMargin=0.9 * cm, bottomMargin=0.9 * cm,
        leftMargin=1.5 * cm, rightMargin=1.5 * cm,
    )
    styles = getSampleStyleSheet()
    titulo_style = ParagraphStyle(
        "TituloInspeccion", parent=styles["Title"], fontSize=12.5, leading=15,
        textColor=NEGRO_TEXTO, alignment=TA_CENTER, fontName="Helvetica-Bold",
    )
    subtitulo_style = ParagraphStyle(
        "Subtitulo", parent=styles["Normal"], fontSize=8, textColor=GRIS_MEDIO,
        alignment=TA_CENTER,
    )
    elementos = []

    # ── Encabezado (sin bloques de color; logo + reglas finas en gris) ──
    codigo_doc = _codigo_documento(inspeccion)
    fecha_emision = _fecha_emision_hoy()
    meta_style = ParagraphStyle(
        "MetaDoc", parent=styles["Normal"], fontSize=7.5,
        textColor=GRIS_MEDIO, alignment=TA_RIGHT, leading=10,
    )
    empresa_style = ParagraphStyle(
        "Empresa", parent=styles["Normal"], fontSize=11.5,
        textColor=NEGRO_TEXTO, fontName="Helvetica-Bold", leading=13,
    )
    empresa_sub_style = ParagraphStyle(
        "EmpresaSub", parent=styles["Normal"], fontSize=7, textColor=GRIS_MEDIO, leading=9,
    )

    if LOGO_PATH.exists():
        logo_img = Image(str(LOGO_PATH), width=1.05 * cm, height=1.05 * cm)
    else:
        logo_img = Paragraph("", styles["Normal"])

    marca_cell = Table(
        [[logo_img, Paragraph("INCALPACA<br/><font size=6.5 color='#6b7280'>Facilities Management</font>", empresa_style)]],
        colWidths=[1.3 * cm, 6 * cm],
    )
    marca_cell.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (0, 0), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))

    meta_cell = Paragraph(
        f"Código: <b>{codigo_doc}</b><br/>Fecha de emisión: <b>{fecha_emision}</b>", meta_style
    )

    fila_superior = Table(
        [[marca_cell, meta_cell]],
        colWidths=[11 * cm, 7 * cm],
    )
    fila_superior.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (1, 0), (1, 0), "RIGHT"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    elementos.append(fila_superior)
    elementos.append(Spacer(1, 6))

    encabezado = Table(
        [[Paragraph(titulo, titulo_style)],
         [Paragraph("Área: Mantenimiento de Servicios Generales", subtitulo_style)]],
        colWidths=[18 * cm],
    )
    encabezado.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LINEBELOW", (0, -1), (-1, -1), 1, GRIS_OSCURO),
    ]))
    elementos.append(encabezado)
    elementos.append(Spacer(1, 7))

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
        ("TEXTCOLOR", (0, 0), (0, -1), GRIS_OSCURO),
        ("TEXTCOLOR", (2, 0), (2, -1), GRIS_OSCURO),
        ("TEXTCOLOR", (1, 0), (1, -1), NEGRO_TEXTO),
        ("TEXTCOLOR", (3, 0), (3, -1), NEGRO_TEXTO),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.4, GRIS_BORDE),
        ("BACKGROUND", (0, 0), (0, -1), GRIS_CLARO),
        ("BACKGROUND", (2, 0), (2, -1), GRIS_CLARO),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    elementos.append(tabla_datos)
    elementos.append(Spacer(1, 7))

    # ── Criterios ──
    criterio_texto_style = ParagraphStyle(
        "CriterioTexto", parent=styles["Normal"], fontSize=8, leading=9.6,
    )
    criterio_obs_style = ParagraphStyle(
        "CriterioObs", parent=styles["Normal"], fontSize=7.5, leading=9,
    )
    data = [["N°", "Criterio de inspección", "Cumple", "No cumple", "No aplica", "Obs."]]
    for resp in inspeccion.respuestas.select_related("criterio").order_by("criterio__orden"):
        data.append([
            resp.criterio.orden,
            Paragraph(resp.criterio.texto, criterio_texto_style),
            "X" if resp.valor == "cumple" else "",
            "X" if resp.valor == "no_cumple" else "",
            "X" if resp.valor == "no_aplica" else "",
            Paragraph(resp.observacion, criterio_obs_style) if resp.observacion else "",
        ])

    tabla = Table(data, colWidths=[1.2 * cm, 7.3 * cm, 1.9 * cm, 2.1 * cm, 1.9 * cm, 3.6 * cm], repeatRows=1)
    tabla.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), GRIS_OSCURO),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (0, 0), (0, -1), "CENTER"),
        ("ALIGN", (2, 0), (4, -1), "CENTER"),
        ("GRID", (0, 0), (-1, -1), 0.4, GRIS_BORDE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, GRIS_CLARO]),
    ]))
    elementos.append(tabla)
    elementos.append(Spacer(1, 6))

    # ── Resultado y acción ──
    # Nota: se usa notación de casilla en texto plano "[X]" / "[ ]" en vez de
    # los caracteres unicode ☑/☐, que no existen en Helvetica y se imprimían
    # como recuadros negros sólidos (glifo faltante).
    def _marca(activo):
        return "[X]" if activo else "[  ]"

    seccion_heading_style = ParagraphStyle(
        "SeccionHeading", parent=styles["Normal"], fontSize=8.5, fontName="Helvetica-Bold",
        textColor=GRIS_OSCURO, spaceBefore=0, spaceAfter=2,
    )
    seccion_body_style = ParagraphStyle(
        "SeccionBody", parent=styles["Normal"], fontSize=8, leading=12,
    )

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
        elementos.append(Paragraph("RESULTADO DE LA INSPECCIÓN", seccion_heading_style))
        elementos.append(Paragraph(resultado_txt, seccion_body_style))
        elementos.append(Spacer(1, 3))
        elementos.append(Paragraph("ACCIÓN TOMADA", seccion_heading_style))
        elementos.append(Paragraph(accion_txt, seccion_body_style))
    else:
        aptas_txt = (
            f"{_marca(not inspeccion.cantidad_no_apta)} Todas las herramientas inspeccionadas se encuentran aptas.<br/>"
            f"{_marca(bool(inspeccion.cantidad_no_apta))} Existen herramientas con observaciones."
        )
        elementos.append(Paragraph("RESULTADO FINAL", seccion_heading_style))
        elementos.append(Paragraph(aptas_txt, seccion_body_style))

    obs_heading_style = ParagraphStyle(
        "ObsHeading", parent=styles["Heading4"], fontSize=9, textColor=GRIS_OSCURO,
        spaceBefore=0, spaceAfter=2,
    )
    obs_style = ParagraphStyle("ObsBody", parent=styles["Normal"], fontSize=8, leading=11)
    elementos.append(Spacer(1, 4))
    elementos.append(Paragraph("OBSERVACIONES GENERALES", obs_heading_style))
    elementos.append(Paragraph(inspeccion.observaciones or "-", obs_style))
    elementos.append(Spacer(1, 3))

    # ── Firmas (más espacio en blanco para firmar a mano, letras reducidas) ──
    # Se agrupa en KeepTogether para que la fila de nombres/roles nunca quede
    # separada del resto del bloque en un salto de página.
    firma_label_style = ParagraphStyle(
        "FirmaLabel", parent=styles["Normal"], fontSize=8, fontName="Helvetica-Bold",
        textColor=NEGRO_TEXTO, alignment=TA_CENTER,
    )
    firma_dato_style = ParagraphStyle(
        "FirmaDato", parent=styles["Normal"], fontSize=7.5, textColor=GRIS_MEDIO,
        alignment=TA_CENTER, leading=11,
    )
    firmas = Table(
        [
            ["", "", ""],  # espacio en blanco para la firma manuscrita
            [Paragraph("Inspector", firma_label_style),
             Paragraph("Supervisor SST / Mantenimiento", firma_label_style),
             Paragraph("Responsable del Área", firma_label_style)],
            [Paragraph("Nombre: _____________________", firma_dato_style),
             Paragraph("Nombre: _____________________", firma_dato_style),
             Paragraph("Nombre: _____________________", firma_dato_style)],
            [Paragraph("Fecha: ____ / ____ / ______", firma_dato_style),
             Paragraph("Fecha: ____ / ____ / ______", firma_dato_style),
             Paragraph("Fecha: ____ / ____ / ______", firma_dato_style)],
        ],
        colWidths=[6 * cm, 6 * cm, 6 * cm],
        rowHeights=[0.9 * cm, None, None, None],
    )
    firmas.setStyle(TableStyle([
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
        ("LINEABOVE", (0, 1), (-1, 1), 0.8, GRIS_OSCURO),
        ("TOPPADDING", (0, 1), (-1, 1), 3),
        ("TOPPADDING", (0, 2), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, 0), 0),
        ("BOTTOMPADDING", (0, 1), (-1, -1), 2),
    ]))
    elementos.append(KeepTogether(firmas))

    doc.build(elementos)
    buffer.seek(0)
    return buffer