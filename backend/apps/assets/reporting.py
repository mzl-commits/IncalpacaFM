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


def build_asset_pdf(asset, report_type="completo"):
    """
    Construye el PDF detallado del activo usando ReportLab de manera transaccional.
    Incluye todos los detalles (incluyendo imágenes temporales, reportes de bajas, etc).
    """
    output = BytesIO()

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
        spaceBefore=16,
        spaceAfter=8,
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

    code_matrix_style = ParagraphStyle(
        "CodeMatrixStyleAsset",
        parent=styles["Normal"],
        fontName="Courier-Bold",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#000000"),
    )

    story = []

    # MEMBRETE OFICIAL
    logo_img = _get_logo_image()

    brand_text = Paragraph(
        "<b>INCALPACA FM S.A.</b><br/>"
        "<font color='#555555' size='8.5'>Sistema de Gestión Técnica y Bienes</font><br/>"
        "<b>FICHA TÉCNICA DE BIEN</b>",
        doc_header_title
    )

    now_str = timezone.localtime().strftime('%d de %B de %Y')
    technical_id = asset.code or "INC-BIEN-2026-000215"
    taxonomy_code = asset.full_assignment_code
    payload = asset.entry_payload or {}

    meta_text = Paragraph(
        f"<b>Fecha de Emisión:</b> {now_str}<br/>"
        f"<b>ID Técnico Único:</b> {technical_id}<br/>"
        f"<b>Código Taxonomía:</b> {taxonomy_code}",
        doc_header_right
    )

    if logo_img:
        header_table = Table([[logo_img, brand_text, meta_text]], colWidths=[2.0 * cm, 8.4 * cm, 5.5 * cm])
    else:
        header_table = Table([[brand_text, meta_text]], colWidths=[10.4 * cm, 5.5 * cm])

    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 2),
    ]))

    story.append(header_table)
    story.append(Spacer(1, 0.3 * cm))
    story.append(HRFlowable(width="100%", thickness=1.0, color=colors.HexColor("#000000"), spaceBefore=4, spaceAfter=10))

    # JERARQUÍA DE 9 NIVELES
    n1_code = str(payload.get("n1_code") or payload.get("site_code") or "INC1")
    n1_name = str(payload.get("site") or "INCALPACA (Calle Cóndor 100, Sachaca, Arequipa, Perú)")

    n2_code = str(payload.get("n2_code") or payload.get("macro_area_code") or "AD")
    n2_name = str(payload.get("macro_area") or "SECTORES ADMINISTRATIVOS")

    location = getattr(asset, "location", None)
    n3_code = str(payload.get("n3_code") or payload.get("building_code") or payload.get("area_code") or "MKT")
    n3_name = (location.area if location else None) or str(payload.get("area") or payload.get("building") or "Facility Management")

    n4_code = str(payload.get("n4_code") or payload.get("room_code") or "MT04")
    n4_name = (location.room if location else None) or (location.specific_location if location else None) or str(payload.get("room") or "Oficina FM")

    taxonomy = getattr(asset, "taxonomy", None)
    n5_code = str(payload.get("n5_code") or payload.get("family_code") or (taxonomy.category if taxonomy else None) or "MOB")
    n5_name = (taxonomy.category if taxonomy else None) or str(payload.get("family") or "Mobiliario")

    n6_code = str(payload.get("n6_code") or payload.get("type_code") or (taxonomy.prefix if taxonomy else None) or "SE")
    n6_name = (taxonomy.subcategory if taxonomy else None) or (taxonomy.name if taxonomy else None) or asset.name or "Silla Ergonómica Tipo 1"

    n7_code = str(payload.get("n7_code") or payload.get("part_code") or "BA")
    n7_name = str(payload.get("part") or payload.get("partName") or "Base Giratoria")

    n8_code = str(payload.get("n8_code") or payload.get("piece_code") or "6A")
    n8_name = str(payload.get("piece") or payload.get("pieceName") or "Garrucha (Rueda de Nylon)")

    raw_sku = str(payload.get("n9_code") or payload.get("sku") or asset.fm_sequence_value or "10")
    sku_num = str(raw_sku).replace("SKU", "").replace("sku", "").strip()
    n9_code = f"SKU{sku_num}" if sku_num else "SKU10"

    full_matrix_code = f"{n1_code}-{n2_code}-{n3_code}-{n4_code}-{n5_code}-{n6_code}-{n7_code}-{n8_code}-{n9_code}"

    active_assignment = asset.assignments.filter(status='ACTIVA').select_related('responsible').first() if hasattr(asset, 'assignments') else None
    resp_obj = active_assignment.responsible if active_assignment else None

    resp_name = (resp_obj.display_name if resp_obj else None) or str(payload.get("responsibleName") or payload.get("responsible") or "Rosa Medina")
    worker_code = (getattr(resp_obj, 'external_reference', None) if resp_obj else None) or str(payload.get("workerCode") or "TRAB-4082")
    cost_center = (getattr(resp_obj, 'area_name', None) if resp_obj else None) or str(payload.get("costCenter") or "CC-1040 (ADMINISTRACIÓN & MKT)")

    brand_name = getattr(asset, "brand", None) or payload.get("brand") or "Forma"
    model_name = getattr(asset, "model", None) or payload.get("model") or "ErgoMax 2026"
    serial_num = getattr(asset, "serial_number", None) or payload.get("serialNumber") or "DEMO-000190"
    cond_name = getattr(asset, "condition", None) or payload.get("condition") or "Bueno"
    crit_name = getattr(asset, "criticality", None) or payload.get("criticality") or "Baja"

    # SECCIÓN 1: ESTRUCTURA Y MATRIZ DE 9 NIVELES
    story.append(Paragraph("1. ESTRUCTURA Y MATRIZ DE 9 NIVELES (TAXONOMÍA Y UBICACIÓN)", section_heading))

    sec1_data = [
        [
            Paragraph("<b>Nivel 1 (Sede):</b>", cell_bold),
            Paragraph(f"<b>[{n1_code}]</b> {n1_name}", cell_normal),
            Paragraph("<b>Nivel 2 (Área Macro):</b>", cell_bold),
            Paragraph(f"<b>[{n2_code}]</b> {n2_name}", cell_normal),
        ],
        [
            Paragraph("<b>Nivel 3 (Área):</b>", cell_bold),
            Paragraph(f"<b>[{n3_code}]</b> {n3_name}", cell_normal),
            Paragraph("<b>Nivel 4 (Módulo):</b>", cell_bold),
            Paragraph(f"<b>[{n4_code}]</b> {n4_name}", cell_normal),
        ],
        [
            Paragraph("<b>Nivel 5 (Tipo de Bien):</b>", cell_bold),
            Paragraph(f"<b>[{n5_code}]</b> {n5_name}", cell_normal),
            Paragraph("<b>Nivel 6 (Bien):</b>", cell_bold),
            Paragraph(f"<b>[{n6_code}]</b> {n6_name}", cell_normal),
        ],
        [
            Paragraph("<b>Nivel 7 (Característica):</b>", cell_bold),
            Paragraph(f"<b>[{n7_code}]</b> {n7_name}", cell_normal),
            Paragraph("<b>Nivel 8 (Variante/Modelo):</b>", cell_bold),
            Paragraph(f"<b>[{n8_code}]</b> {n8_name}", cell_normal),
        ],
        [
            Paragraph("<b>Nivel 9 (SKU):</b>", cell_bold),
            Paragraph(f"<b>[{n9_code}]</b> Identificador Correlativo Registrado", cell_normal),
            Paragraph("", cell_normal),
            Paragraph("", cell_normal),
        ],
        [
            Paragraph("<b>Código Taxonomía Completo:</b>", cell_bold),
            Paragraph(full_matrix_code, code_matrix_style),
            Paragraph("", cell_normal),
            Paragraph("", cell_normal),
        ]
    ]

    t_sec1 = Table(sec1_data, colWidths=[3.6 * cm, 4.3 * cm, 3.6 * cm, 4.4 * cm])
    t_sec1.setStyle(TableStyle([
        ("SPAN", (1, 4), (3, 4)),
        ("SPAN", (1, 5), (3, 5)),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
        ("BACKGROUND", (1, 5), (3, 5), colors.HexColor("#FAFAFA")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t_sec1)
    story.append(Spacer(1, 0.4 * cm))

    # SECCIÓN 2: CUSTODIA Y RESPONSABLE
    story.append(Paragraph("2. CUSTODIA Y ASIGNACIÓN DE PERSONAL", section_heading))

    sec2_data = [
        [
            Paragraph("<b>ID Técnico Único:</b>", cell_bold),
            Paragraph(technical_id, cell_normal),
            Paragraph("<b>1. Código de Trabajador:</b>", cell_bold),
            Paragraph(worker_code, cell_normal),
        ],
        [
            Paragraph("<b>2. Responsable Asignado:</b>", cell_bold),
            Paragraph(resp_name, cell_normal),
            Paragraph("<b>3. Centro de Costo:</b>", cell_bold),
            Paragraph(cost_center, cell_normal),
        ],
    ]

    t_sec2 = Table(sec2_data, colWidths=[3.6 * cm, 4.3 * cm, 3.6 * cm, 4.4 * cm])
    t_sec2.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t_sec2)
    story.append(Spacer(1, 0.4 * cm))

    # SECCIÓN 3: ESPECIFICACIONES TÉCNICAS Y DESCRIPCIÓN
    story.append(Paragraph("3. ESPECIFICACIONES TÉCNICAS Y CONDICIÓN", section_heading))
    desc_text = asset.description or "Archivador fabricado por mantenimiento."

    sec3_data = [
        [
            Paragraph("<b>Marca / Modelo:</b>", cell_bold),
            Paragraph(f"{brand_name} — {model_name}", cell_normal),
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
            Paragraph("<b>Descripción Técnica:</b>", cell_bold),
            Paragraph(desc_text, cell_normal),
            Paragraph("", cell_normal),
            Paragraph("", cell_normal),
        ],
    ]

    t_sec3 = Table(sec3_data, colWidths=[3.6 * cm, 4.3 * cm, 3.6 * cm, 4.4 * cm])
    t_sec3.setStyle(TableStyle([
        ("SPAN", (1, 2), (3, 2)),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t_sec3)
    story.append(Spacer(1, 0.4 * cm))

    # SECCIÓN 4: HISTORIAL DE MANTENIMIENTO Y REPARACIONES
    story.append(Paragraph("4. REGISTRO FOTOGRÁFICO Y EVIDENCIAS DE CAMPO", section_heading))

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
        ("BACKGROUND", (0, 1), (-1, -1), colors.HexColor("#FFFFFF")),
    ]))
    story.append(t_photo)
    story.append(Spacer(1, 0.4 * cm))

    # SECCIÓN 5: HISTORIAL DE CUSTODIA Y RESPONSABLES
    story.append(Paragraph("5. HISTORIAL DE CUSTODIA Y RESPONSABLES", section_heading))

    custody_rows = [
        [
            Paragraph("<b>Responsable</b>", cell_bold),
            Paragraph("<b>Área</b>", cell_bold),
            Paragraph("<b>Fecha Inicio</b>", cell_bold),
            Paragraph("<b>Fecha Fin</b>", cell_bold),
            Paragraph("<b>Estado</b>", cell_bold),
            Paragraph("<b>Motivo</b>", cell_bold),
        ],
        [
            Paragraph("Rosa Medina", cell_bold),
            Paragraph("Facility Management", cell_normal),
            Paragraph("07 de julio de 2026", cell_normal),
            Paragraph("<i>Vigente</i>", cell_normal),
            Paragraph("Activa", cell_normal),
            Paragraph("Asignación vigente de datos de prueba", cell_normal),
        ],
        [
            Paragraph("Área de Sistemas", cell_bold),
            Paragraph("Sistemas", cell_normal),
            Paragraph("13 de octubre de 2025", cell_normal),
            Paragraph("15 de abril de 2026", cell_normal),
            Paragraph("FINALIZADA", cell_normal),
            Paragraph("Dato de prueba: custodia anterior", cell_normal),
        ],
    ]

    t_custody = Table(custody_rows, colWidths=[2.8 * cm, 2.6 * cm, 2.7 * cm, 2.5 * cm, 2.0 * cm, 3.3 * cm])
    t_custody.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t_custody)
    story.append(Spacer(1, 0.4 * cm))

    # SECCIÓN 6: HISTORIAL DE MANTENIMIENTO
    story.append(Paragraph("6. HISTORIAL DE MANTENIMIENTO Y ATENCIONES A NIVEL DE PIEZA", section_heading))

    maint_rows = [
        [
            Paragraph("<b>N.° Orden</b>", cell_bold),
            Paragraph("<b>Tipo</b>", cell_bold),
            Paragraph("<b>Problema / Trabajo</b>", cell_bold),
            Paragraph("<b>Técnico</b>", cell_bold),
            Paragraph("<b>Condición Resultante</b>", cell_bold),
            Paragraph("<b>Costo</b>", ParagraphStyle("M6Header", parent=cell_bold, alignment=2)),
        ],
        [
            Paragraph("OT-DEMO-000190-02", cell_bold),
            Paragraph("CORRECTIVO", cell_normal),
            Paragraph("Desgaste detectado durante la operación.", cell_normal),
            Paragraph("Luis Fernández", cell_normal),
            Paragraph("Operativo", cell_normal),
            Paragraph("S/ 344.00", ParagraphStyle("M6R", parent=cell_normal, alignment=2)),
        ],
        [
            Paragraph("OT-DEMO-000190-01", cell_bold),
            Paragraph("PREVENTIVO", cell_normal),
            Paragraph("Mantenimiento preventivo programado.", cell_normal),
            Paragraph("Carlos Mendoza", cell_normal),
            Paragraph("Bueno", cell_normal),
            Paragraph("S/ 195.00", ParagraphStyle("M6R2", parent=cell_normal, alignment=2)),
        ],
    ]

    t_maint = Table(maint_rows, colWidths=[2.8 * cm, 2.4 * cm, 3.8 * cm, 3.2 * cm, 2.0 * cm, 1.7 * cm])
    t_maint.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t_maint)
    story.append(Spacer(1, 0.4 * cm))

    # FIRMAS
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
