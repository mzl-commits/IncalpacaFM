import os
from datetime import datetime
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


class DetailedNumberedCanvas(canvas.Canvas):
    """Canvas institucional para Ficha Técnica Detallada del Bien."""
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
            self.draw_footer(num_pages, "INCALPACA FM S.A. — Ficha Técnica Detallada del Bien Patrimonial")
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


def _calculate_age(date_val):
    if not date_val:
        return "—"
    try:
        if isinstance(date_val, str):
            if "T" in date_val:
                date_val = date_val.split("T")[0]
            d = datetime.strptime(date_val[:10], "%Y-%m-%d").date()
        elif hasattr(date_val, "date"):
            d = date_val.date()
        elif hasattr(date_val, "year"):
            d = date_val
        else:
            return "—"

        today = timezone.now().date()
        delta_days = (today - d).days
        if delta_days < 0:
            return "0 días (reciente)"
        years = delta_days // 365
        months = (delta_days % 365) // 30
        if years > 0 and months > 0:
            return f"{years} {'año' if years == 1 else 'años'} y {months} {'mes' if months == 1 else 'meses'}"
        elif years > 0:
            return f"{years} {'año' if years == 1 else 'años'}"
        elif months > 0:
            return f"{months} {'mes' if months == 1 else 'meses'}"
        else:
            return f"{delta_days} {'día' if delta_days == 1 else 'días'}"
    except Exception:
        return "—"


# =========================================================================
# 1. FICHA DE ENTRADA DEL BIEN
# =========================================================================

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

    col_w1 = 3.6 * cm
    col_w2 = 4.36 * cm
    col_w3 = 3.6 * cm
    col_w4 = 4.36 * cm

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


# =========================================================================
# 2. FICHA DE ASIGNACIÓN DEL BIEN
# =========================================================================

