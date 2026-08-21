import os
from io import BytesIO

from django.utils import timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm, mm
from reportlab.pdfgen import canvas
from reportlab.graphics.barcode.qr import QrCodeWidget
from reportlab.graphics.shapes import Drawing
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


def _get_logo_image(width=1.5 * cm, height=1.5 * cm):
    if os.path.exists(LOGO_PATH):
        try:
            return Image(LOGO_PATH, width=width, height=height, kind="proportional")
        except Exception:
            pass
    return None


class EntryNumberedCanvas(canvas.Canvas):
    """Canvas institucional para Ficha de Entrada."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_footer(num_pages, "INCALPACA FM S.A. — Ficha de Entrada de Bienes Patrimoniales")
            super().showPage()
        super().save()

    def draw_footer(self, page_count, doc_title):
        self.saveState()
        self.setFont("Times-Roman", 8)
        self.setFillColor(colors.HexColor("#444444"))
        self.setStrokeColor(colors.HexColor("#000000"))
        self.setLineWidth(0.5)

        margin = 25.4 * mm
        page_width, _ = A4
        y_line = 42
        y_text = 30

        self.line(margin, y_line, page_width - margin, y_line)
        self.drawString(margin, y_text, doc_title)
        page_text = f"Página {self._pageNumber} de {page_count}"
        self.drawRightString(page_width - margin, y_text, page_text)
        self.restoreState()


class AssignmentNumberedCanvas(canvas.Canvas):
    """Canvas institucional para Ficha de Asignación."""
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._saved_page_states = []

    def showPage(self):
        self._saved_page_states.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        num_pages = len(self._saved_page_states)
        for state in self._saved_page_states:
            self.__dict__.update(state)
            self.draw_footer(num_pages, "INCALPACA FM S.A. — Ficha de Asignación y Custodia de Bienes")
            super().showPage()
        super().save()

    def draw_footer(self, page_count, doc_title):
        self.saveState()
        self.setFont("Times-Roman", 8)
        self.setFillColor(colors.HexColor("#444444"))
        self.setStrokeColor(colors.HexColor("#000000"))
        self.setLineWidth(0.5)

        margin = 25.4 * mm
        page_width, _ = A4
        y_line = 42
        y_text = 30

        self.line(margin, y_line, page_width - margin, y_line)
        self.drawString(margin, y_text, doc_title)
        page_text = f"Página {self._pageNumber} de {page_count}"
        self.drawRightString(page_width - margin, y_text, page_text)
        self.restoreState()


def _format_date(date_val):
    if not date_val:
        return "—"
    if hasattr(date_val, "strftime"):
        return date_val.strftime("%d/%m/%Y")
    val_str = str(date_val)
    if "T" in val_str:
        return val_str.split("T")[0]
    return val_str


def build_asset_entry_pdf(asset):
    """
    Construye la Ficha de Entrada del Bien exclusivamente con los datos de ingreso al sistema.
    """
    output = BytesIO()
    margin = 25.4 * mm

    doc = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=margin,
        leftMargin=margin,
        topMargin=margin,
        bottomMargin=margin,
    )

    styles = getSampleStyleSheet()

    doc_header_title = ParagraphStyle(
        "DocHeaderTitleEntry",
        parent=styles["Normal"],
        fontName="Times-Bold",
        fontSize=12,
        leading=15,
        textColor=colors.HexColor("#000000"),
    )

    doc_header_right = ParagraphStyle(
        "DocHeaderRightEntry",
        parent=styles["Normal"],
        fontName="Times-Roman",
        fontSize=8.5,
        leading=12,
        alignment=2,
        textColor=colors.HexColor("#111111"),
    )

    section_heading = ParagraphStyle(
        "SectionHeadingEntry",
        parent=styles["Heading2"],
        fontName="Times-Bold",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#000000"),
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True,
    )

    cell_bold = ParagraphStyle(
        "CellBoldEntry",
        parent=styles["Normal"],
        fontName="Times-Bold",
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor("#000000"),
    )

    cell_normal = ParagraphStyle(
        "CellNormalEntry",
        parent=styles["Normal"],
        fontName="Times-Roman",
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor("#111111"),
    )

    code_matrix_style = ParagraphStyle(
        "CodeMatrixStyleEntry",
        parent=styles["Normal"],
        fontName="Courier-Bold",
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor("#000000"),
    )

    story = []

    payload = asset.entry_payload or {}
    now_str = timezone.localtime().strftime("%d/%m/%Y %H:%M")
    technical_id = asset.code or "—"
    taxonomy_code = asset.full_assignment_code or "—"

    logo_img = _get_logo_image(width=1.3 * cm, height=1.3 * cm)

    brand_text = Paragraph(
        "<b>INCALPACA FM S.A.</b><br/>"
        "<font color='#444444' size='8'>Sistema de Gestión Técnica y Bienes</font><br/>"
        "<font size='10.5'><b>FICHA DE ENTRADA DEL BIEN</b></font>",
        doc_header_title,
    )

    public_url = getattr(asset, "public_url", None) or f"http://localhost:8008/bienes/{asset.id}"
    qr_drawing = Drawing(48, 48)
    qr_widget = QrCodeWidget(public_url)
    qr_widget.barWidth = 44
    qr_widget.barHeight = 44
    qr_widget.barBorder = 0
    qr_drawing.add(qr_widget)

    meta_text = Paragraph(
        f"<b>Fecha de Emisión:</b> {now_str}<br/>"
        f"<b>ID Técnico Único:</b> {technical_id}<br/>"
        f"<b>Código Taxonomía:</b> {taxonomy_code}",
        doc_header_right,
    )

    content_width = A4[0] - (2 * margin)

    if logo_img:
        header_table = Table(
            [[logo_img, brand_text, meta_text, qr_drawing]],
            colWidths=[1.5 * cm, 6.2 * cm, 6.4 * cm, 1.8 * cm],
        )
    else:
        header_table = Table(
            [[brand_text, meta_text, qr_drawing]],
            colWidths=[7.7 * cm, 6.4 * cm, 1.8 * cm],
        )

    header_table.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (3, 0), (3, 0), "RIGHT"),
            ("PADDING", (0, 0), (-1, -1), 1),
        ])
    )

    story.append(header_table)
    story.append(Spacer(1, 0.2 * cm))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#000000"), spaceBefore=2, spaceAfter=6))

    # 1. IDENTIFICACIÓN DEL BIEN
    story.append(Paragraph("1. IDENTIFICACIÓN DEL BIEN", section_heading))

    brand_val = asset.brand or payload.get("brand") or "—"
    model_val = asset.model or payload.get("model") or "—"
    brand_model_str = f"{brand_val} / {model_val}" if (brand_val != "—" or model_val != "—") else "—"

    taxonomy_obj = getattr(asset, "taxonomy", None)
    tipo_bien = (
        (taxonomy_obj.category if taxonomy_obj else None)
        or payload.get("category")
        or payload.get("assetType")
        or (taxonomy_obj.name if taxonomy_obj else None)
        or "—"
    )

    crit_val = asset.criticality or payload.get("criticality") or "Media"
    cond_val = asset.condition or payload.get("condition") or "Nuevo"
    desc_val = asset.description or payload.get("description") or "—"

    col_w1 = 3.6 * cm
    col_w2 = 4.36 * cm
    col_w3 = 3.6 * cm
    col_w4 = 4.36 * cm

    sec1_data = [
        [
            Paragraph("<b>ID Técnico Único:</b>", cell_bold),
            Paragraph(f"<b>{technical_id}</b>", cell_normal),
            Paragraph("<b>Código Taxonomía:</b>", cell_bold),
            Paragraph(f"<b>{taxonomy_code}</b>", cell_normal),
        ],
        [
            Paragraph("<b>Nombre del Bien:</b>", cell_bold),
            Paragraph(f"<b>{asset.name}</b>", cell_normal),
            Paragraph("<b>Tipo de Bien:</b>", cell_bold),
            Paragraph(tipo_bien, cell_normal),
        ],
        [
            Paragraph("<b>Marca / Modelo:</b>", cell_bold),
            Paragraph(brand_model_str, cell_normal),
            Paragraph("<b>Número de Serie:</b>", cell_bold),
            Paragraph(asset.serial_number or payload.get("serialNumber") or "—", cell_normal),
        ],
        [
            Paragraph("<b>Criticidad:</b>", cell_bold),
            Paragraph(crit_val, cell_normal),
            Paragraph("<b>Condición Inicial:</b>", cell_bold),
            Paragraph(cond_val, cell_normal),
        ],
        [
            Paragraph("<b>Descripción:</b>", cell_bold),
            Paragraph(desc_val, cell_normal),
            Paragraph("", cell_normal),
            Paragraph("", cell_normal),
        ],
    ]

    t_sec1 = Table(sec1_data, colWidths=[col_w1, col_w2, col_w3, col_w4])
    t_sec1.setStyle(
        TableStyle([
            ("SPAN", (1, 4), (3, 4)),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F8F9FA")),
            ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F8F9FA")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("PADDING", (0, 0), (-1, -1), 3.5),
        ])
    )
    story.append(t_sec1)
    story.append(Spacer(1, 0.25 * cm))

    # 2. ESTRUCTURA TAXONÓMICA Y UBICACIÓN (9 NIVELES)
    story.append(Paragraph("2. ESTRUCTURA TAXONÓMICA Y UBICACIÓN (9 NIVELES)", section_heading))

    location_obj = getattr(asset, "location", None)

    n1_code = str(payload.get("n1_code") or payload.get("site_code") or "INC1").upper()
    n1_name = str(payload.get("site") or (location_obj.site if location_obj else None) or "Sede Principal")

    n2_code = str(payload.get("n2_code") or payload.get("macro_area_code") or "AD").upper()
    n2_name = str(payload.get("macro_area") or "Sectores Administrativos")

    n3_code = str(payload.get("n3_code") or payload.get("area_code") or payload.get("building_code") or "—").upper()
    n3_name = str(
        (location_obj.area if location_obj else None)
        or payload.get("locationArea")
        or payload.get("area")
        or payload.get("building")
        or "—"
    )

    n4_code = str(payload.get("n4_code") or payload.get("room_code") or "—").upper()
    n4_name = str(
        (location_obj.room if location_obj else None)
        or (location_obj.specific_location if location_obj else None)
        or payload.get("room")
        or payload.get("specificLocation")
        or "—"
    )

    n5_code = str(payload.get("n5_code") or payload.get("family_code") or (taxonomy_obj.category[:3].upper() if taxonomy_obj and taxonomy_obj.category else "—"))
    n5_name = str((taxonomy_obj.category if taxonomy_obj else None) or payload.get("family") or payload.get("category") or "—")

    n6_code = str(payload.get("n6_code") or payload.get("type_code") or (taxonomy_obj.prefix if taxonomy_obj else "—"))
    n6_name = str((taxonomy_obj.subcategory if taxonomy_obj else None) or (taxonomy_obj.name if taxonomy_obj else None) or payload.get("subcategory") or "—")

    n7_code = str(payload.get("n7_code") or payload.get("part_code") or "—")
    n7_name = str(payload.get("part") or payload.get("partName") or "—")

    n8_code = str(payload.get("n8_code") or payload.get("piece_code") or "—")
    n8_name = str(payload.get("piece") or payload.get("pieceName") or "—")

    raw_sku = str(payload.get("n9_code") or payload.get("sku") or asset.fm_sequence_value or "—")
    if "-" in raw_sku:
        sku_num = raw_sku.split("-")[-1].strip()
    else:
        sku_num = raw_sku.replace("SKU", "").replace("sku", "").strip()
    n9_code = f"SKU{sku_num}" if sku_num and sku_num != "—" else (raw_sku if raw_sku != "None" else "—")
    n9_name = "Correlativo de Inventario" if n9_code != "—" else "—"

    sec2_data = [
        [
            Paragraph("<b>1. Sede:</b>", cell_bold),
            Paragraph(f"<b>[{n1_code}]</b> {n1_name}", cell_normal),
            Paragraph("<b>2. Área Macro:</b>", cell_bold),
            Paragraph(f"<b>[{n2_code}]</b> {n2_name}", cell_normal),
        ],
        [
            Paragraph("<b>3. Área:</b>", cell_bold),
            Paragraph(f"<b>[{n3_code}]</b> {n3_name}", cell_normal),
            Paragraph("<b>4. Módulo:</b>", cell_bold),
            Paragraph(f"<b>[{n4_code}]</b> {n4_name}", cell_normal),
        ],
        [
            Paragraph("<b>5. Tipo de Bien:</b>", cell_bold),
            Paragraph(f"<b>[{n5_code}]</b> {n5_name}", cell_normal),
            Paragraph("<b>6. Bien:</b>", cell_bold),
            Paragraph(f"<b>[{n6_code}]</b> {n6_name}", cell_normal),
        ],
        [
            Paragraph("<b>7. Característica:</b>", cell_bold),
            Paragraph(f"<b>[{n7_code}]</b> {n7_name}", cell_normal),
            Paragraph("<b>8. Variante / Modelo:</b>", cell_bold),
            Paragraph(f"<b>[{n8_code}]</b> {n8_name}", cell_normal),
        ],
        [
            Paragraph("<b>9. SKU:</b>", cell_bold),
            Paragraph(f"<b>[{n9_code}]</b> {n9_name}", cell_normal),
            Paragraph("", cell_normal),
            Paragraph("", cell_normal),
        ],
        [
            Paragraph("<b>Código de Taxonomía Completo:</b>", cell_bold),
            Paragraph(f"<b>{taxonomy_code}</b>", code_matrix_style),
            Paragraph("", cell_normal),
            Paragraph("", cell_normal),
        ],
    ]

    t_sec2 = Table(sec2_data, colWidths=[col_w1, col_w2, col_w3, col_w4])
    t_sec2.setStyle(
        TableStyle([
            ("SPAN", (1, 4), (3, 4)),
            ("SPAN", (1, 5), (3, 5)),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F8F9FA")),
            ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F8F9FA")),
            ("BACKGROUND", (1, 5), (3, 5), colors.HexColor("#F0F0F0")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("PADDING", (0, 0), (-1, -1), 3.5),
        ])
    )
    story.append(t_sec2)
    story.append(Spacer(1, 0.25 * cm))

    # 3. DATOS DE INGRESO
    story.append(Paragraph("3. DATOS DE INGRESO", section_heading))

    entry_type_map = {
        "purchase": "Compra",
        "own_creation": "Creación propia / Fabricación",
        "donation": "Regalo o donación",
        "rental": "Alquiler / Contrato temporal",
    }
    raw_entry_type = asset.entry_type or payload.get("entryType") or "purchase"
    entry_type_label = entry_type_map.get(raw_entry_type, raw_entry_type.capitalize())

    effective_entry_date = _format_date(payload.get("effectiveEntryDate") or asset.created_at)
    purchase_date = _format_date(
        payload.get("acquisitionDate")
        or payload.get("completionDate")
        or payload.get("receptionDate")
        or None
    )

    doc_compra = (
        payload.get("purchaseOrder")
        or payload.get("donationDocument")
        or payload.get("contractNumber")
        or payload.get("internalOrder")
        or "—"
    )
    num_doc = (
        payload.get("voucherNumber")
        or payload.get("contractNumber")
        or payload.get("internalOrder")
        or "—"
    )

    cost_val = str(payload.get("cost") or "").strip()
    curr_val = str(payload.get("currency") or "PEN").strip()
    cost_display = f"{curr_val} {cost_val}" if cost_val else "—"

    cost_center = str(payload.get("costCenter") or payload.get("producingArea") or "—")

    registered_by_user = (
        (asset.registered_by.get_full_name() if asset.registered_by else None)
        or (asset.registered_by.username if asset.registered_by else None)
        or str(payload.get("registeredBy") or "Administrador SGTB")
    )

    sec3_data = [
        [
            Paragraph("<b>Fecha de Ingreso:</b>", cell_bold),
            Paragraph(effective_entry_date, cell_normal),
            Paragraph("<b>Tipo de Ingreso:</b>", cell_bold),
            Paragraph(f"<b>{entry_type_label}</b>", cell_normal),
        ],
        [
            Paragraph("<b>Proveedor:</b>", cell_bold),
            Paragraph(str(payload.get("supplier") or payload.get("donor") or "—"), cell_normal),
            Paragraph("<b>Documento de Compra:</b>", cell_bold),
            Paragraph(doc_compra, cell_normal),
        ],
        [
            Paragraph("<b>Número de Documento:</b>", cell_bold),
            Paragraph(num_doc, cell_normal),
            Paragraph("<b>Fecha de Compra:</b>", cell_bold),
            Paragraph(purchase_date, cell_normal),
        ],
        [
            Paragraph("<b>Costo / Valor:</b>", cell_bold),
            Paragraph(cost_display, cell_normal),
            Paragraph("<b>Moneda:</b>", cell_bold),
            Paragraph(curr_val if cost_val else "—", cell_normal),
        ],
        [
            Paragraph("<b>Centro de Costo:</b>", cell_bold),
            Paragraph(cost_center, cell_normal),
            Paragraph("<b>Registrado Por:</b>", cell_bold),
            Paragraph(registered_by_user, cell_normal),
        ],
    ]

    t_sec3 = Table(sec3_data, colWidths=[col_w1, col_w2, col_w3, col_w4])
    t_sec3.setStyle(
        TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F8F9FA")),
            ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F8F9FA")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("PADDING", (0, 0), (-1, -1), 3.5),
        ])
    )
    story.append(t_sec3)
    story.append(Spacer(1, 0.25 * cm))

    # 4. UBICACIÓN INICIAL
    story.append(Paragraph("4. UBICACIÓN INICIAL", section_heading))

    initial_responsible = str(
        payload.get("assigneeName")
        or payload.get("responsibleName")
        or payload.get("responsible")
        or "Sin asignar al ingreso"
    )
    initial_status = str(
        asset.operational_status
        or asset.administrative_status
        or payload.get("condition")
        or "Registrado"
    )

    sec4_data = [
        [
            Paragraph("<b>Sede:</b>", cell_bold),
            Paragraph(n1_name, cell_normal),
            Paragraph("<b>Área:</b>", cell_bold),
            Paragraph(n3_name, cell_normal),
        ],
        [
            Paragraph("<b>Módulo / Ubicación:</b>", cell_bold),
            Paragraph(n4_name, cell_normal),
            Paragraph("<b>Responsable Inicial:</b>", cell_bold),
            Paragraph(initial_responsible, cell_normal),
        ],
        [
            Paragraph("<b>Estado Inicial:</b>", cell_bold),
            Paragraph(initial_status, cell_normal),
            Paragraph("", cell_normal),
            Paragraph("", cell_normal),
        ],
    ]

    t_sec4 = Table(sec4_data, colWidths=[col_w1, col_w2, col_w3, col_w4])
    t_sec4.setStyle(
        TableStyle([
            ("SPAN", (1, 2), (3, 2)),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F8F9FA")),
            ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F8F9FA")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("PADDING", (0, 0), (-1, -1), 3.5),
        ])
    )
    story.append(t_sec4)
    story.append(Spacer(1, 0.25 * cm))

    # 5. REGISTRO FOTOGRÁFICO Y EVIDENCIAS
    story.append(Paragraph("5. REGISTRO FOTOGRÁFICO Y EVIDENCIAS", section_heading))

    evidence_list = payload.get("evidence") or []
    if evidence_list:
        doc_names = [f"• {e.get('name', 'Documento')} ({e.get('category', 'sustento')})" for e in evidence_list]
        docs_str = "<br/>".join(doc_names)
    else:
        docs_str = "Sin documentos adicionales adjuntos."

    obs_val = str(payload.get("observations") or payload.get("assignmentObservations") or "Sin observaciones adicionales registradas al momento del ingreso.")

    empty_photo_style = ParagraphStyle(
        "EmptyPhotoEntry",
        parent=cell_normal,
        fontName="Times-Italic",
        textColor=colors.HexColor("#777777"),
        alignment=1,
    )

    photo_col_width = 4.8 * cm
    info_col_width = content_width - photo_col_width

    photo_element = Paragraph("Sin registro fotográfico adjunto", empty_photo_style)
    if hasattr(asset, "photo") and asset.photo and os.path.exists(getattr(asset.photo, "path", "")):
        try:
            photo_element = Image(asset.photo.path, width=4.4 * cm, height=3.2 * cm, kind="proportional")
        except Exception:
            pass

    evidence_table_data = [
        [
            Paragraph("<b>Fotografía Inicial</b>", cell_bold),
            Paragraph("<b>Documentos Asociados y Observaciones</b>", cell_bold),
        ],
        [
            photo_element,
            Paragraph(
                f"<b>Documentos Asociados:</b><br/>{docs_str}<br/><br/>"
                f"<b>Observaciones de Ingreso:</b><br/>{obs_val}",
                cell_normal,
            ),
        ],
    ]

    t_evidence = Table(evidence_table_data, colWidths=[photo_col_width, info_col_width])
    t_evidence.setStyle(
        TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F8F9FA")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 1), (0, 1), "CENTER"),
            ("PADDING", (0, 0), (-1, -1), 4),
        ])
    )
    story.append(t_evidence)
    story.append(Spacer(1, 0.4 * cm))

    # 6. FIRMAS
    sig_col_w = content_width / 3.0
    sig_block = []

    sig_data = [
        [
            Paragraph(
                f"<br/><br/><br/>___________________________________<br/>"
                f"<b>Responsable de Registro</b><br/>"
                f"<font size='7.5'>{registered_by_user}</font>",
                ParagraphStyle("Sig1Entry", parent=cell_normal, alignment=1, fontSize=8),
            ),
            Paragraph(
                f"<br/><br/><br/>___________________________________<br/>"
                f"<b>Responsable de Recepción</b><br/>"
                f"<font size='7.5'>{initial_responsible}</font>",
                ParagraphStyle("Sig2Entry", parent=cell_normal, alignment=1, fontSize=8),
            ),
            Paragraph(
                f"<br/><br/><br/>___________________________________<br/>"
                f"<b>V°B° Supervisor / Administración</b><br/>"
                f"<font size='7.5'>Control Patrimonial &amp; FM</font>",
                ParagraphStyle("Sig3Entry", parent=cell_normal, alignment=1, fontSize=8),
            ),
        ]
    ]

    t_sig = Table(sig_data, colWidths=[sig_col_w, sig_col_w, sig_col_w])
    t_sig.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("PADDING", (0, 0), (-1, -1), 2),
        ])
    )
    sig_block.append(t_sig)
    story.append(KeepTogether(sig_block))

    doc.build(story, canvasmaker=EntryNumberedCanvas)
    output.seek(0)
    return output


def build_asset_assignment_pdf(asset):
    """
    Construye la FICHA DE ASIGNACIÓN DEL BIEN centrada exclusivamente en la custodia y asignación formal.
    Estructura:
    1. Identificación del Bien
    2. Datos de Asignación
    3. Motivo de Asignación
    4. Condición del Bien al Momento de la Asignación
    5. Constancia de Entrega y Recepción (Firmas formales: Entrega, Recibe, V°B° Supervisor)
    """
    output = BytesIO()
    margin = 25.4 * mm

    doc = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=margin,
        leftMargin=margin,
        topMargin=margin,
        bottomMargin=margin,
    )

    styles = getSampleStyleSheet()

    doc_header_title = ParagraphStyle(
        "DocHeaderTitleAsg",
        parent=styles["Normal"],
        fontName="Times-Bold",
        fontSize=12,
        leading=15,
        textColor=colors.HexColor("#000000"),
    )

    doc_header_right = ParagraphStyle(
        "DocHeaderRightAsg",
        parent=styles["Normal"],
        fontName="Times-Roman",
        fontSize=8.5,
        leading=12,
        alignment=2,
        textColor=colors.HexColor("#111111"),
    )

    section_heading = ParagraphStyle(
        "SectionHeadingAsg",
        parent=styles["Heading2"],
        fontName="Times-Bold",
        fontSize=10,
        leading=14,
        textColor=colors.HexColor("#000000"),
        spaceBefore=10,
        spaceAfter=4,
        keepWithNext=True,
    )

    cell_bold = ParagraphStyle(
        "CellBoldAsg",
        parent=styles["Normal"],
        fontName="Times-Bold",
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor("#000000"),
    )

    cell_normal = ParagraphStyle(
        "CellNormalAsg",
        parent=styles["Normal"],
        fontName="Times-Roman",
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor("#111111"),
    )

    code_matrix_style = ParagraphStyle(
        "CodeMatrixStyleAsg",
        parent=styles["Normal"],
        fontName="Courier-Bold",
        fontSize=8.5,
        leading=11.5,
        textColor=colors.HexColor("#000000"),
    )

    story = []

    payload = asset.entry_payload or {}
    now_str = timezone.localtime().strftime("%d/%m/%Y %H:%M")
    technical_id = asset.code or "—"
    taxonomy_code = asset.full_assignment_code or "—"

    # Logo y encabezado
    logo_img = _get_logo_image(width=1.3 * cm, height=1.3 * cm)

    brand_text = Paragraph(
        "<b>INCALPACA FM S.A.</b><br/>"
        "<font color='#444444' size='8'>Sistema de Gestión Técnica y Bienes</font><br/>"
        "<font size='10.5'><b>FICHA DE ASIGNACIÓN DEL BIEN</b></font>",
        doc_header_title,
    )

    public_url = getattr(asset, "public_url", None) or f"http://localhost:8008/bienes/{asset.id}"
    qr_drawing = Drawing(48, 48)
    qr_widget = QrCodeWidget(public_url)
    qr_widget.barWidth = 44
    qr_widget.barHeight = 44
    qr_widget.barBorder = 0
    qr_drawing.add(qr_widget)

    meta_text = Paragraph(
        f"<b>Fecha de Emisión:</b> {now_str}<br/>"
        f"<b>ID Técnico Único:</b> {technical_id}<br/>"
        f"<b>Código Taxonomía:</b> {taxonomy_code}",
        doc_header_right,
    )

    content_width = A4[0] - (2 * margin)

    if logo_img:
        header_table = Table(
            [[logo_img, brand_text, meta_text, qr_drawing]],
            colWidths=[1.5 * cm, 6.2 * cm, 6.4 * cm, 1.8 * cm],
        )
    else:
        header_table = Table(
            [[brand_text, meta_text, qr_drawing]],
            colWidths=[7.7 * cm, 6.4 * cm, 1.8 * cm],
        )

    header_table.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (3, 0), (3, 0), "RIGHT"),
            ("PADDING", (0, 0), (-1, -1), 1),
        ])
    )

    story.append(header_table)
    story.append(Spacer(1, 0.2 * cm))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#000000"), spaceBefore=2, spaceAfter=6))

    col_w1 = 3.6 * cm
    col_w2 = 4.36 * cm
    col_w3 = 3.6 * cm
    col_w4 = 4.36 * cm

    # 1. IDENTIFICACIÓN DEL BIEN
    story.append(Paragraph("1. IDENTIFICACIÓN DEL BIEN", section_heading))

    brand_val = asset.brand or payload.get("brand") or "—"
    model_val = asset.model or payload.get("model") or "—"
    brand_model_str = f"{brand_val} / {model_val}" if (brand_val != "—" or model_val != "—") else "—"
    desc_val = asset.description or payload.get("description") or "—"

    sec1_data = [
        [
            Paragraph("<b>ID Técnico Único:</b>", cell_bold),
            Paragraph(f"<b>{technical_id}</b>", cell_normal),
            Paragraph("<b>Código Taxonomía:</b>", cell_bold),
            Paragraph(f"<b>{taxonomy_code}</b>", cell_normal),
        ],
        [
            Paragraph("<b>Nombre del Bien:</b>", cell_bold),
            Paragraph(f"<b>{asset.name}</b>", cell_normal),
            Paragraph("<b>Marca / Modelo:</b>", cell_bold),
            Paragraph(brand_model_str, cell_normal),
        ],
        [
            Paragraph("<b>Número de Serie:</b>", cell_bold),
            Paragraph(asset.serial_number or payload.get("serialNumber") or "—", cell_normal),
            Paragraph("<b>Descripción Breve:</b>", cell_bold),
            Paragraph(desc_val, cell_normal),
        ],
    ]

    t_sec1 = Table(sec1_data, colWidths=[col_w1, col_w2, col_w3, col_w4])
    t_sec1.setStyle(
        TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F8F9FA")),
            ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F8F9FA")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("PADDING", (0, 0), (-1, -1), 3.5),
        ])
    )
    story.append(t_sec1)
    story.append(Spacer(1, 0.25 * cm))

    # OBTENER ASIGNACIÓN ACTIVA REAL
    active_asg = None
    if hasattr(asset, "assignments"):
        active_asg = asset.assignments.filter(status="ACTIVA").select_related("responsible", "location").first()
        if not active_asg:
            active_asg = asset.assignments.order_by("-start_date").select_related("responsible", "location").first()

    resp_obj = active_asg.responsible if active_asg else None

    worker_code = (
        (resp_obj.external_reference if resp_obj else None)
        or payload.get("assigneeId")
        or payload.get("workerCode")
        or "—"
    )

    resp_name = (
        (resp_obj.display_name if resp_obj else None)
        or payload.get("assigneeName")
        or payload.get("responsibleName")
        or payload.get("responsible")
        or "No asignado"
    )

    area_val = (
        (resp_obj.area_name if resp_obj and resp_obj.area_name else None)
        or (asset.location.area if asset.location else None)
        or payload.get("locationArea")
        or payload.get("area")
        or "—"
    )

    cost_center_val = (
        payload.get("costCenter")
        or (resp_obj.area_name if resp_obj else None)
        or "—"
    )

    loc_parts = []
    if asset.location:
        if asset.location.site:
            loc_parts.append(asset.location.site)
        if asset.location.building:
            loc_parts.append(asset.location.building)
        if asset.location.area:
            loc_parts.append(asset.location.area)
        if asset.location.room:
            loc_parts.append(asset.location.room)
        if asset.location.specific_location:
            loc_parts.append(asset.location.specific_location)
    elif payload.get("site") or payload.get("locationArea") or payload.get("room"):
        loc_parts = [p for p in [payload.get("site"), payload.get("building"), payload.get("locationArea"), payload.get("room")] if p]

    location_physical_str = " · ".join(loc_parts) if loc_parts else "Ubicación en planta principal"

    asg_date = _format_date(active_asg.start_date if active_asg else (payload.get("assignmentDate") or asset.created_at))
    start_date_str = asg_date
    end_date_str = _format_date(active_asg.end_date) if (active_asg and active_asg.end_date) else "Vigente / Indefinida"
    asg_status_str = (active_asg.status if active_asg else asset.assignment_status) or "Asignado"

    # 2. DATOS DE ASIGNACIÓN
    story.append(Paragraph("2. DATOS DE ASIGNACIÓN", section_heading))

    sec2_data = [
        [
            Paragraph("<b>Código de Trabajador:</b>", cell_bold),
            Paragraph(f"<b>{worker_code}</b>", cell_normal),
            Paragraph("<b>Responsable Asignado:</b>", cell_bold),
            Paragraph(f"<b>{resp_name}</b>", cell_normal),
        ],
        [
            Paragraph("<b>Área:</b>", cell_bold),
            Paragraph(area_val, cell_normal),
            Paragraph("<b>Centro de Costo:</b>", cell_bold),
            Paragraph(cost_center_val, cell_normal),
        ],
        [
            Paragraph("<b>Ubicación Física:</b>", cell_bold),
            Paragraph(location_physical_str, cell_normal),
            Paragraph("<b>Estado Asignación:</b>", cell_bold),
            Paragraph(f"<b>{asg_status_str}</b>", cell_normal),
        ],
        [
            Paragraph("<b>Fecha de Asignación:</b>", cell_bold),
            Paragraph(asg_date, cell_normal),
            Paragraph("<b>Fecha de Inicio:</b>", cell_bold),
            Paragraph(start_date_str, cell_normal),
        ],
        [
            Paragraph("<b>Fecha de Finalización:</b>", cell_bold),
            Paragraph(end_date_str, cell_normal),
            Paragraph("", cell_normal),
            Paragraph("", cell_normal),
        ],
    ]

    t_sec2 = Table(sec2_data, colWidths=[col_w1, col_w2, col_w3, col_w4])
    t_sec2.setStyle(
        TableStyle([
            ("SPAN", (1, 4), (3, 4)),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F8F9FA")),
            ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F8F9FA")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("PADDING", (0, 0), (-1, -1), 3.5),
        ])
    )
    story.append(t_sec2)
    story.append(Spacer(1, 0.25 * cm))

    # 3. MOTIVO DE ASIGNACIÓN
    story.append(Paragraph("3. MOTIVO DE ASIGNACIÓN", section_heading))

    reason_val = (
        (active_asg.change_reason if active_asg and active_asg.change_reason else None)
        or payload.get("assignmentReason")
        or "Asignación inicial de funciones y custodia operativa del bien."
    )

    t_reason = Table(
        [[Paragraph(f"<b>Motivo Registrado:</b> {reason_val}", cell_normal)]],
        colWidths=[content_width],
    )
    t_reason.setStyle(
        TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFFFFF")),
            ("PADDING", (0, 0), (-1, -1), 5),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ])
    )
    story.append(t_reason)
    story.append(Spacer(1, 0.25 * cm))

    # 4. CONDICIÓN DEL BIEN AL MOMENTO DE LA ASIGNACIÓN
    story.append(Paragraph("4. CONDICIÓN DEL BIEN AL MOMENTO DE LA ASIGNACIÓN", section_heading))

    cond_str = asset.condition or payload.get("condition") or "Bueno"
    obs_asg_str = (
        payload.get("assignmentObservations")
        or payload.get("observations")
        or "El bien se entrega en condiciones operativas conformes para el desempeño de sus funciones."
    )

    empty_photo_style = ParagraphStyle(
        "EmptyPhotoAsg",
        parent=cell_normal,
        fontName="Times-Italic",
        textColor=colors.HexColor("#777777"),
        alignment=1,
    )

    photo_col_width = 4.8 * cm
    info_col_width = content_width - photo_col_width

    photo_element = Paragraph("Sin registro fotográfico adjunto", empty_photo_style)
    if hasattr(asset, "photo") and asset.photo and os.path.exists(getattr(asset.photo, "path", "")):
        try:
            photo_element = Image(asset.photo.path, width=4.4 * cm, height=3.0 * cm, kind="proportional")
        except Exception:
            pass

    cond_table_data = [
        [
            Paragraph("<b>Fotografía del Bien</b>", cell_bold),
            Paragraph("<b>Estado / Condición y Observaciones</b>", cell_bold),
        ],
        [
            photo_element,
            Paragraph(
                f"<b>Estado / Condición:</b> {cond_str}<br/><br/>"
                f"<b>Observaciones de Entrega:</b><br/>{obs_asg_str}",
                cell_normal,
            ),
        ],
    ]

    t_cond = Table(cond_table_data, colWidths=[photo_col_width, info_col_width])
    t_cond.setStyle(
        TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F8F9FA")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 1), (0, 1), "CENTER"),
            ("PADDING", (0, 0), (-1, -1), 4),
        ])
    )
    story.append(t_cond)
    story.append(Spacer(1, 0.4 * cm))

    # 5. CONSTANCIA DE ENTREGA Y RECEPCIÓN (Firmas formales estructuradas)
    story.append(Paragraph("5. CONSTANCIA DE ENTREGA Y RECEPCIÓN", section_heading))

    registered_by_user = (
        (asset.registered_by.get_full_name() if asset.registered_by else None)
        or (asset.registered_by.username if asset.registered_by else None)
        or str(payload.get("registeredBy") or "Administración FM")
    )

    sig_col_w = content_width / 3.0
    sig_block = []

    sig_data = [
        [
            Paragraph(
                f"<b>ENTREGA</b><br/>"
                f"<b>Nombre:</b> {registered_by_user}<br/>"
                f"<b>Cargo:</b> Control Patrimonial / FM<br/><br/>"
                f"___________________________________<br/>"
                f"<b>Firma:</b><br/>"
                f"<b>Fecha:</b> {now_str[:10]}",
                ParagraphStyle("Sig1Asg", parent=cell_normal, fontSize=8, leading=11),
            ),
            Paragraph(
                f"<b>RECIBE</b><br/>"
                f"<b>Responsable:</b> {resp_name}<br/>"
                f"<b>Cód. Trabajador:</b> {worker_code}<br/><br/>"
                f"___________________________________<br/>"
                f"<b>Firma:</b><br/>"
                f"<b>Fecha:</b> {asg_date}",
                ParagraphStyle("Sig2Asg", parent=cell_normal, fontSize=8, leading=11),
            ),
            Paragraph(
                f"<b>V°B° SUPERVISOR / ADM.</b><br/>"
                f"<b>Nombre:</b> Rosa Medina<br/>"
                f"<b>Cargo:</b> Control Patrimonial &amp; FM<br/><br/>"
                f"___________________________________<br/>"
                f"<b>Firma:</b><br/>"
                f"<b>Fecha:</b> {now_str[:10]}",
                ParagraphStyle("Sig3Asg", parent=cell_normal, fontSize=8, leading=11),
            ),
        ]
    ]

    t_sig = Table(sig_data, colWidths=[sig_col_w, sig_col_w, sig_col_w])
    t_sig.setStyle(
        TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FCFCFC")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("PADDING", (0, 0), (-1, -1), 5),
        ])
    )
    sig_block.append(t_sig)
    story.append(KeepTogether(sig_block))

    doc.build(story, canvasmaker=AssignmentNumberedCanvas)
    output.seek(0)
    return output


def build_asset_pdf(asset, report_type="completo"):
    """
    Construye el PDF correspondiente según el tipo solicitado.
    - 'entrada': Ficha de Entrada del Bien.
    - 'asignacion': Ficha de Asignación y Custodia del Bien.
    - 'completo' o default: Ficha Técnica Detallada.
    """
    r_type = str(report_type).lower()
    if r_type == "entrada":
        return build_asset_entry_pdf(asset)
    if r_type == "asignacion":
        return build_asset_assignment_pdf(asset)

    # Fallback al reporte técnico general
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
