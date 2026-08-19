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

    # 1. Configuración de página A4 con márgenes institucionales (12mm y 15mm)
    doc = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=1.5 * cm,
        leftMargin=1.5 * cm,
        topMargin=1.2 * cm,
        bottomMargin=1.2 * cm,
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
        spaceBefore=24,
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

    chain_style = ParagraphStyle(
        "ChainStyleAsset",
        parent=styles["Normal"],
        fontName="Times-Bold",
        fontSize=9,
        leading=13,
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
        "<b>FICHA TÉCNICA INSTITUCIONAL DE BIEN / MOBILIARIO</b>",
        doc_header_title
    )

    now_str = timezone.localtime().strftime('%d/%m/%Y<br/>%H:%M')
    display_code = asset.fm_code or asset.code
    technical_id = asset.code
    payload = asset.entry_payload or {}

    meta_text = Paragraph(
        f"<b>Fecha de Emisión:</b> {now_str}<br/>"
        f"<b>Código FM:</b> {display_code}<br/>"
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
    story.append(Spacer(1, 0.4 * cm))
    story.append(HRFlowable(width="100%", thickness=1.0, color=colors.HexColor("#000000"), spaceBefore=4, spaceAfter=12))

    # Extracción de campos jerárquicos y de custodia de la imagen de referencia
    site_str = str(payload.get("site") or "INCALPACA – SEDE PRINCIPAL")
    location = getattr(asset, "location", None)
    building_str = (location.building if location else None) or str(payload.get("building") or payload.get("zone") or "SECTOR ADMINISTRATIVO – CASONA")
    area_str = (location.area if location else None) or str(payload.get("area") or "COWORKING MARKETING")
    room_str = (location.room if location else None) or (location.specific_location if location else None) or str(payload.get("room") or "MÓDULO DE TRABAJO 4")

    taxonomy = getattr(asset, "taxonomy", None)
    family_str = (taxonomy.category if taxonomy else None) or str(payload.get("family") or payload.get("assetType") or "MOBILIARIO")
    type_str = (taxonomy.subcategory if taxonomy else None) or (taxonomy.name if taxonomy else None) or asset.name or "SILLA ERGONÓMICA TIPO 1"
    part_str = str(payload.get("part") or payload.get("partName") or "BASE GIRATORIA")
    piece_str = str(payload.get("piece") or payload.get("pieceName") or "GARRUCHA")
    sku_str = str(payload.get("sku") or payload.get("skuCode") or display_code or "SKU 40")

    active_assignment = asset.assignments.filter(status='ACTIVA').select_related('responsible').first() if hasattr(asset, 'assignments') else None
    resp_obj = active_assignment.responsible if active_assignment else None

    resp_name = (resp_obj.display_name if resp_obj else None) or str(payload.get("responsibleName") or payload.get("responsible") or "ROSA MEDINA GUTIÉRREZ")
    worker_code = (getattr(resp_obj, 'external_reference', None) if resp_obj else None) or str(payload.get("workerCode") or "TRAB-4082")
    cost_center = (getattr(resp_obj, 'area_name', None) if resp_obj else None) or str(payload.get("costCenter") or "CC-1040 (ADMINISTRACIÓN & MKT)")

    brand_name = getattr(asset, "brand", None) or payload.get("brand") or "No especificada"
    model_name = getattr(asset, "model", None) or payload.get("model") or "No especificado"
    serial_num = getattr(asset, "serial_number", None) or payload.get("serialNumber") or "S/N"
    cond_name = getattr(asset, "condition", None) or payload.get("condition") or "Bueno"
    crit_name = getattr(asset, "criticality", None) or payload.get("criticality") or "Media"

    # ---------------------------------------------------------
    # SECCIÓN 1: DATOS DE IDENTIFICACIÓN Y ESPECIFICACIONES DE CLASIFICACIÓN
    # ---------------------------------------------------------
    story.append(Paragraph("1. DATOS DE IDENTIFICACIÓN Y CLASIFICACIÓN DEL BIEN", section_heading))

    sec1_data = [
        [
            Paragraph("<b>Nombre del Bien:</b>", cell_bold),
            Paragraph(asset.name, cell_normal),
            Paragraph("<b>Código FM / SKU:</b>", cell_bold),
            Paragraph(f"{display_code} ({sku_str})", cell_normal),
        ],
        [
            Paragraph("<b>Familia Taxonómica:</b>", cell_bold),
            Paragraph(family_str, cell_normal),
            Paragraph("<b>Tipo de Bien:</b>", cell_bold),
            Paragraph(type_str, cell_normal),
        ],
        [
            Paragraph("<b>Parte / Componente:</b>", cell_bold),
            Paragraph(part_str, cell_normal),
            Paragraph("<b>Pieza / Elemento:</b>", cell_bold),
            Paragraph(piece_str, cell_normal),
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
    ]

    t_sec1 = Table(sec1_data, colWidths=[3.2 * cm, 4.7 * cm, 3.3 * cm, 4.7 * cm])
    t_sec1.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F4F4F4")),
        ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F4F4F4")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t_sec1)
    story.append(Spacer(1, 0.4 * cm))

    # ---------------------------------------------------------
    # SECCIÓN 2: UBICACIÓN ESPACIAL Y ASIGNACIÓN DE CUSTODIA
    # ---------------------------------------------------------
    story.append(Paragraph("2. UBICACIÓN ESPACIAL Y ASIGNACIÓN DE CUSTODIA", section_heading))

    assign_status = getattr(asset, "assignment_status", "Vigente")

    sec2_data = [
        [
            Paragraph("<b>Sede Principal:</b>", cell_bold),
            Paragraph(site_str, cell_normal),
            Paragraph("<b>Sector / Edificio:</b>", cell_bold),
            Paragraph(building_str, cell_normal),
        ],
        [
            Paragraph("<b>Área / Zona:</b>", cell_bold),
            Paragraph(area_str, cell_normal),
            Paragraph("<b>Ambiente / Módulo:</b>", cell_bold),
            Paragraph(room_str, cell_normal),
        ],
        [
            Paragraph("<b>Responsable Asignado:</b>", cell_bold),
            Paragraph(resp_name, cell_normal),
            Paragraph("<b>Código Trabajador:</b>", cell_bold),
            Paragraph(worker_code, cell_normal),
        ],
        [
            Paragraph("<b>Centro de Costo:</b>", cell_bold),
            Paragraph(cost_center, cell_normal),
            Paragraph("<b>Estado Asignación:</b>", cell_bold),
            Paragraph(assign_status, cell_normal),
        ],
    ]

    t_sec2 = Table(sec2_data, colWidths=[3.2 * cm, 4.7 * cm, 3.3 * cm, 4.7 * cm])
    t_sec2.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F4F4F4")),
        ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F4F4F4")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t_sec2)
    story.append(Spacer(1, 0.3 * cm))

    # Box de Cadena Estructural Integrada de Trazabilidad
    structural_chain_text = f"<b>CADENA ESTRUCTURAL Y TRAZABILIDAD INTEGRADA:</b><br/>{site_str} › {building_str} › {area_str} › {room_str} › {family_str} › {type_str} › {part_str} › {piece_str} › {sku_str}"
    t_chain = Table([[Paragraph(structural_chain_text, chain_style)]], colWidths=[15.9 * cm])
    t_chain.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#F8F9FA")),
        ("BOX", (0, 0), (0, 0), 0.5, colors.HexColor("#A0A0A0")),
        ("LINELEFT", (0, 0), (0, 0), 2.5, colors.HexColor("#000000")),
        ("PADDING", (0, 0), (0, 0), 6),
    ]))
    story.append(t_chain)
    story.append(Spacer(1, 0.4 * cm))

    # ---------------------------------------------------------
    # SECCIÓN 3: DESCRIPCIÓN TÉCNICA Y OBSERVACIONES
    # ---------------------------------------------------------
    story.append(Paragraph("3. DESCRIPCIÓN TÉCNICA DEL ACTIVO", section_heading))
    desc_text = asset.description or "Sin descripción técnica adicional registrada."

    t_desc = Table([[Paragraph(f"<b>Detalle del Bien:</b><br/>{desc_text}", cell_normal)]], colWidths=[15.9 * cm])
    t_desc.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#FFFFFF")),
        ("BOX", (0, 0), (0, 0), 0.5, colors.HexColor("#A0A0A0")),
        ("PADDING", (0, 0), (0, 0), 8),
    ]))
    story.append(t_desc)
    story.append(Spacer(1, 0.5 * cm))

    # ---------------------------------------------------------
    # SECCIÓN 4: HISTORIAL DE MANTENIMIENTO Y ÓRDENES VINCULADAS
    # ---------------------------------------------------------
    story.append(Paragraph("4. HISTORIAL DE MANTENIMIENTO Y ÓRDENES VINCULADAS", section_heading))

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
    story.append(Spacer(1, 0.5 * cm))

    # ---------------------------------------------------------
    # SECCIÓN 5: EVIDENCIAS Y REGISTRO FOTOGRÁFICO
    # ---------------------------------------------------------
    story.append(Paragraph("5. EVIDENCIAS Y REGISTRO FOTOGRÁFICO", section_heading))

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
    t_photo = Table(photo_data, colWidths=[7.95 * cm, 7.95 * cm], rowHeights=[None, 3.5 * cm])
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
    sig_block.append(Spacer(1, 20))
    sig_block.append(t_sig)
    story.append(KeepTogether(sig_block))

    doc.build(story)
    output.seek(0)
    return output