def build_asset_assignment_pdf(asset):
    """
    Construye la FICHA DE ASIGNACIÓN DEL BIEN como CONSTANCIA FORMAL DE ASIGNACIÓN Y CUSTODIA.
    Estructura formal de 8 secciones:
    1. Identificación del Bien
    2. Ubicación y Custodia
    3. Datos del Responsable
    4. Datos de Asignación
    5. Condición del Bien al Momento de Entrega
    6. Declaración de Custodia
    7. Entrega y Recepción (Firmas formales)
    8. Evidencia
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
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor("#000000"),
        spaceBefore=8,
        spaceAfter=3,
        keepWithNext=True,
    )

    cell_bold = ParagraphStyle(
        "CellBoldAsg",
        parent=styles["Normal"],
        fontName="Times-Bold",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#000000"),
    )

    cell_normal = ParagraphStyle(
        "CellNormalAsg",
        parent=styles["Normal"],
        fontName="Times-Roman",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#111111"),
    )

    story = []

    payload = asset.entry_payload or {}
    now_str = timezone.localtime().strftime("%d/%m/%Y %H:%M")
    technical_id = asset.code or "—"
    fm_code_val = asset.fm_code or payload.get("sku") or "—"
    taxonomy_code = asset.full_assignment_code or "—"

    logo_img = _get_logo_image(width=1.3 * cm, height=1.3 * cm)

    brand_text = Paragraph(
        "<b>INCALPACA FM S.A.</b><br/>"
        "<font color='#444444' size='8'>Sistema de Gestión Técnica y Bienes</font><br/>"
        "<font size='10'><b>FICHA DE ASIGNACIÓN DEL BIEN</b></font>",
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
            colWidths=[1.5 * cm, 6.0 * cm, 6.6 * cm, 1.8 * cm],
        )
    else:
        header_table = Table(
            [[brand_text, meta_text, qr_drawing]],
            colWidths=[7.5 * cm, 6.6 * cm, 1.8 * cm],
        )

    header_table.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (3, 0), (3, 0), "RIGHT"),
            ("PADDING", (0, 0), (-1, -1), 1),
        ])
    )

    story.append(header_table)
    story.append(Spacer(1, 0.15 * cm))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#000000"), spaceBefore=2, spaceAfter=5))

    col_w1 = 3.5 * cm
    col_w2 = 4.46 * cm
    col_w3 = 3.5 * cm
    col_w4 = 4.46 * cm

    # OBTENER ASIGNACIÓN ACTIVA REAL Y DATOS DE RESPONSABLE
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

    resp_role = str(getattr(resp_obj, "role", "") or payload.get("assigneeRole") or "Custodio / Responsable de Puesto")

    cost_center_val = (
        payload.get("costCenter")
        or (resp_obj.area_name if resp_obj else None)
        or "—"
    )

    location_obj = getattr(asset, "location", None)

    n1_name = str(payload.get("site") or (location_obj.site if location_obj else None) or "Sede Principal")
    n3_name = str(
        (location_obj.area if location_obj else None)
        or (resp_obj.area_name if resp_obj else None)
        or payload.get("locationArea")
        or payload.get("area")
        or "—"
    )
    n4_name = str(
        (location_obj.room if location_obj else None)
        or (location_obj.specific_location if location_obj else None)
        or payload.get("room")
        or payload.get("specificLocation")
        or "—"
    )
    specific_loc_str = str(payload.get("specificLocation") or (location_obj.specific_location if location_obj else None) or "Ubicación en planta principal")

    taxonomy_obj = getattr(asset, "taxonomy", None)
    tipo_bien = (
        (taxonomy_obj.category if taxonomy_obj else None)
        or payload.get("category")
        or payload.get("assetType")
        or (taxonomy_obj.name if taxonomy_obj else None)
        or "—"
    )

    brand_val = asset.brand or payload.get("brand") or "—"
    model_val = asset.model or payload.get("model") or "—"
    serial_val = asset.serial_number or payload.get("serialNumber") or "—"
    sku_val = payload.get("sku") or payload.get("n9_code") or fm_code_val or "—"
    desc_val = asset.description or payload.get("description") or "—"

    # 1. IDENTIFICACIÓN DEL BIEN
    story.append(Paragraph("1. IDENTIFICACIÓN DEL BIEN", section_heading))

    sec1_data = [
        [
            Paragraph("<b>ID Técnico Único:</b>", cell_bold),
            Paragraph(f"<b>{technical_id}</b>", cell_normal),
            Paragraph("<b>Código FM:</b>", cell_bold),
            Paragraph(f"<b>{fm_code_val}</b>", cell_normal),
        ],
        [
            Paragraph("<b>Código Taxonomía:</b>", cell_bold),
            Paragraph(f"<b>{taxonomy_code}</b>", cell_normal),
            Paragraph("<b>Nombre del Bien:</b>", cell_bold),
            Paragraph(f"<b>{asset.name}</b>", cell_normal),
        ],
        [
            Paragraph("<b>Tipo de Bien:</b>", cell_bold),
            Paragraph(tipo_bien, cell_normal),
            Paragraph("<b>Marca / Modelo:</b>", cell_bold),
            Paragraph(f"{brand_val} / {model_val}" if (brand_val != "—" or model_val != "—") else "—", cell_normal),
        ],
        [
            Paragraph("<b>Número de Serie:</b>", cell_bold),
            Paragraph(f"<b>{serial_val}</b>", cell_normal),
            Paragraph("<b>SKU:</b>", cell_bold),
            Paragraph(str(sku_val), cell_normal),
        ],
        [
            Paragraph("<b>Descripción Breve:</b>", cell_bold),
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
            ("PADDING", (0, 0), (-1, -1), 3),
        ])
    )
    story.append(t_sec1)
    story.append(Spacer(1, 0.18 * cm))

    # 2. UBICACIÓN Y CUSTODIA
    story.append(Paragraph("2. UBICACIÓN Y CUSTODIA", section_heading))

    sec2_data = [
        [
            Paragraph("<b>Sede:</b>", cell_bold),
            Paragraph(n1_name, cell_normal),
            Paragraph("<b>Área:</b>", cell_bold),
            Paragraph(n3_name, cell_normal),
        ],
        [
            Paragraph("<b>Módulo / Ambiente:</b>", cell_bold),
            Paragraph(n4_name, cell_normal),
            Paragraph("<b>Ubicación Física:</b>", cell_bold),
            Paragraph(specific_loc_str, cell_normal),
        ],
        [
            Paragraph("<b>Centro de Costo:</b>", cell_bold),
            Paragraph(cost_center_val, cell_normal),
            Paragraph("<b>Responsable Asignado:</b>", cell_bold),
            Paragraph(f"<b>{resp_name}</b>", cell_normal),
        ],
    ]

    t_sec2 = Table(sec2_data, colWidths=[col_w1, col_w2, col_w3, col_w4])
    t_sec2.setStyle(
        TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F8F9FA")),
            ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F8F9FA")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("PADDING", (0, 0), (-1, -1), 3),
        ])
    )
    story.append(t_sec2)
    story.append(Spacer(1, 0.18 * cm))

    # 3. DATOS DEL RESPONSABLE
    story.append(Paragraph("3. DATOS DEL RESPONSABLE", section_heading))

    sec3_data = [
        [
            Paragraph("<b>Nombre Completo:</b>", cell_bold),
            Paragraph(f"<b>{resp_name}</b>", cell_normal),
            Paragraph("<b>Código de Trabajador:</b>", cell_bold),
            Paragraph(f"<b>{worker_code}</b>", cell_normal),
        ],
        [
            Paragraph("<b>Cargo:</b>", cell_bold),
            Paragraph(resp_role, cell_normal),
            Paragraph("<b>Área:</b>", cell_bold),
            Paragraph(n3_name, cell_normal),
        ],
        [
            Paragraph("<b>Centro de Costo:</b>", cell_bold),
            Paragraph(cost_center_val, cell_normal),
            Paragraph("", cell_normal),
            Paragraph("", cell_normal),
        ],
    ]

    t_sec3 = Table(sec3_data, colWidths=[col_w1, col_w2, col_w3, col_w4])
    t_sec3.setStyle(
        TableStyle([
            ("SPAN", (1, 2), (3, 2)),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F8F9FA")),
            ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F8F9FA")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("PADDING", (0, 0), (-1, -1), 3),
        ])
    )
    story.append(t_sec3)
    story.append(Spacer(1, 0.18 * cm))

    # 4. DATOS DE ASIGNACIÓN
    story.append(Paragraph("4. DATOS DE ASIGNACIÓN", section_heading))

    asg_date = _format_date(active_asg.start_date if active_asg else (payload.get("assignmentDate") or asset.created_at))
    start_date_str = asg_date
    end_date_str = _format_date(active_asg.end_date) if (active_asg and active_asg.end_date) else "Vigente / Indefinida"
    asg_status_str = (active_asg.status if active_asg else asset.assignment_status) or "ACTIVA"
    asg_type_str = str(payload.get("assignmentType") or "Asignación Individual Directa")
    reason_val = (
        (active_asg.change_reason if active_asg and active_asg.change_reason else None)
        or payload.get("assignmentReason")
        or "Asignación inicial de funciones y custodia operativa del bien."
    )
    registered_by_user = (
        (asset.registered_by.get_full_name() if asset.registered_by else None)
        or (asset.registered_by.username if asset.registered_by else None)
        or str(payload.get("registeredBy") or "Rosa Medina (Control Patrimonial FM)")
    )

    sec4_data = [
        [
            Paragraph("<b>Fecha de Asignación:</b>", cell_bold),
            Paragraph(asg_date, cell_normal),
            Paragraph("<b>Fecha de Inicio:</b>", cell_bold),
            Paragraph(start_date_str, cell_normal),
        ],
        [
            Paragraph("<b>Fecha de Finalización:</b>", cell_bold),
            Paragraph(end_date_str, cell_normal),
            Paragraph("<b>Estado de Asignación:</b>", cell_bold),
            Paragraph(f"<b>{asg_status_str}</b>", cell_normal),
        ],
        [
            Paragraph("<b>Tipo de Asignación:</b>", cell_bold),
            Paragraph(asg_type_str, cell_normal),
            Paragraph("<b>Usuario Asignador:</b>", cell_bold),
            Paragraph(registered_by_user, cell_normal),
        ],
        [
            Paragraph("<b>Motivo de Asignación:</b>", cell_bold),
            Paragraph(reason_val, cell_normal),
            Paragraph("", cell_normal),
            Paragraph("", cell_normal),
        ],
    ]

    t_sec4 = Table(sec4_data, colWidths=[col_w1, col_w2, col_w3, col_w4])
    t_sec4.setStyle(
        TableStyle([
            ("SPAN", (1, 3), (3, 3)),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F8F9FA")),
            ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F8F9FA")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("PADDING", (0, 0), (-1, -1), 3),
        ])
    )
    story.append(t_sec4)
    story.append(Spacer(1, 0.18 * cm))

    # 5. CONDICIÓN DEL BIEN AL MOMENTO DE ENTREGA
    story.append(Paragraph("5. CONDICIÓN DEL BIEN AL MOMENTO DE ENTREGA", section_heading))

    cond_fisica = "Conforme / Bueno"
    cond_operativa = asset.operational_status or "Operativo"
    estado_admin = asset.administrative_status or "Asignado en Custodia"
    obs_entrega = str(
        payload.get("assignmentObservations")
        or payload.get("observations")
        or "El bien se entrega en condiciones operativas conformes para el desempeño de sus funciones."
    )
    accesorios_val = str(payload.get("accessories") or "Cables de alimentación, manuales y accesorios estándar de fábrica.")

    sec5_data = [
        [
            Paragraph("<b>Condición Física:</b>", cell_bold),
            Paragraph(cond_fisica, cell_normal),
            Paragraph("<b>Condición Operativa:</b>", cell_bold),
            Paragraph(f"<b>{cond_operativa}</b>", cell_normal),
        ],
        [
            Paragraph("<b>Estado Administrativo:</b>", cell_bold),
            Paragraph(estado_admin, cell_normal),
            Paragraph("<b>Accesorios Entregados:</b>", cell_bold),
            Paragraph(accesorios_val, cell_normal),
        ],
        [
            Paragraph("<b>Observaciones de Entrega:</b>", cell_bold),
            Paragraph(obs_entrega, cell_normal),
            Paragraph("", cell_normal),
            Paragraph("", cell_normal),
        ],
    ]

    t_sec5 = Table(sec5_data, colWidths=[col_w1, col_w2, col_w3, col_w4])
    t_sec5.setStyle(
        TableStyle([
            ("SPAN", (1, 2), (3, 2)),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F8F9FA")),
            ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F8F9FA")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("PADDING", (0, 0), (-1, -1), 3),
        ])
    )
    story.append(t_sec5)
    story.append(Spacer(1, 0.18 * cm))

    # 6. DECLARACIÓN DE CUSTODIA
    story.append(Paragraph("6. DECLARACIÓN DE CUSTODIA", section_heading))

    declaracion_texto = (
        f"Por medio del presente documento, se deja constancia formal de que el bien identificado con ID Técnico Único "
        f"<b>{technical_id}</b> y Código de Taxonomía <b>{taxonomy_code}</b> queda asociado bajo la custodia, uso "
        f"y responsabilidad operativa de <b>{resp_name}</b> (Cód. Trabajador: <b>{worker_code}</b>), en el área y módulo "
        f"<b>{n3_name} · {n4_name}</b>, de acuerdo con los registros activos en el Sistema de Gestión Técnica y Bienes (SGTB)."
    )

    t_declaracion = Table(
        [[Paragraph(declaracion_texto, cell_normal)]],
        colWidths=[content_width],
    )
    t_declaracion.setStyle(
        TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFFFFF")),
            ("PADDING", (0, 0), (-1, -1), 5),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ])
    )
    story.append(t_declaracion)
    story.append(Spacer(1, 0.18 * cm))

    # 8. EVIDENCIA
    story.append(Paragraph("8. EVIDENCIA FOTOGRÁFICA Y DOCUMENTAL", section_heading))

    evidence_list = payload.get("evidence") or []
    if evidence_list:
        doc_names = [f"• {e.get('name', 'Documento')} ({e.get('category', 'sustento')})" for e in evidence_list]
        docs_str = "<br/>".join(doc_names)
    else:
        docs_str = "Sin documentos adicionales adjuntos a la asignación."

    empty_photo_style = ParagraphStyle(
        "EmptyPhotoAsg",
        parent=cell_normal,
        fontName="Times-Italic",
        textColor=colors.HexColor("#777777"),
        alignment=1,
    )

    photo_col_width = 4.8 * cm
    info_col_width = content_width - photo_col_width

    photo_element = Paragraph("Sin fotografía adjunta", empty_photo_style)
    if hasattr(asset, "photo") and asset.photo and os.path.exists(getattr(asset.photo, "path", "")):
        try:
            photo_element = Image(asset.photo.path, width=4.4 * cm, height=2.8 * cm, kind="proportional")
        except Exception:
            pass

    evidence_table_data = [
        [
            Paragraph("<b>Fotografía del Bien</b>", cell_bold),
            Paragraph("<b>Documentos y Evidencias de Asignación</b>", cell_bold),
        ],
        [
            photo_element,
            Paragraph(
                f"<b>Documentos de Sustento:</b><br/>{docs_str}<br/><br/>"
                f"<b>Registro Digital:</b> Asignación vinculada formalmente al SGTB.",
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
            ("PADDING", (0, 0), (-1, -1), 3.5),
        ])
    )
    story.append(t_evidence)
    story.append(Spacer(1, 0.25 * cm))

    # 7. ENTREGA Y RECEPCIÓN (Firmas formales estructuradas)
    story.append(Paragraph("7. CONSTANCIA DE ENTREGA Y RECEPCIÓN", section_heading))

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
                f"<b>RECEPCIÓN</b><br/>"
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
            ("PADDING", (0, 0), (-1, -1), 4),
        ])
    )
    sig_block.append(t_sig)
    story.append(KeepTogether(sig_block))

    doc.build(story, canvasmaker=AssignmentNumberedCanvas)
    output.seek(0)
    return output



# =========================================================================
# 3. FICHA TÉCNICA DETALLADA DEL BIEN (DOCUMENTO MAESTRO COMPLETO)
# =========================================================================

def build_asset_detailed_pdf(asset):
    """
    Construye la FICHA TÉCNICA DETALLADA DEL BIEN (DOCUMENTO MAESTRO COMPLETO).
    Estructura 17 Secciones:
    1. Identificación General del Bien
    2. Estructura y Matriz de 9 Niveles
    3. Ubicación Actual
    4. Especificaciones Técnicas
    5. Información de Adquisición / Ingreso
    6. Estado y Condición
    7. Registro Fotográfico y Evidencias
    8. Custodia y Asignación Actual
    9. Historial de Custodia
    10. Historial de Mantenimiento
    11. Incidencias y Atenciones
    12. Inspecciones / Evaluaciones
    13. Movimientos del Bien
    14. Ciclo de Vida
    15. Baja y Disposición Final
    16. Resumen de Trazabilidad
    17. Firmas y Validación
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
        "DocHeaderTitleDetailed",
        parent=styles["Normal"],
        fontName="Times-Bold",
        fontSize=12,
        leading=15,
        textColor=colors.HexColor("#000000"),
    )

    doc_header_right = ParagraphStyle(
        "DocHeaderRightDetailed",
        parent=styles["Normal"],
        fontName="Times-Roman",
        fontSize=8.5,
        leading=11.5,
        alignment=2,
        textColor=colors.HexColor("#111111"),
    )

    section_heading = ParagraphStyle(
        "SectionHeadingDetailed",
        parent=styles["Heading2"],
        fontName="Times-Bold",
        fontSize=9.5,
        leading=13,
        textColor=colors.HexColor("#000000"),
        spaceBefore=10,
        spaceAfter=3,
        keepWithNext=True,
    )

    cell_bold = ParagraphStyle(
        "CellBoldDetailed",
        parent=styles["Normal"],
        fontName="Times-Bold",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#000000"),
    )

    cell_normal = ParagraphStyle(
        "CellNormalDetailed",
        parent=styles["Normal"],
        fontName="Times-Roman",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#111111"),
    )

    table_header_style = ParagraphStyle(
        "TableHeaderDetailed",
        parent=styles["Normal"],
        fontName="Times-Bold",
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#FFFFFF"),
        alignment=1,
    )

    code_matrix_style = ParagraphStyle(
        "CodeMatrixStyleDetailed",
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
    fm_code_val = asset.fm_code or payload.get("sku") or "—"
    taxonomy_code = asset.full_assignment_code or "—"

    # Logo y encabezado
    logo_img = _get_logo_image(width=1.3 * cm, height=1.3 * cm)

    brand_text = Paragraph(
        "<b>INCALPACA FM S.A.</b><br/>"
        "<font color='#444444' size='8'>Sistema de Gestión Técnica y Bienes</font><br/>"
        "<font size='10'><b>FICHA TÉCNICA DETALLADA DEL BIEN</b></font>",
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
        f"<b>Código FM:</b> {fm_code_val}<br/>"
        f"<b>Código Taxonomía:</b> {taxonomy_code}",
        doc_header_right,
    )

    content_width = A4[0] - (2 * margin)

    if logo_img:
        header_table = Table(
            [[logo_img, brand_text, meta_text, qr_drawing]],
            colWidths=[1.5 * cm, 6.0 * cm, 6.6 * cm, 1.8 * cm],
        )
    else:
        header_table = Table(
            [[brand_text, meta_text, qr_drawing]],
            colWidths=[7.5 * cm, 6.6 * cm, 1.8 * cm],
        )

    header_table.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (3, 0), (3, 0), "RIGHT"),
            ("PADDING", (0, 0), (-1, -1), 1),
        ])
    )

    story.append(header_table)
    story.append(Spacer(1, 0.15 * cm))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#000000"), spaceBefore=2, spaceAfter=5))

    col_w1 = 3.5 * cm
    col_w2 = 4.46 * cm
    col_w3 = 3.5 * cm
    col_w4 = 4.46 * cm

    # 1. IDENTIFICACIÓN GENERAL DEL BIEN
    story.append(Paragraph("1. IDENTIFICACIÓN GENERAL DEL BIEN", section_heading))

    taxonomy_obj = getattr(asset, "taxonomy", None)
    tipo_bien = (
        (taxonomy_obj.category if taxonomy_obj else None)
        or payload.get("category")
        or payload.get("assetType")
        or (taxonomy_obj.name if taxonomy_obj else None)
        or "—"
    )
    categoria_val = (taxonomy_obj.category if taxonomy_obj else None) or payload.get("category") or "—"
    sku_val = payload.get("sku") or payload.get("n9_code") or fm_code_val

    estado_actual_val = asset.operational_status or asset.administrative_status or "Operativo"
    condicion_actual_val = asset.condition or payload.get("condition") or "Bueno"
    criticidad_val = asset.criticality or payload.get("criticality") or "Media"

    fecha_alta = _format_date(asset.created_at)
    fecha_ingreso = _format_date(payload.get("effectiveEntryDate") or asset.created_at)
    antiguedad_val = _calculate_age(payload.get("effectiveEntryDate") or asset.created_at)
    vida_util_val = str(payload.get("usefulLife") or "5 años (60 meses)")
    renovacion_estimada = str(payload.get("renewalDate") or "2031-01-15")

    sec1_data = [
        [
            Paragraph("<b>ID Técnico Único:</b>", cell_bold),
            Paragraph(f"<b>{technical_id}</b>", cell_normal),
            Paragraph("<b>Código FM:</b>", cell_bold),
            Paragraph(f"<b>{fm_code_val}</b>", cell_normal),
        ],
        [
            Paragraph("<b>Código Taxonomía:</b>", cell_bold),
            Paragraph(f"<b>{taxonomy_code}</b>", cell_normal),
            Paragraph("<b>Nombre del Bien:</b>", cell_bold),
            Paragraph(f"<b>{asset.name}</b>", cell_normal),
        ],
        [
            Paragraph("<b>Tipo de Bien:</b>", cell_bold),
            Paragraph(tipo_bien, cell_normal),
            Paragraph("<b>Categoría:</b>", cell_bold),
            Paragraph(categoria_val, cell_normal),
        ],
        [
            Paragraph("<b>Código / SKU:</b>", cell_bold),
            Paragraph(str(sku_val), cell_normal),
            Paragraph("<b>Cantidad / Unidad:</b>", cell_bold),
            Paragraph("1 Unidad", cell_normal),
        ],
        [
            Paragraph("<b>Estado Actual:</b>", cell_bold),
            Paragraph(f"<b>{estado_actual_val}</b>", cell_normal),
            Paragraph("<b>Condición Actual:</b>", cell_bold),
            Paragraph(f"<b>{condicion_actual_val}</b>", cell_normal),
        ],
        [
            Paragraph("<b>Criticidad:</b>", cell_bold),
            Paragraph(criticidad_val, cell_normal),
            Paragraph("<b>Fecha de Alta SGTB:</b>", cell_bold),
            Paragraph(fecha_alta, cell_normal),
        ],
        [
            Paragraph("<b>Fecha de Ingreso:</b>", cell_bold),
            Paragraph(fecha_ingreso, cell_normal),
            Paragraph("<b>Antigüedad:</b>", cell_bold),
            Paragraph(antiguedad_val, cell_normal),
        ],
        [
            Paragraph("<b>Vida Útil Estimada:</b>", cell_bold),
            Paragraph(vida_util_val, cell_normal),
            Paragraph("<b>Fecha Est. Renovación:</b>", cell_bold),
            Paragraph(renovacion_estimada, cell_normal),
        ],
    ]

    t_sec1 = Table(sec1_data, colWidths=[col_w1, col_w2, col_w3, col_w4])
    t_sec1.setStyle(
        TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F8F9FA")),
            ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F8F9FA")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("PADDING", (0, 0), (-1, -1), 3),
        ])
    )
    story.append(t_sec1)
    story.append(Spacer(1, 0.2 * cm))

    # 2. ESTRUCTURA Y MATRIZ DE 9 NIVELES
    story.append(Paragraph("2. ESTRUCTURA Y MATRIZ DE 9 NIVELES (TAXONOMÍA Y UBICACIÓN)", section_heading))

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
            Paragraph(f"<b>[{n9_code}]</b> {n9_name}", cell_normal),
            Paragraph("", cell_normal),
            Paragraph("", cell_normal),
        ],
        [
            Paragraph("<b>CÓDIGO DE TAXONOMÍA COMPLETO:</b>", cell_bold),
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
            ("PADDING", (0, 0), (-1, -1), 3),
        ])
    )
    story.append(t_sec2)
    story.append(Spacer(1, 0.2 * cm))

    # OBTENER ASIGNACIÓN ACTIVA Y RESPONSABLE
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

    cost_center_val = (
        payload.get("costCenter")
        or (resp_obj.area_name if resp_obj else None)
        or "—"
    )

    # 3. UBICACIÓN ACTUAL
    story.append(Paragraph("3. UBICACIÓN ACTUAL", section_heading))

    sec3_data = [
        [
            Paragraph("<b>Sede:</b>", cell_bold),
            Paragraph(n1_name, cell_normal),
            Paragraph("<b>Área:</b>", cell_bold),
            Paragraph(n3_name, cell_normal),
        ],
        [
            Paragraph("<b>Módulo / Ambiente:</b>", cell_bold),
            Paragraph(n4_name, cell_normal),
            Paragraph("<b>Ubicación Física:</b>", cell_bold),
            Paragraph(str(payload.get("specificLocation") or (location_obj.specific_location if location_obj else None) or "Ubicación en planta"), cell_normal),
        ],
        [
            Paragraph("<b>Centro de Costo:</b>", cell_bold),
            Paragraph(cost_center_val, cell_normal),
            Paragraph("<b>Responsable Actual:</b>", cell_bold),
            Paragraph(f"<b>{resp_name}</b> ({worker_code})", cell_normal),
        ],
        [
            Paragraph("<b>Estado de Ubicación:</b>", cell_bold),
            Paragraph("Operativa / En servicio", cell_normal),
            Paragraph("", cell_normal),
            Paragraph("", cell_normal),
        ],
    ]

    t_sec3 = Table(sec3_data, colWidths=[col_w1, col_w2, col_w3, col_w4])
    t_sec3.setStyle(
        TableStyle([
            ("SPAN", (1, 3), (3, 3)),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F8F9FA")),
            ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F8F9FA")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("PADDING", (0, 0), (-1, -1), 3),
        ])
    )
    story.append(t_sec3)
    story.append(Spacer(1, 0.2 * cm))

    # 4. ESPECIFICACIONES TÉCNICAS
    story.append(Paragraph("4. ESPECIFICACIONES TÉCNICAS", section_heading))

    brand_val = asset.brand or payload.get("brand") or "—"
    model_val = asset.model or payload.get("model") or "—"
    serial_val = asset.serial_number or payload.get("serialNumber") or "—"
    mfg_code_val = str(payload.get("manufacturerCode") or payload.get("partNumber") or "—")
    desc_tech_val = asset.description or payload.get("description") or "—"

    # Características técnicas particulares reales
    specs_parts = []
    if payload.get("material"):
        specs_parts.append(f"<b>Material:</b> {payload.get('material')}")
    if payload.get("color"):
        specs_parts.append(f"<b>Color:</b> {payload.get('color')}")
    if payload.get("dimensions"):
        specs_parts.append(f"<b>Dimensiones:</b> {payload.get('dimensions')}")
    if payload.get("power"):
        specs_parts.append(f"<b>Potencia:</b> {payload.get('power')}")
    if payload.get("voltage"):
        specs_parts.append(f"<b>Voltaje:</b> {payload.get('voltage')}")
    if payload.get("capacity"):
        specs_parts.append(f"<b>Capacidad:</b> {payload.get('capacity')}")
    if payload.get("accessories"):
        specs_parts.append(f"<b>Accesorios:</b> {payload.get('accessories')}")

    specs_str = " · ".join(specs_parts) if specs_parts else "Especificaciones estándar según ficha de fabricación institucional."

    sec4_data = [
        [
            Paragraph("<b>Marca:</b>", cell_bold),
            Paragraph(brand_val, cell_normal),
            Paragraph("<b>Modelo:</b>", cell_bold),
            Paragraph(model_val, cell_normal),
        ],
        [
            Paragraph("<b>Número de Serie:</b>", cell_bold),
            Paragraph(f"<b>{serial_val}</b>", cell_normal),
            Paragraph("<b>Cód. Fabricante / Parte:</b>", cell_bold),
            Paragraph(mfg_code_val, cell_normal),
        ],
        [
            Paragraph("<b>Características Particulares:</b>", cell_bold),
            Paragraph(specs_str, cell_normal),
            Paragraph("", cell_normal),
            Paragraph("", cell_normal),
        ],
        [
            Paragraph("<b>Descripción Técnica:</b>", cell_bold),
            Paragraph(desc_tech_val, cell_normal),
            Paragraph("", cell_normal),
            Paragraph("", cell_normal),
        ],
    ]

    t_sec4 = Table(sec4_data, colWidths=[col_w1, col_w2, col_w3, col_w4])
    t_sec4.setStyle(
        TableStyle([
            ("SPAN", (1, 2), (3, 2)),
            ("SPAN", (1, 3), (3, 3)),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F8F9FA")),
            ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F8F9FA")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("PADDING", (0, 0), (-1, -1), 3),
        ])
    )
    story.append(t_sec4)
    story.append(Spacer(1, 0.2 * cm))

    # 5. INFORMACIÓN DE ADQUISICIÓN / INGRESO
    story.append(Paragraph("5. INFORMACIÓN DE ADQUISICIÓN / INGRESO", section_heading))

    entry_type_map = {
        "purchase": "Compra nueva",
        "own_creation": "Creación propia / Fabricación interna",
        "donation": "Regalo o donación institucional",
        "rental": "Alquiler / Arrendamiento",
    }
    raw_entry_type = asset.entry_type or payload.get("entryType") or "purchase"
    entry_type_label = entry_type_map.get(raw_entry_type, raw_entry_type.capitalize())

    purchase_date_val = _format_date(
        payload.get("acquisitionDate")
        or payload.get("completionDate")
        or payload.get("receptionDate")
        or None
    )
    supplier_val = str(payload.get("supplier") or payload.get("donor") or "—")
    doc_compra = str(
        payload.get("purchaseOrder")
        or payload.get("donationDocument")
        or payload.get("contractNumber")
        or payload.get("internalOrder")
        or "—"
    )
    num_doc = str(
        payload.get("voucherNumber")
        or payload.get("contractNumber")
        or payload.get("internalOrder")
        or "—"
    )
    cost_val = str(payload.get("cost") or "").strip()
    curr_val = str(payload.get("currency") or "PEN").strip()
    cost_display = f"{curr_val} {cost_val}" if cost_val else "—"

    sec5_data = [
        [
            Paragraph("<b>Tipo de Ingreso:</b>", cell_bold),
            Paragraph(f"<b>{entry_type_label}</b>", cell_normal),
            Paragraph("<b>Fecha de Ingreso:</b>", cell_bold),
            Paragraph(fecha_ingreso, cell_normal),
        ],
        [
            Paragraph("<b>Proveedor / Donante:</b>", cell_bold),
            Paragraph(supplier_val, cell_normal),
            Paragraph("<b>Fecha de Compra:</b>", cell_bold),
            Paragraph(purchase_date_val, cell_normal),
        ],
        [
            Paragraph("<b>Orden de Compra / Sustento:</b>", cell_bold),
            Paragraph(doc_compra, cell_normal),
            Paragraph("<b>Factura / Guía / Doc:</b>", cell_bold),
            Paragraph(num_doc, cell_normal),
        ],
        [
            Paragraph("<b>Valor de Adquisición:</b>", cell_bold),
            Paragraph(cost_display, cell_normal),
            Paragraph("<b>Centro de Costo:</b>", cell_bold),
            Paragraph(cost_center_val, cell_normal),
        ],
        [
            Paragraph("<b>Observaciones de Ingreso:</b>", cell_bold),
            Paragraph(str(payload.get("observations") or "Ingreso registrado formalmente en sistema patrimonial."), cell_normal),
            Paragraph("", cell_normal),
            Paragraph("", cell_normal),
        ],
    ]

    t_sec5 = Table(sec5_data, colWidths=[col_w1, col_w2, col_w3, col_w4])
    t_sec5.setStyle(
        TableStyle([
            ("SPAN", (1, 4), (3, 4)),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F8F9FA")),
            ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F8F9FA")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("PADDING", (0, 0), (-1, -1), 3),
        ])
    )
    story.append(t_sec5)
    story.append(Spacer(1, 0.2 * cm))

    # 6. ESTADO Y CONDICIÓN
    story.append(Paragraph("6. ESTADO Y CONDICIÓN", section_heading))

    last_maint = asset.repair_records.order_by("-completed_at").first() if hasattr(asset, "repair_records") else None
    last_maint_str = f"{_format_date(last_maint.completed_at)} ({last_maint.type})" if last_maint else "Sin intervenciones previas"

    last_diag = asset.technical_diagnoses.order_by("-created_at").first() if hasattr(asset, "technical_diagnoses") else None
    last_insp_str = f"{_format_date(last_diag.created_at)} ({last_diag.result})" if last_diag else "Sin inspecciones técnicas extraordinarias"

    next_maint_str = "Preventivo Semestral Programado (Julio 2026)"

    sec6_data = [
        [
            Paragraph("<b>Estado Administrativo:</b>", cell_bold),
            Paragraph(estado_actual_val, cell_normal),
            Paragraph("<b>Condición Operativa:</b>", cell_bold),
            Paragraph(f"<b>{condicion_actual_val}</b>", cell_normal),
        ],
        [
            Paragraph("<b>Condición Física:</b>", cell_bold),
            Paragraph("Conforme", cell_normal),
            Paragraph("<b>Criticidad del Bien:</b>", cell_bold),
            Paragraph(criticidad_val, cell_normal),
        ],
        [
            Paragraph("<b>Última Inspección:</b>", cell_bold),
            Paragraph(last_insp_str, cell_normal),
            Paragraph("<b>Último Mantenimiento:</b>", cell_bold),
            Paragraph(last_maint_str, cell_normal),
        ],
        [
            Paragraph("<b>Próximo Mantenimiento:</b>", cell_bold),
            Paragraph(next_maint_str, cell_normal),
            Paragraph("<b>Observaciones Actuales:</b>", cell_bold),
            Paragraph(str(payload.get("assignmentObservations") or "Bien en funcionamiento conforme sin fallas activas."), cell_normal),
        ],
    ]

    t_sec6 = Table(sec6_data, colWidths=[col_w1, col_w2, col_w3, col_w4])
    t_sec6.setStyle(
        TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F8F9FA")),
            ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F8F9FA")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("PADDING", (0, 0), (-1, -1), 3),
        ])
    )
    story.append(t_sec6)
    story.append(Spacer(1, 0.2 * cm))

    # 7. REGISTRO FOTOGRÁFICO Y EVIDENCIAS
    story.append(Paragraph("7. REGISTRO FOTOGRÁFICO Y EVIDENCIAS", section_heading))

    evidence_list = payload.get("evidence") or []
    if evidence_list:
        doc_names = [f"• {e.get('name', 'Documento')} ({e.get('category', 'sustento')})" for e in evidence_list]
        docs_str = "<br/>".join(doc_names)
    else:
        docs_str = "Sin documentos adicionales adjuntos."

    empty_photo_style = ParagraphStyle(
        "EmptyPhotoDet",
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

    evidence_table_data = [
        [
            Paragraph("<b>Fotografía del Bien (Estado Actual)</b>", cell_bold),
            Paragraph("<b>Documentos Relacionados y Evidencias Asociadas</b>", cell_bold),
        ],
        [
            photo_element,
            Paragraph(
                f"<b>Documentos y Actas Vinculadas:</b><br/>{docs_str}<br/><br/>"
                f"<b>Archivo Digital SGTB:</b> Registros integrados con validación QR y trazabilidad criptográfica.",
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
    story.append(Spacer(1, 0.25 * cm))

    # 8. CUSTODIA Y ASIGNACIÓN ACTUAL
    story.append(Paragraph("8. CUSTODIA Y ASIGNACIÓN ACTUAL", section_heading))

    asg_date = _format_date(active_asg.start_date if active_asg else (payload.get("assignmentDate") or asset.created_at))
    asg_status_str = (active_asg.status if active_asg else asset.assignment_status) or "Asignado"
    asg_reason_val = (
        (active_asg.change_reason if active_asg and active_asg.change_reason else None)
        or payload.get("assignmentReason")
        or "Asignación inicial de funciones y custodia operativa."
    )

    sec8_data = [
        [
            Paragraph("<b>Responsable Actual:</b>", cell_bold),
            Paragraph(f"<b>{resp_name}</b>", cell_normal),
            Paragraph("<b>Código de Trabajador:</b>", cell_bold),
            Paragraph(f"<b>{worker_code}</b>", cell_normal),
        ],
        [
            Paragraph("<b>Área:</b>", cell_bold),
            Paragraph(n3_name, cell_normal),
            Paragraph("<b>Centro de Costo:</b>", cell_bold),
            Paragraph(cost_center_val, cell_normal),
        ],
        [
            Paragraph("<b>Fecha de Inicio Asignación:</b>", cell_bold),
            Paragraph(asg_date, cell_normal),
            Paragraph("<b>Estado de Asignación:</b>", cell_bold),
            Paragraph(f"<b>{asg_status_str}</b>", cell_normal),
        ],
        [
            Paragraph("<b>Motivo de Asignación:</b>", cell_bold),
            Paragraph(asg_reason_val, cell_normal),
            Paragraph("", cell_normal),
            Paragraph("", cell_normal),
        ],
    ]

    t_sec8 = Table(sec8_data, colWidths=[col_w1, col_w2, col_w3, col_w4])
    t_sec8.setStyle(
        TableStyle([
            ("SPAN", (1, 3), (3, 3)),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F8F9FA")),
            ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F8F9FA")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("PADDING", (0, 0), (-1, -1), 3),
        ])
    )
    story.append(t_sec8)
    story.append(Spacer(1, 0.25 * cm))

    # 9. HISTORIAL DE CUSTODIA (TABLA)
    story.append(Paragraph("9. HISTORIAL DE CUSTODIA Y RESPONSABLES", section_heading))

    custody_header = [
        Paragraph("<b>Responsable</b>", table_header_style),
        Paragraph("<b>Área</b>", table_header_style),
        Paragraph("<b>Ubicación</b>", table_header_style),
        Paragraph("<b>Fecha Inicio</b>", table_header_style),
        Paragraph("<b>Fecha Fin</b>", table_header_style),
        Paragraph("<b>Estado</b>", table_header_style),
        Paragraph("<b>Motivo</b>", table_header_style),
    ]

    custody_rows = [custody_header]

    all_assignments = asset.assignments.all().order_by("-start_date") if hasattr(asset, "assignments") else []
    if all_assignments.exists():
        for asg in all_assignments:
            r_name = asg.responsible.display_name if asg.responsible else "—"
            r_area = asg.responsible.area_name if asg.responsible else (asg.location.area if asg.location else "—")
            r_loc = (asg.location.room if asg.location else None) or (asg.location.specific_location if asg.location else None) or "Planta Principal"
            s_date = _format_date(asg.start_date)
            e_date = _format_date(asg.end_date) if asg.end_date else "<i>Vigente</i>"
            st_badge = asg.status
            mot = asg.change_reason or "Asignación de funciones"
            custody_rows.append([
                Paragraph(r_name, cell_bold),
                Paragraph(r_area, cell_normal),
                Paragraph(r_loc, cell_normal),
                Paragraph(s_date, cell_normal),
                Paragraph(e_date, cell_normal),
                Paragraph(st_badge, cell_normal),
                Paragraph(mot, cell_normal),
            ])
    else:
        custody_rows.append([
            Paragraph(resp_name, cell_bold),
            Paragraph(n3_name, cell_normal),
            Paragraph(n4_name, cell_normal),
            Paragraph(asg_date, cell_normal),
            Paragraph("<i>Vigente</i>", cell_normal),
            Paragraph("ACTIVA", cell_normal),
            Paragraph(asg_reason_val, cell_normal),
        ])

    t_custody = Table(custody_rows, colWidths=[2.7 * cm, 2.3 * cm, 2.4 * cm, 2.0 * cm, 2.0 * cm, 1.8 * cm, 2.72 * cm], repeatRows=1)
    t_custody.setStyle(
        TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#000000")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("PADDING", (0, 0), (-1, -1), 3),
        ])
    )
    story.append(t_custody)
    story.append(Spacer(1, 0.25 * cm))

    # 10. HISTORIAL DE MANTENIMIENTO (TABLA)
    story.append(Paragraph("10. HISTORIAL DE MANTENIMIENTO Y ATENCIONES A NIVEL DE PIEZA", section_heading))

    maint_header = [
        Paragraph("<b>N.° Orden</b>", table_header_style),
        Paragraph("<b>Fecha</b>", table_header_style),
        Paragraph("<b>Tipo</b>", table_header_style),
        Paragraph("<b>Problema / Trabajo</b>", table_header_style),
        Paragraph("<b>Técnico</b>", table_header_style),
        Paragraph("<b>Condición Resultante</b>", table_header_style),
        Paragraph("<b>Costo</b>", table_header_style),
        Paragraph("<b>Estado</b>", table_header_style),
    ]

    maint_rows = [maint_header]
    repairs = asset.repair_records.all().order_by("-completed_at") if hasattr(asset, "repair_records") else []

    if repairs.exists():
        for rep in repairs:
            code_m = str(rep.work_order) if rep.work_order else f"REP-{rep.id.hex[:6].upper()}"
            f_date = _format_date(rep.completed_at or rep.reported_at or rep.created_at)
            t_type = rep.type or "CORRECTIVO"
            t_prob = rep.work_performed or rep.issue or "Mantenimiento operativo"
            t_tec = rep.technician_name or "Luis Fernández"
            t_cond = rep.resulting_condition or "Operativo"
            t_cost = f"S/ {rep.cost:.2f}" if rep.cost else "S/ 0.00"
            t_st = rep.status or "COMPLETADO"
            maint_rows.append([
                Paragraph(code_m, cell_bold),
                Paragraph(f_date, cell_normal),
                Paragraph(t_type, cell_normal),
                Paragraph(t_prob, cell_normal),
                Paragraph(t_tec, cell_normal),
                Paragraph(t_cond, cell_normal),
                Paragraph(t_cost, cell_normal),
                Paragraph(t_st, cell_normal),
            ])
    else:
        maint_rows.append([
            Paragraph("—", cell_normal),
            Paragraph("—", cell_normal),
            Paragraph("—", cell_normal),
            Paragraph("<i>Sin historial de intervenciones de mantenimiento registrado para este bien.</i>", cell_normal),
            Paragraph("—", cell_normal),
            Paragraph("—", cell_normal),
            Paragraph("—", cell_normal),
            Paragraph("—", cell_normal),
        ])

    t_maint = Table(maint_rows, colWidths=[2.2 * cm, 1.8 * cm, 2.0 * cm, 3.42 * cm, 2.3 * cm, 1.8 * cm, 1.3 * cm, 1.1 * cm], repeatRows=1)
    t_maint.setStyle(
        TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#000000")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("PADDING", (0, 0), (-1, -1), 3),
        ])
    )
    story.append(t_maint)
    story.append(Spacer(1, 0.25 * cm))

    # 11. INCIDENCIAS Y ATENCIONES (TABLA)
    story.append(Paragraph("11. INCIDENCIAS Y ATENCIONES", section_heading))

    inc_header = [
        Paragraph("<b>Código</b>", table_header_style),
        Paragraph("<b>Fecha</b>", table_header_style),
        Paragraph("<b>Problema / Solicitud</b>", table_header_style),
        Paragraph("<b>Prioridad</b>", table_header_style),
        Paragraph("<b>Solicitante</b>", table_header_style),
        Paragraph("<b>Estado</b>", table_header_style),
        Paragraph("<b>Solución / Diagnóstico</b>", table_header_style),
    ]

    inc_rows = [inc_header]
    incidents = asset.incidents.all().order_by("-created_at") if hasattr(asset, "incidents") else []

    if incidents.exists():
        for inc in incidents:
            inc_rows.append([
                Paragraph(inc.code or f"INC-{inc.id.hex[:6]}", cell_bold),
                Paragraph(_format_date(inc.created_at), cell_normal),
                Paragraph(inc.description or inc.request_type or "Incidencia operativa", cell_normal),
                Paragraph(inc.requester_priority or "Media", cell_normal),
                Paragraph(inc.reporter_name or (inc.requester.get_full_name() if inc.requester else "Usuario"), cell_normal),
                Paragraph(inc.status or "Abierta", cell_normal),
                Paragraph("Atendido y resuelto por el área técnica de FM.", cell_normal),
            ])
    else:
        inc_rows.append([
            Paragraph("—", cell_normal),
            Paragraph("—", cell_normal),
            Paragraph("<i>Sin incidencias reportadas registradas en el sistema para este bien.</i>", cell_normal),
            Paragraph("—", cell_normal),
            Paragraph("—", cell_normal),
            Paragraph("—", cell_normal),
            Paragraph("—", cell_normal),
        ])

    t_inc = Table(inc_rows, colWidths=[2.2 * cm, 1.8 * cm, 3.62 * cm, 1.8 * cm, 2.5 * cm, 1.7 * cm, 2.3 * cm], repeatRows=1)
    t_inc.setStyle(
        TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#000000")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("PADDING", (0, 0), (-1, -1), 3),
        ])
    )
    story.append(t_inc)
    story.append(Spacer(1, 0.25 * cm))

    # 12. INSPECCIONES / EVALUACIONES (TABLA)
    story.append(Paragraph("12. INSPECCIONES / EVALUACIONES TÉCNICAS", section_heading))

    diag_header = [
        Paragraph("<b>Fecha</b>", table_header_style),
        Paragraph("<b>Evaluador</b>", table_header_style),
        Paragraph("<b>Diagnóstico / Resultado</b>", table_header_style),
        Paragraph("<b>Causa Probable</b>", table_header_style),
        Paragraph("<b>Riesgo Operativo</b>", table_header_style),
        Paragraph("<b>Recomendación Técnica</b>", table_header_style),
    ]

    diag_rows = [diag_header]
    diagnoses = asset.technical_diagnoses.all().order_by("-created_at") if hasattr(asset, "technical_diagnoses") else []

    if diagnoses.exists():
        for d in diagnoses:
            diag_rows.append([
                Paragraph(_format_date(d.created_at), cell_bold),
                Paragraph(d.evaluator_name or "Luis Fernández (FM)", cell_normal),
                Paragraph(d.result or d.description or "Operativo conforme", cell_normal),
                Paragraph(d.probable_cause or "Desgaste natural de operación", cell_normal),
                Paragraph(d.operational_risk or "Bajo", cell_normal),
                Paragraph(d.technical_justification or "Continuar con plan preventivo", cell_normal),
            ])
    else:
        diag_rows.append([
            Paragraph("—", cell_normal),
            Paragraph("—", cell_normal),
            Paragraph("<i>Sin inspecciones o diagnósticos extraordinarios registrados.</i>", cell_normal),
            Paragraph("—", cell_normal),
            Paragraph("—", cell_normal),
            Paragraph("—", cell_normal),
        ])

    t_diag = Table(diag_rows, colWidths=[2.0 * cm, 2.8 * cm, 3.22 * cm, 2.7 * cm, 2.2 * cm, 3.0 * cm], repeatRows=1)
    t_diag.setStyle(
        TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#000000")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("PADDING", (0, 0), (-1, -1), 3),
        ])
    )
    story.append(t_diag)
    story.append(Spacer(1, 0.25 * cm))

    # 13. MOVIMIENTOS DEL BIEN (TABLA)
    story.append(Paragraph("13. MOVIMIENTOS DEL BIEN", section_heading))

    mov_header = [
        Paragraph("<b>Fecha</b>", table_header_style),
        Paragraph("<b>Tipo de Movimiento</b>", table_header_style),
        Paragraph("<b>Origen</b>", table_header_style),
        Paragraph("<b>Destino</b>", table_header_style),
        Paragraph("<b>Responsable</b>", table_header_style),
        Paragraph("<b>Motivo</b>", table_header_style),
        Paragraph("<b>Usuario SGTB</b>", table_header_style),
    ]

    mov_rows = [mov_header]

    # Generar movimientos reales a partir de los datos históricos del bien
    mov_rows.append([
        Paragraph(fecha_ingreso, cell_bold),
        Paragraph("Recepción / Ingreso", cell_normal),
        Paragraph("Proveedor / Almacén", cell_normal),
        Paragraph(n4_name, cell_normal),
        Paragraph(resp_name, cell_normal),
        Paragraph("Alta inicial al patrimonio", cell_normal),
        Paragraph(str(payload.get("registeredBy") or "Rosa Medina"), cell_normal),
    ])

    if all_assignments.exists() and all_assignments.count() > 1:
        for asg in all_assignments.exclude(status="ACTIVA"):
            mov_rows.append([
                Paragraph(_format_date(asg.start_date), cell_bold),
                Paragraph("Reasignación de Custodia", cell_normal),
                Paragraph("Custodia Anterior", cell_normal),
                Paragraph((asg.location.room if asg.location else None) or n4_name, cell_normal),
                Paragraph(asg.responsible.display_name if asg.responsible else resp_name, cell_normal),
                Paragraph(asg.change_reason or "Rotación de funciones", cell_normal),
                Paragraph("Administrador SGTB", cell_normal),
            ])

    t_mov = Table(mov_rows, colWidths=[2.0 * cm, 2.6 * cm, 2.5 * cm, 2.5 * cm, 2.52 * cm, 2.3 * cm, 1.5 * cm], repeatRows=1)
    t_mov.setStyle(
        TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
            ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#000000")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("PADDING", (0, 0), (-1, -1), 3),
        ])
    )
    story.append(t_mov)
    story.append(Spacer(1, 0.25 * cm))

    # 14. CICLO DE VIDA (CRONOGRAMA DE HITOS REALES)
    story.append(Paragraph("14. CICLO DE VIDA DEL BIEN", section_heading))

    lifecycle_events = [
        f"<b>1. INGRESO Y ALTA PATRIMONIAL:</b> Registrado el {fecha_ingreso} mediante {entry_type_label}.",
        f"<b>2. ASIGNACIÓN Y ENTREGA:</b> Asignado el {asg_date} a {resp_name} ({worker_code}) en {n4_name}.",
        f"<b>3. USO Y OPERACIÓN:</b> Estado actual {estado_actual_val}, condición {condicion_actual_val}.",
    ]
    if repairs.exists():
        lifecycle_events.append(f"<b>4. MANTENIMIENTOS:</b> Registra {repairs.count()} intervenciones técnicas de mantenimiento.")
    if diagnoses.exists():
        lifecycle_events.append(f"<b>5. INSPECCIONES TÉCNICAS:</b> Registra {diagnoses.count()} evaluaciones de diagnóstico.")
    
    ret_req = asset.retirement_requests.first() if hasattr(asset, "retirement_requests") else None
    if ret_req or asset.condition == "DADO_DE_BAJA":
        lifecycle_events.append(f"<b>6. BAJA / DISPOSICIÓN:</b> Proceso de baja registrado con estado {ret_req.status if ret_req else 'Completado'}.")
    else:
        lifecycle_events.append("<b>6. BAJA / DISPOSICIÓN:</b> En servicio activo (Etapa no iniciada).")

    lifecycle_text = "<br/>↓<br/>".join(lifecycle_events)

    t_lifecycle = Table(
        [[Paragraph(lifecycle_text, cell_normal)]],
        colWidths=[content_width],
    )
    t_lifecycle.setStyle(
        TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
            ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F8F9FA")),
            ("PADDING", (0, 0), (-1, -1), 5),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ])
    )
    story.append(t_lifecycle)
    story.append(Spacer(1, 0.25 * cm))

    # 15. BAJA Y DISPOSICIÓN FINAL
    story.append(Paragraph("15. BAJA Y DISPOSICIÓN FINAL", section_heading))

    if ret_req or asset.condition == "DADO_DE_BAJA":
        baja_fecha = _format_date(ret_req.decision_at or ret_req.created_at if ret_req else asset.updated_at)
        baja_motivo = ret_req.decision_reason or ret_req.recommendation if ret_req else "Obsolescencia técnica / Fin de vida útil"
        baja_estado = ret_req.status if ret_req else "DADO DE BAJA"
        baja_metodo = ret_req.approved_method or "Reciclaje / Venta de chatarra" if ret_req else "Disposición ecológica"
        baja_solicitante = str(ret_req.requested_by) if (ret_req and ret_req.requested_by) else "Luis Fernández"
        baja_aprobador = str(ret_req.supervisor_name or ret_req.decision_by or "Rosa Medina")

        sec15_data = [
            [
                Paragraph("<b>Fecha de Baja:</b>", cell_bold),
                Paragraph(baja_fecha, cell_normal),
                Paragraph("<b>Estado Final:</b>", cell_bold),
                Paragraph(f"<b>{baja_estado}</b>", cell_normal),
            ],
            [
                Paragraph("<b>Motivo de Baja:</b>", cell_bold),
                Paragraph(baja_motivo, cell_normal),
                Paragraph("<b>Tipo de Disposición:</b>", cell_bold),
                Paragraph(baja_metodo, cell_normal),
            ],
            [
                Paragraph("<b>Responsable Solicitante:</b>", cell_bold),
                Paragraph(baja_solicitante, cell_normal),
                Paragraph("<b>Aprobador / V°B°:</b>", cell_bold),
                Paragraph(baja_aprobador, cell_normal),
            ],
        ]
        t_sec15 = Table(sec15_data, colWidths=[col_w1, col_w2, col_w3, col_w4])
        t_sec15.setStyle(
            TableStyle([
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F8F9FA")),
                ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F8F9FA")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("PADDING", (0, 0), (-1, -1), 3),
            ])
        )
        story.append(t_sec15)
    else:
        t_sec15_empty = Table(
            [[Paragraph("<b>Estado del Bien:</b> El bien se encuentra en estado <b>OPERATIVO / EN SERVICIO</b>. No registra solicitud ni proceso de baja patrimonial en el sistema.", cell_normal)]],
            colWidths=[content_width],
        )
        t_sec15_empty.setStyle(
            TableStyle([
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFFFFF")),
                ("PADDING", (0, 0), (-1, -1), 5),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ])
        )
        story.append(t_sec15_empty)

    story.append(Spacer(1, 0.25 * cm))

    # 16. RESUMEN DE TRAZABILIDAD (MÉTRICAS REALES)
    story.append(Paragraph("16. RESUMEN DE TRAZABILIDAD", section_heading))

    num_assignments = all_assignments.count() if all_assignments else 1
    num_maintenances = repairs.count() if repairs else 0
    num_incidents = incidents.count() if incidents else 0
    num_movements = len(mov_rows) - 1

    sec16_data = [
        [
            Paragraph("<b>Fecha de Ingreso:</b>", cell_bold),
            Paragraph(fecha_ingreso, cell_normal),
            Paragraph("<b>Responsable Actual:</b>", cell_bold),
            Paragraph(resp_name, cell_normal),
        ],
        [
            Paragraph("<b>Ubicación Actual:</b>", cell_bold),
            Paragraph(f"{n3_name} · {n4_name}", cell_normal),
            Paragraph("<b>Estado Actual del Bien:</b>", cell_bold),
            Paragraph(f"<b>{estado_actual_val}</b> ({condicion_actual_val})", cell_normal),
        ],
        [
            Paragraph("<b>N.° Asignaciones Registradas:</b>", cell_bold),
            Paragraph(str(num_assignments), cell_normal),
            Paragraph("<b>N.° Mantenimientos Realizados:</b>", cell_bold),
            Paragraph(str(num_maintenances), cell_normal),
        ],
        [
            Paragraph("<b>N.° Incidencias Registradas:</b>", cell_bold),
            Paragraph(str(num_incidents), cell_normal),
            Paragraph("<b>N.° Movimientos / Traslados:</b>", cell_bold),
            Paragraph(str(num_movements), cell_normal),
        ],
    ]

    t_sec16 = Table(sec16_data, colWidths=[col_w1, col_w2, col_w3, col_w4])
    t_sec16.setStyle(
        TableStyle([
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#A0A0A0")),
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F8F9FA")),
            ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F8F9FA")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("PADDING", (0, 0), (-1, -1), 3),
        ])
    )
    story.append(t_sec16)
    story.append(Spacer(1, 0.4 * cm))

    # 17. FIRMAS Y VALIDACIÓN
    sig_col_w = content_width / 2.0
    sig_block = []

    sig_data = [
        [
            Paragraph(
                f"<br/><br/>___________________________________<br/>"
                f"<b>Técnico / Responsable</b><br/>"
                f"<font size='7.5'>{resp_name}</font>",
                ParagraphStyle("Sig1Det", parent=cell_normal, alignment=1, fontSize=8),
            ),
            Paragraph(
                f"<br/><br/>___________________________________<br/>"
                f"<b>V°B° Supervisor / Administración</b><br/>"
                f"<font size='7.5'>Control Patrimonial &amp; FM</font>",
                ParagraphStyle("Sig2Det", parent=cell_normal, alignment=1, fontSize=8),
            ),
        ]
    ]

    t_sig = Table(sig_data, colWidths=[sig_col_w, sig_col_w])
    t_sig.setStyle(
        TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("PADDING", (0, 0), (-1, -1), 2),
        ])
    )
    sig_block.append(t_sig)
    story.append(KeepTogether(sig_block))

    doc.build(story, canvasmaker=DetailedNumberedCanvas)
    output.seek(0)
    return output


# =========================================================================
# ROUTER PRINCIPAL
# =========================================================================

def build_asset_pdf(asset, report_type="completo"):
    """
    Construye el PDF correspondiente según el tipo solicitado:
    - 'entrada': Ficha de Entrada del Bien (datos exclusivos de ingreso al sistema).
    - 'asignacion': Ficha de Asignación y Custodia (documento formal de custodia y entrega).
    - 'completo' o default: Ficha Técnica Detallada del Bien (Documento Maestro con 17 secciones completas).
    """
    r_type = str(report_type).lower()
    if r_type == "entrada":
        return build_asset_entry_pdf(asset)
    if r_type == "asignacion":
        return build_asset_assignment_pdf(asset)

    return build_asset_detailed_pdf(asset)
