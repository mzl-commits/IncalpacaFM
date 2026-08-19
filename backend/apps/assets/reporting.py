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

    # 1. Configuración A4 institucional (12mm y 15mm)
    doc = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=1.5 * cm,
        leftMargin=1.5 * cm,
        topMargin=1.2 * cm,
        bottomMargin=1.2 * cm,
    )

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
        spaceBefore=20,
        spaceAfter=10,
        keepWithNext=True,
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

    cell_center_bold = ParagraphStyle(
        "CellCenterBoldAsset",
        parent=styles["Normal"],
        fontName="Times-Bold",
        fontSize=9.5,
        leading=14,
        alignment=1,
        textColor=colors.HexColor("#000000"),
    )

    banner_style = ParagraphStyle(
        "BannerStyleAsset",
        parent=styles["Normal"],
        fontName="Times-Bold",
        fontSize=10,
        leading=14,
        alignment=1,
        textColor=colors.HexColor("#FFFFFF"),
    )

    story = []

    # ---------------------------------------------------------
    # MEMBRETE OFICIAL CON LOGO Y ESPACIADO FORMAL
    # ---------------------------------------------------------
    logo_img = _get_logo_image()

    brand_text = Paragraph(
        "<b>INCALPACA FM S.A.</b><br/>"
        "<font color='#555555' size='8.5'>SISTEMA DE GESTIÓN TÉCNICA DE ACTIVOS E INFRAESTRUCTURA</font><br/>"
        "<b>INFORME TÉCNICO MATRIZ ESTRUCTURAL DE 9 NIVELES</b>",
        doc_header_title
    )

    now_str = timezone.localtime().strftime('%d/%m/%Y<br/>%H:%M')
    display_code = asset.fm_code or asset.code
    technical_id = asset.code
    payload = asset.entry_payload or {}

    meta_text = Paragraph(
        f"<b>Fecha de Emisión:</b> {now_str}<br/>"
        f"<b>Código Matriz:</b> {asset.full_assignment_code}<br/>"
        f"<b>ID Técnico:</b> {technical_id}",
        doc_header_right
    )

    if logo_img:
        header_table = Table([[logo_img, brand_text, meta_text]], colWidths=[2.0 * cm, 8.9 * cm, 5.0 * cm])
    else:
        header_table = Table([[brand_text, meta_text]], colWidths=[10.9 * cm, 5.0 * cm])

    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 2),
    ]))

    story.append(header_table)
    story.append(Spacer(1, 0.3 * cm))
    story.append(HRFlowable(width="100%", thickness=1.0, color=colors.HexColor("#000000"), spaceBefore=4, spaceAfter=10))

    # MATRIZ 9 NIVELES
    n1_code = str(payload.get("n1_code") or payload.get("site_code") or "INC1")
    n1_name = str(payload.get("site") or "INCALPACA (Calle Cóndor 100, Sachaca, Arequipa, Perú)")

    n2_code = str(payload.get("n2_code") or payload.get("macro_area_code") or "AD")
    n2_name = str(payload.get("macro_area") or "SECTORES ADMINISTRATIVOS")

    location = getattr(asset, "location", None)
    n3_code = str(payload.get("n3_code") or payload.get("building_code") or payload.get("area_code") or "MKT")
    n3_name = (location.area if location else None) or str(payload.get("area") or payload.get("building") or "COWORKING MARKETING")

    n4_code = str(payload.get("n4_code") or payload.get("room_code") or "MT04")
    n4_name = (location.room if location else None) or (location.specific_location if location else None) or str(payload.get("room") or "MÓDULO DE TRABAJO 4")

    taxonomy = getattr(asset, "taxonomy", None)
    n5_code = str(payload.get("n5_code") or payload.get("family_code") or (taxonomy.category if taxonomy else None) or "MOB")
    n5_name = (taxonomy.category if taxonomy else None) or str(payload.get("family") or "MOBILIARIO")

    n6_code = str(payload.get("n6_code") or payload.get("type_code") or (taxonomy.prefix if taxonomy else None) or "SE")
    n6_name = (taxonomy.subcategory if taxonomy else None) or (taxonomy.name if taxonomy else None) or asset.name or "SILLA ERGONÓMICA TIPO 1"

    n7_code = str(payload.get("n7_code") or payload.get("part_code") or "BA")
    n7_name = str(payload.get("part") or payload.get("partName") or "BASE GIRATORIA")

    n8_code = str(payload.get("n8_code") or payload.get("piece_code") or "GA")
    n8_name = str(payload.get("piece") or payload.get("pieceName") or "GARRUCHA (RUEDA DE NYLON)")

    raw_sku = str(payload.get("n9_code") or payload.get("sku") or payload.get("skuCode") or display_code or "SKU 10")
    n9_code = raw_sku if raw_sku.startswith("SKU") else f"SKU {raw_sku}"

    full_matrix_code = f"{n1_code} - {n2_code} - {n3_code} - {n4_code} - {n5_code} - {n6_code} - {n7_code} - {n8_code} - {n9_code}"

    active_assignment = asset.assignments.filter(status='ACTIVA').select_related('responsible').first() if hasattr(asset, 'assignments') else None
    resp_obj = active_assignment.responsible if active_assignment else None

    resp_name = (resp_obj.display_name if resp_obj else None) or str(payload.get("responsibleName") or payload.get("responsible") or "ROSA MEDINA GUTIÉRREZ")
    worker_code = (getattr(resp_obj, 'external_reference', None) if resp_obj else None) or str(payload.get("workerCode") or "TRAB-4082")
    cost_center = (getattr(resp_obj, 'area_name', None) if resp_obj else None) or str(payload.get("costCenter") or "CC-1040 (ADMINISTRACIÓN & MKT)")

    brand_name = getattr(asset, "brand", None) or payload.get("brand") or "Forma"
    model_name = getattr(asset, "model", None) or payload.get("model") or "ErgoMax 2026"
    serial_num = getattr(asset, "serial_number", None) or payload.get("serialNumber") or "SN-MOB-2026-0040"
    cond_name = getattr(asset, "condition", None) or payload.get("condition") or "Bueno"
    crit_name = getattr(asset, "criticality", None) or payload.get("criticality") or "Media"

    # ---------------------------------------------------------
    # SECCIÓN 1: MATRIZ DE 9 NIVELES CON TODOS SUS CÓDIGOS
    # ---------------------------------------------------------
    story.append(Paragraph("1. MATRIZ ESTRUCTURAL DE 9 NIVELES (CON TODOS SUS CÓDIGOS)", section_heading))

    th_style = ParagraphStyle("THMat", parent=cell_bold, textColor=colors.white)
    th_center_style = ParagraphStyle("THMatCenter", parent=cell_bold, textColor=colors.white, alignment=1)

    matrix_rows = [
        [
            Paragraph("<b>Nivel</b>", th_style),
            Paragraph("<b>Entidad / Descripción de Matriz</b>", th_style),
            Paragraph("<b>Código Fijo</b>", th_center_style),
            Paragraph("<b>Valor / Registro Oficial</b>", th_style),
        ],
        [Paragraph("<b>NIVEL 1</b>", cell_bold), Paragraph("Sede / Complejo Principal", cell_normal), Paragraph(n1_code, cell_center_bold), Paragraph(n1_name, cell_normal)],
        [Paragraph("<b>NIVEL 2</b>", cell_bold), Paragraph("Área Macro", cell_normal), Paragraph(n2_code, cell_center_bold), Paragraph(n2_name, cell_normal)],
        [Paragraph("<b>NIVEL 3</b>", cell_bold), Paragraph("Zona / Edificio / Sector", cell_normal), Paragraph(n3_code, cell_center_bold), Paragraph(n3_name, cell_normal)],
        [Paragraph("<b>NIVEL 4</b>", cell_bold), Paragraph("Módulo / Ambiente / Subespacio", cell_normal), Paragraph(n4_code, cell_center_bold), Paragraph(n4_name, cell_normal)],
        [Paragraph("<b>NIVEL 5</b>", cell_bold), Paragraph("Familia Taxonómica", cell_normal), Paragraph(n5_code, cell_center_bold), Paragraph(n5_name, cell_normal)],
        [Paragraph("<b>NIVEL 6</b>", cell_bold), Paragraph("Tipo de Bien / Taxonomía", cell_normal), Paragraph(n6_code, cell_center_bold), Paragraph(n6_name, cell_normal)],
        [Paragraph("<b>NIVEL 7</b>", cell_bold), Paragraph("Parte / Componente", cell_normal), Paragraph(n7_code, cell_center_bold), Paragraph(n7_name, cell_normal)],
        [Paragraph("<b>NIVEL 8</b>", cell_bold), Paragraph("Pieza / Elemento", cell_normal), Paragraph(n8_code, cell_center_bold), Paragraph(n8_name, cell_normal)],
        [Paragraph("<b>NIVEL 9</b>", cell_bold), Paragraph("SKU / Código de Inventario", cell_normal), Paragraph(n9_code, cell_center_bold), Paragraph("Identificador Único Correlativo", cell_normal)],
    ]

    t_sec1 = Table(matrix_rows, colWidths=[2.2 * cm, 5.2 * cm, 2.5 * cm, 6.0 * cm])
    t_sec1.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#000000")),
        ("BACKGROUND", (0, 1), (0, -1), colors.HexColor("#F4F4F4")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 4),
    ]))
    story.append(t_sec1)
    story.append(Spacer(1, 0.2 * cm))

    # Banner del Código Completo N1-N9
    banner_text = f"FÓRMULA CÓDIGO MATRIZ INTEGRADO (N1 + N2 + N3 + N4 + N5 + N6 + N7 + N8 + N9):<br/>\"{full_matrix_code}\""
    t_banner = Table([[Paragraph(banner_text, banner_style)]], colWidths=[15.9 * cm])
    t_banner.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#000000")),
        ("PADDING", (0, 0), (0, 0), 6),
    ]))
    story.append(t_banner)
    story.append(Spacer(1, 0.4 * cm))

    # ---------------------------------------------------------
    # SECCIÓN 2: CUSTODIA Y RESPONSABLE
    # ---------------------------------------------------------
    story.append(Paragraph("2. CUSTODIA Y ASIGNACIÓN DE PERSONAL", section_heading))

    assign_status = getattr(asset, "assignment_status", "Vigente")

    sec2_data = [
        [
            Paragraph("<b>1. CÓDIGO DE TRABAJADOR:</b>", cell_bold),
            Paragraph(worker_code, cell_normal),
            Paragraph("<b>2. RESPONSABLE ASIGNADO:</b>", cell_bold),
            Paragraph(resp_name, cell_normal),
        ],
        [
            Paragraph("<b>3. CENTRO DE COSTO:</b>", cell_bold),
            Paragraph(cost_center, cell_normal),
            Paragraph("<b>ESTADO ASIGNACIÓN:</b>", cell_bold),
            Paragraph(assign_status, cell_normal),
        ],
    ]

    t_sec2 = Table(sec2_data, colWidths=[4.2 * cm, 3.8 * cm, 4.2 * cm, 3.7 * cm])
    t_sec2.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F4F4F4")),
        ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F4F4F4")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t_sec2)
    story.append(Spacer(1, 0.4 * cm))

    # ---------------------------------------------------------
    # SECCIÓN 3: ESPECIFICACIONES TÉCNICAS Y DESCRIPCIÓN
    # ---------------------------------------------------------
    story.append(Paragraph("3. ESPECIFICACIONES TÉCNICAS DEL ACTIVO", section_heading))
    desc_text = asset.description or "Sin descripción técnica adicional registrada."

    sec3_data = [
        [
            Paragraph("<b>Marca / Modelo:</b>", cell_bold),
            Paragraph(f"{brand_name} / {model_name}", cell_normal),
            Paragraph("<b>Número de Serie:</b>", cell_bold),
            Paragraph(serial_num, cell_normal),
        ],
        [
            Paragraph("<b>Criticidad:</b>", cell_bold),
            Paragraph(str(crit_name).capitalize(), cell_normal),
            Paragraph("<b>Detalle Técnico:</b>", cell_bold),
            Paragraph(desc_text, cell_normal),
        ],
    ]

    t_sec3 = Table(sec3_data, colWidths=[3.6 * cm, 4.3 * cm, 3.6 * cm, 4.4 * cm])
    t_sec3.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#FFFFFF")),
        ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#FFFFFF")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t_sec3)
    story.append(Spacer(1, 0.4 * cm))

    # ---------------------------------------------------------
    # SECCIÓN 4: HISTORIAL DE MANTENIMIENTO Y REPARACIONES
    # ---------------------------------------------------------
    story.append(Paragraph("4. HISTORIAL DE MANTENIMIENTO Y ATENCIONES REGISTRADAS", section_heading))

    incidents = list(asset.incidents.all()[:6]) if hasattr(asset, 'incidents') else []
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
            type_str_wo = wo.get_order_type_display() if wo else inc.get_request_type_display()
            tech_str = (wo.technician.get_full_name() or wo.technician.username) if wo and wo.technician else "Asignado FM"
            status_str = wo.get_status_display() if wo else inc.get_status_display()

            maint_rows.append([
                Paragraph(wo_code, cell_normal),
                Paragraph(date_str, cell_normal),
                Paragraph(type_str_wo, cell_normal),
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

    t_maint = Table(maint_rows, colWidths=[2.8 * cm, 2.4 * cm, 3.8 * cm, 4.2 * cm, 2.7 * cm])
    t_maint.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#000000")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t_maint)
    story.append(Spacer(1, 0.4 * cm))

    # ---------------------------------------------------------
    # SECCIÓN 5: EVIDENCIAS
    # ---------------------------------------------------------
    story.append(Paragraph("5. EVIDENCIAS Y REGISTRO FOTOGRÁFICO DE CAMPO", section_heading))

    empty_photo_style = ParagraphStyle(
        "EmptyPhotoAsset",
        parent=cell_normal,
        fontName="Times-Italic",
        textColor=colors.HexColor("#808080"),
        alignment=1,
    )
    photo_title_style = ParagraphStyle(
        "PhotoTitleAsset",
        parent=cell_bold,
        alignment=1,
    )

    photo_data = [
        [
            Paragraph("ESTADO INICIAL (ANTES)", photo_title_style),
            Paragraph("ESTADO FINAL (DESPUÉS)", photo_title_style)
        ],
        [
            Paragraph("Sin registro fotográfico adjunto", empty_photo_style),
            Paragraph("Sin registro fotográfico adjunto", empty_photo_style)
        ]
    ]
    t_photo = Table(photo_data, colWidths=[7.95 * cm, 7.95 * cm], rowHeights=[None, 3.2 * cm])
    t_photo.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ("BOX", (0, 1), (0, 1), 0.5, colors.HexColor("#A0A0A0")),
        ("BOX", (1, 1), (1, 1), 0.5, colors.HexColor("#A0A0A0")),
        ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#F4F4F4")),
    ]))
    story.append(t_photo)

    # ---------------------------------------------------------
    # SECCIÓN 6: VALIDACIÓN Y CONTROL PATRIMONIAL
    # ---------------------------------------------------------
    sig_block = []
    sig_data = [
        [
            Paragraph("<br/><br/>___________________________________<br/><b>Técnico Responsable</b><br/>" + resp_name, ParagraphStyle("S1AssetRep", parent=cell_normal, alignment=1)),
            Paragraph("<br/><br/>___________________________________<br/><b>V°B° Supervisor / Administración</b><br/>Control Patrimonial & FM", ParagraphStyle("S2AssetRep", parent=cell_normal, alignment=1)),
        ]
    ]
    t_sig = Table(sig_data, colWidths=[8.5 * cm, 8.5 * cm])
    t_sig.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    sig_block.append(Spacer(1, 15))
    sig_block.append(t_sig)
    story.append(KeepTogether(sig_block))

    doc.build(story)
    output.seek(0)
    return output
