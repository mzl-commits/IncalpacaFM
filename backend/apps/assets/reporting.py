import os
from io import BytesIO

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    HRFlowable,
    Image,
    KeepTogether,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

LOGO_PATH = os.path.join(os.path.dirname(__file__), "..", "workorders", "logo_brand.png")


def _get_logo_image():
    if os.path.exists(LOGO_PATH):
        try:
            return Image(LOGO_PATH, width=1.6 * cm, height=1.6 * cm, kind="proportional")
        except Exception:
            pass
    return None


def build_asset_pdf(asset):
    output = BytesIO()

    # 1. Configuración de página A4 con márgenes APA (2.0 cm laterales y verticales)
    doc = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=2.0 * cm,
        leftMargin=2.0 * cm,
        topMargin=2.2 * cm,
        bottomMargin=2.2 * cm,
    )

    # 2. Estilos Tipográficos Formales Institucionales (Times-Roman / Times-Bold)
    styles = getSampleStyleSheet()

    doc_header_title = ParagraphStyle(
        "DocHeaderTitleAsset",
        parent=styles["Normal"],
        fontName="Times-Bold",
        fontSize=13,
        leading=17,
        textColor=colors.HexColor("#000000"),
    )

    doc_header_right = ParagraphStyle(
        "DocHeaderRightAsset",
        parent=styles["Normal"],
        fontName="Times-Roman",
        fontSize=9.5,
        leading=14,
        alignment=2,
        textColor=colors.HexColor("#111111"),
    )

    section_heading = ParagraphStyle(
        "SectionHeadingAsset",
        parent=styles["Heading2"],
        fontName="Times-Bold",
        fontSize=11,
        leading=16,
        textColor=colors.HexColor("#000000"),
        spaceBefore=16,
        spaceAfter=8,
    )

    cell_bold = ParagraphStyle(
        "CellBoldAsset",
        parent=styles["Normal"],
        fontName="Times-Bold",
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor("#000000"),
    )

    cell_normal = ParagraphStyle(
        "CellNormalAsset",
        parent=styles["Normal"],
        fontName="Times-Roman",
        fontSize=9.5,
        leading=14,
        textColor=colors.HexColor("#111111"),
    )

    story = []

    # ---------------------------------------------------------
    # MEMBRETE OFICIAL CON LOGO Y ESPACIADO FORMAL
    # ---------------------------------------------------------
    logo_img = _get_logo_image()

    brand_text = Paragraph(
        "<b>INCALPACA FM S.A.</b><br/>"
        "<font color='#555555' size='8.5'>SISTEMA DE GESTIÓN TÉCNICA DE ACTIVOS E INFRAESTRUCTURA</font><br/>"
        "<b>FICHA TÉCNICA INSTITUCIONAL DE BIEN / ACTIVO</b>",
        doc_header_title
    )

    now_str = timezone.localtime().strftime('%d/%m/%Y %H:%M')
    display_code = asset.fm_code or asset.code
    technical_id = asset.code

    meta_text = Paragraph(
        f"<b>Código FM:</b> {display_code}<br/>"
        f"<b>ID Técnico:</b> {technical_id}<br/>"
        f"<b>Fecha Emisión:</b> {now_str}",
        doc_header_right
    )

    if logo_img:
        header_table = Table([[logo_img, brand_text, meta_text]], colWidths=[2.2 * cm, 9.3 * cm, 5.5 * cm])
    else:
        header_table = Table([[brand_text, meta_text]], colWidths=[11.5 * cm, 5.5 * cm])

    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 2),
    ]))

    story.append(header_table)
    story.append(Spacer(1, 0.4 * cm))
    story.append(HRFlowable(width="100%", thickness=1.0, color=colors.HexColor("#000000"), spaceBefore=4, spaceAfter=12))

    # ---------------------------------------------------------
    # SECCIÓN 1: DATOS DE IDENTIFICACIÓN DEL BIEN
    # ---------------------------------------------------------
    story.append(Paragraph("1. DATOS DE IDENTIFICACIÓN Y ESPECIFICACIONES DEL ACTIVO", section_heading))

    entry_type_map = {
        "purchase": "Compra",
        "own_creation": "Creación propia",
        "donation": "Regalo o donación",
        "rental": "Alquiler",
    }
    entry_label = entry_type_map.get(asset.entry_type, asset.entry_type or "Compra")
    
    brand_name = getattr(asset, "brand", None) or asset.entry_payload.get("brand") or "No especificada"
    model_name = getattr(asset, "model", None) or asset.entry_payload.get("model") or "No especificado"
    serial_num = getattr(asset, "serial_number", None) or asset.entry_payload.get("serialNumber") or "S/N"
    cond_name = getattr(asset, "condition", None) or asset.entry_payload.get("condition") or "Bueno"
    crit_name = getattr(asset, "criticality", None) or asset.entry_payload.get("criticality") or "Media"

    taxonomy = getattr(asset, "taxonomy", None)
    cat_name = f"{taxonomy.prefix} · {taxonomy.name or taxonomy.subcategory}" if taxonomy else (asset.entry_payload.get("classificationName") or "No clasificado")

    sec1_data = [
        [
            Paragraph("<b>Nombre del Bien:</b>", cell_bold),
            Paragraph(asset.name, cell_normal),
            Paragraph("<b>Código FM:</b>", cell_bold),
            Paragraph(display_code, cell_normal),
        ],
        [
            Paragraph("<b>Marca / Modelo:</b>", cell_bold),
            Paragraph(f"{brand_name} / {model_name}", cell_normal),
            Paragraph("<b>Número de Serie:</b>", cell_bold),
            Paragraph(serial_num, cell_normal),
        ],
        [
            Paragraph("<b>Condición Operativa:</b>", cell_bold),
            Paragraph(str(cond_name).capitalize(), cell_normal),
            Paragraph("<b>Criticidad:</b>", cell_bold),
            Paragraph(str(crit_name).capitalize(), cell_normal),
        ],
        [
            Paragraph("<b>Clasificación FM:</b>", cell_bold),
            Paragraph(cat_name, cell_normal),
            Paragraph("<b>Modalidad Ingreso:</b>", cell_bold),
            Paragraph(entry_label, cell_normal),
        ],
    ]

    t_sec1 = Table(sec1_data, colWidths=[3.6 * cm, 4.9 * cm, 3.6 * cm, 4.9 * cm])
    t_sec1.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F4F4F4")),
        ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F4F4F4")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 7),
    ]))
    story.append(t_sec1)
    story.append(Spacer(1, 0.65 * cm))

    # ---------------------------------------------------------
    # SECCIÓN 2: SITUACIÓN Y UBICACIÓN FÍSICA ACTUAL
    # ---------------------------------------------------------
    story.append(Paragraph("2. SITUACIÓN Y UBICACIÓN FÍSICA ACTUAL", section_heading))

    location = getattr(asset, "location", None)
    building = location.building if location else (asset.entry_payload.get("building") or "Edificio Principal")
    area = location.area if location else (asset.entry_payload.get("area") or "Área Operativa")
    room = location.room if location else (asset.entry_payload.get("room") or "Instalación FM")
    specific_loc = (location.specific_location if location else asset.entry_payload.get("specificLocation")) or "Sin detalle adicional"

    resp_name = asset.entry_payload.get("responsibleName") or asset.entry_payload.get("responsible") or "Área de Mantenimiento / Planta"
    assign_status = getattr(asset, "assignment_status", "Asignado")

    sec2_data = [
        [
            Paragraph("<b>Edificio / Sede:</b>", cell_bold),
            Paragraph(building, cell_normal),
            Paragraph("<b>Área / Depto.:</b>", cell_bold),
            Paragraph(area, cell_normal),
        ],
        [
            Paragraph("<b>Ambiente / Sala:</b>", cell_bold),
            Paragraph(room, cell_normal),
            Paragraph("<b>Ubicación Específica:</b>", cell_bold),
            Paragraph(specific_loc, cell_normal),
        ],
        [
            Paragraph("<b>Responsable Actual:</b>", cell_bold),
            Paragraph(resp_name, cell_normal),
            Paragraph("<b>Estado Asignación:</b>", cell_bold),
            Paragraph(assign_status, cell_normal),
        ],
    ]

    t_sec2 = Table(sec2_data, colWidths=[3.6 * cm, 4.9 * cm, 3.6 * cm, 4.9 * cm])
    t_sec2.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F4F4F4")),
        ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F4F4F4")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 7),
    ]))
    story.append(t_sec2)
    story.append(Spacer(1, 0.65 * cm))

    # ---------------------------------------------------------
    # SECCIÓN 3: DESCRIPCIÓN Y OBSERVACIONES TÉCNICAS
    # ---------------------------------------------------------
    story.append(Paragraph("3. DESCRIPCIÓN TÉCNICA DEL ACTIVO", section_heading))
    desc_text = asset.description or "Sin descripción técnica adicional registrada."

    t_desc = Table([[Paragraph(f"<b>Detalle del Bien:</b><br/>{desc_text}", cell_normal)]], colWidths=[17.0 * cm])
    t_desc.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#FFFFFF")),
        ("BOX", (0, 0), (0, 0), 0.5, colors.HexColor("#A0A0A0")),
        ("PADDING", (0, 0), (0, 0), 10),
    ]))
    story.append(t_desc)
    story.append(Spacer(1, 0.65 * cm))

    # ---------------------------------------------------------
    # SECCIÓN 4: HISTORIAL DE MANTENIMIENTO Y ATENCIONES
    # ---------------------------------------------------------
    story.append(Paragraph("4. HISTORIAL DE MANTENIMIENTO Y ÓRDENES VINCULADAS", section_heading))

    incidents = list(asset.incidents.all()[:6])
    maint_rows = [
        [
            Paragraph("<b>Código OT</b>", ParagraphStyle("M1", parent=cell_bold, textColor=colors.white)),
            Paragraph("<b>Fecha</b>", ParagraphStyle("M2", parent=cell_bold, textColor=colors.white)),
            Paragraph("<b>Tipo Atención</b>", ParagraphStyle("M3", parent=cell_bold, textColor=colors.white)),
            Paragraph("<b>Técnico Responsable</b>", ParagraphStyle("M4", parent=cell_bold, textColor=colors.white)),
            Paragraph("<b>Estado</b>", ParagraphStyle("M5", parent=cell_bold, textColor=colors.white)),
        ]
    ]

    if incidents:
        for inc in incidents:
            wo = getattr(inc, "work_order", None)
            wo_code = wo.code if wo else inc.code
            date_str = inc.created_at.strftime("%d/%m/%Y")
            type_str = wo.get_order_type_display() if wo else inc.get_request_type_display()
            tech_str = (wo.technician.get_full_name() or wo.technician.username) if wo and wo.technician else "Asignado FM"
            status_str = wo.get_status_display() if wo else inc.get_status_display()

            maint_rows.append([
                Paragraph(wo_code, cell_normal),
                Paragraph(date_str, cell_normal),
                Paragraph(type_str, cell_normal),
                Paragraph(tech_str, cell_normal),
                Paragraph(status_str, cell_normal),
            ])
    else:
        maint_rows.append([
            Paragraph("-", cell_normal),
            Paragraph(timezone.now().strftime("%d/%m/%Y"), cell_normal),
            Paragraph("Preventivo / Inicial", cell_normal),
            Paragraph("Equipo FM", cell_normal),
            Paragraph("Sin atenciones registradas", cell_normal),
        ])

    t_maint = Table(maint_rows, colWidths=[3.2 * cm, 2.5 * cm, 3.8 * cm, 4.5 * cm, 3.0 * cm])
    t_maint.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#000000")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 7),
    ]))
    story.append(t_maint)
    story.append(Spacer(1, 1.2 * cm))

    # ---------------------------------------------------------
    # SECCIÓN 5: VALIDACIÓN Y CONTROL PATRIMONIAL
    # ---------------------------------------------------------
    sig_block = []
    sig_data = [
        [
            Paragraph("<br/><br/><br/><br/>________________________________________<br/><b>Responsable del Activo / Custodio</b><br/>" + resp_name, ParagraphStyle("S1Asset", parent=cell_normal, alignment=1)),
            Paragraph("<br/><br/><br/><br/>________________________________________<br/><b>V°B° Control Patrimonial & FM</b><br/>Administración de Activos", ParagraphStyle("S2Asset", parent=cell_normal, alignment=1)),
        ]
    ]
    t_sig = Table(sig_data, colWidths=[8.5 * cm, 8.5 * cm])
    t_sig.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    sig_block.append(t_sig)
    story.append(KeepTogether(sig_block))

    # ---------------------------------------------------------
    # 3. Pie de página institucional formal
    # ---------------------------------------------------------
    def add_footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("Times-Roman", 8.5)
        canvas.setFillColor(colors.HexColor("#555555"))
        canvas.drawString(2.0 * cm, 1.1 * cm, "INCALPACA FM S.A. — Documento Técnico Oficial de Control Patrimonial")
        canvas.drawRightString(21.0 * cm - 2.0 * cm, 1.1 * cm, f"Página {doc.page}")
        canvas.setStrokeColor(colors.HexColor("#000000"))
        canvas.setLineWidth(0.5)
        canvas.line(2.0 * cm, 1.4 * cm, 21.0 * cm - 2.0 * cm, 1.4 * cm)
        canvas.restoreState()

    doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)
    output.seek(0)
    return output
