import os
from io import BytesIO

from django.utils import timezone
from django.utils.dateparse import parse_datetime

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import (
    Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle, HRFlowable, KeepTogether
)


LOGO_PATH = os.path.join(os.path.dirname(__file__), "logo_brand.png")


def _get_logo_image():
    if os.path.exists(LOGO_PATH):
        try:
            return Image(LOGO_PATH, width=1.5 * cm, height=1.5 * cm, kind="proportional")
        except Exception:
            pass
    return None


def _image(photo):
    if not photo or not hasattr(photo, "image") or not photo.image:
        styles = getSampleStyleSheet()
        style = ParagraphStyle(
            "EmptyPhotoFormal",
            parent=styles["Normal"],
            fontName="Times-Italic",
            fontSize=9.5,
            textColor=colors.HexColor("#555555"),
            alignment=1,
        )
        return Paragraph("<br/><br/><i>Sin registro fotográfico adjunto</i><br/><br/>", style)
    try:
        data = BytesIO(photo.image.open("rb").read())
        image = Image(data, width=6.8 * cm, height=4.8 * cm, kind="proportional")
        return image
    except Exception:
        styles = getSampleStyleSheet()
        style = ParagraphStyle(
            "EmptyPhotoErrFormal",
            parent=styles["Normal"],
            fontName="Times-Italic",
            fontSize=9.5,
            textColor=colors.HexColor("#555555"),
            alignment=1,
        )
        return Paragraph("<br/><br/><i>No fue posible renderizar el archivo de imagen</i><br/><br/>", style)


def _effective_minutes(order):
    total = 0
    for session in order.work_sessions or []:
        start = parse_datetime(session.get("startAt") or "")
        end = parse_datetime(session.get("endAt") or "") if session.get("endAt") else timezone.now()
        if start and end and end >= start:
            total += (end - start).total_seconds() / 60
    return round(total)


def build_work_order_pdf(order):
    output = BytesIO()

    # 1. Configuración de página A4 con márgenes APA (2.0 cm laterales)
    doc = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=2.0 * cm,
        leftMargin=2.0 * cm,
        topMargin=2.0 * cm,
        bottomMargin=2.0 * cm,
    )

    # 2. Estilos Tipográficos Formales (Basados en Times / Helvetica)
    styles = getSampleStyleSheet()

    doc_header_title = ParagraphStyle(
        "DocHeaderTitle",
        parent=styles["Normal"],
        fontName="Times-Bold",
        fontSize=12.5,
        leading=15,
        textColor=colors.HexColor("#000000"),
    )

    doc_header_sub = ParagraphStyle(
        "DocHeaderSub",
        parent=styles["Normal"],
        fontName="Times-Roman",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#444444"),
    )

    doc_header_right = ParagraphStyle(
        "DocHeaderRight",
        parent=styles["Normal"],
        fontName="Times-Roman",
        fontSize=9,
        leading=12,
        alignment=2,
        textColor=colors.HexColor("#111111"),
    )

    section_heading = ParagraphStyle(
        "SectionHeadingAPA",
        parent=styles["Heading2"],
        fontName="Times-Bold",
        fontSize=10.5,
        leading=14,
        textColor=colors.HexColor("#000000"),
        spaceBefore=10,
        spaceAfter=4,
    )

    cell_bold = ParagraphStyle(
        "CellBoldAPA",
        parent=styles["Normal"],
        fontName="Times-Bold",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#000000"),
    )

    cell_normal = ParagraphStyle(
        "CellNormalAPA",
        parent=styles["Normal"],
        fontName="Times-Roman",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#111111"),
    )

    cell_right = ParagraphStyle(
        "CellRightAPA",
        parent=cell_normal,
        alignment=2,
    )

    cell_right_bold = ParagraphStyle(
        "CellRightBoldAPA",
        parent=cell_bold,
        alignment=2,
    )

    story = []

    # ---------------------------------------------------------
    # MEMBRETE OFICIAL CON LOGO (3 CUADRADOS DIAGONALES)
    # ---------------------------------------------------------
    logo_img = _get_logo_image()
    
    brand_text = Paragraph(
        "<b>INCALPACA FM S.A.</b><br/>"
        "<font color='#444444' size='8'>SISTEMA DE GESTIÓN TÉCNICA Y FACILITY MANAGEMENT</font><br/>"
        f"<b>INFORME TÉCNICO DE ORDEN N° {order.code}</b>",
        doc_header_title
    )

    now_str = timezone.localtime().strftime('%d/%m/%Y %H:%M')
    status_str = order.get_status_display().upper()

    meta_text = Paragraph(
        f"<b>Fecha de Emisión:</b> {now_str}<br/>"
        f"<b>Estado de Orden:</b> {status_str}<br/>"
        f"<b>Tipo:</b> {order.get_order_type_display().upper()}",
        doc_header_right
    )

    if logo_img:
        header_table = Table([[logo_img, brand_text, meta_text]], colWidths=[2.0 * cm, 9.5 * cm, 5.5 * cm])
    else:
        header_table = Table([[brand_text, meta_text]], colWidths=[11.5 * cm, 5.5 * cm])

    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 0),
    ]))
    
    story.append(header_table)
    story.append(Spacer(1, 0.25 * cm))
    story.append(HRFlowable(width="100%", thickness=1.0, color=colors.HexColor("#000000"), spaceBefore=2, spaceAfter=8))

    # ---------------------------------------------------------
    # SECCIÓN 1: DATOS DE IDENTIFICACIÓN Y UBICACIÓN
    # ---------------------------------------------------------
    story.append(Paragraph("1. DATOS DE IDENTIFICACIÓN Y UBICACIÓN DEL BIEN", section_heading))

    incident = getattr(order, "incident", None)
    asset = incident.asset if incident else None
    asset_code = (asset.fm_code or asset.code) if asset else "Sin bien asociado"
    asset_name = asset.name if asset else "-"
    location_parts = [getattr(incident, f, "") for f in ["building", "area", "room"] if getattr(incident, f, "")]
    location_str = " / ".join(location_parts) if location_parts else "Instalaciones de planta"

    tech_main = order.technician.get_full_name() or order.technician.username
    supervisor_name = order.supervisor.get_full_name() or order.supervisor.username
    supporting_techs = ", ".join(t.get_full_name() or t.username for t in order.supporting_technicians.all()) or "Ninguno"

    sec1_data = [
        [
            Paragraph("<b>Código de Orden:</b>", cell_bold),
            Paragraph(f"{order.code} ({order.order_type})", cell_normal),
            Paragraph("<b>Solicitud Origen:</b>", cell_bold),
            Paragraph(incident.code if incident else "Directa", cell_normal),
        ],
        [
            Paragraph("<b>Bien / Activo:</b>", cell_bold),
            Paragraph(f"{asset_code} - {asset_name}", cell_normal),
            Paragraph("<b>Ubicación Física:</b>", cell_bold),
            Paragraph(location_str, cell_normal),
        ],
        [
            Paragraph("<b>Técnico Responsable:</b>", cell_bold),
            Paragraph(tech_main, cell_normal),
            Paragraph("<b>Supervisor Asignado:</b>", cell_bold),
            Paragraph(supervisor_name, cell_normal),
        ],
        [
            Paragraph("<b>Personal de Apoyo:</b>", cell_bold),
            Paragraph(supporting_techs, cell_normal),
            Paragraph("<b>Prioridad Reportada:</b>", cell_bold),
            Paragraph(str(getattr(incident, "priority", "Normal")).upper(), cell_normal),
        ],
    ]

    t_sec1 = Table(sec1_data, colWidths=[3.6 * cm, 4.9 * cm, 3.6 * cm, 4.9 * cm])
    t_sec1.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F2F2F2")),
        ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F2F2F2")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#888888")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t_sec1)
    story.append(Spacer(1, 0.3 * cm))

    # ---------------------------------------------------------
    # SECCIÓN 2: PROGRAMACIÓN Y TIEMPOS DE ATENCIÓN
    # ---------------------------------------------------------
    story.append(Paragraph("2. PROGRAMACIÓN Y REGISTRO DE CRONOGRAMA", section_heading))

    start_time_str = f"{order.scheduled_date:%d/%m/%Y} {order.scheduled_start_time:%H:%M}"
    started_real_str = timezone.localtime(order.started_at).strftime("%d/%m/%Y %H:%M") if order.started_at else "No iniciado"
    finished_real_str = timezone.localtime(order.finished_at).strftime("%d/%m/%Y %H:%M") if order.finished_at else ("En ejecución" if order.started_at else "Pendiente")
    eff_mins = _effective_minutes(order)
    eff_hours_str = f"{eff_mins} minutos ({round(eff_mins / 60, 2)} hrs)"
    sat_str = f"{order.satisfaction.rating} / 5" if hasattr(order, "satisfaction") and order.satisfaction and order.satisfaction.rating else "Pendiente de conformidad"

    sec2_data = [
        [
            Paragraph("<b>Fecha/Hora Programada:</b>", cell_bold),
            Paragraph(start_time_str, cell_normal),
            Paragraph("<b>Duración Estimada:</b>", cell_bold),
            Paragraph(f"{order.planned_hours} horas", cell_normal),
        ],
        [
            Paragraph("<b>Inicio de Atención:</b>", cell_bold),
            Paragraph(started_real_str, cell_normal),
            Paragraph("<b>Fin de Atención:</b>", cell_bold),
            Paragraph(finished_real_str, cell_normal),
        ],
        [
            Paragraph("<b>Tiempo Efectivo Operativo:</b>", cell_bold),
            Paragraph(eff_hours_str, cell_normal),
            Paragraph("<b>Evaluación Solicitante:</b>", cell_bold),
            Paragraph(sat_str, cell_normal),
        ],
    ]

    t_sec2 = Table(sec2_data, colWidths=[3.6 * cm, 4.9 * cm, 3.6 * cm, 4.9 * cm])
    t_sec2.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F2F2F2")),
        ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F2F2F2")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#888888")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t_sec2)
    story.append(Spacer(1, 0.3 * cm))

    # ---------------------------------------------------------
    # SECCIÓN 3: CONSOLIDADO DE COSTOS Y MATERIALES
    # ---------------------------------------------------------
    story.append(Paragraph("3. DESGLOSE DE COSTOS Y RECURSOS UTILIZADOS", section_heading))

    cost_rows = [
        [
            Paragraph("<b>Categoría</b>", ParagraphStyle("TH1A", parent=cell_bold, textColor=colors.white)),
            Paragraph("<b>Descripción del Concepto / Insumo</b>", ParagraphStyle("TH2A", parent=cell_bold, textColor=colors.white)),
            Paragraph("<b>Monto (S/)</b>", ParagraphStyle("TH3A", parent=cell_right_bold, textColor=colors.white)),
        ]
    ]

    all_costs = list(order.cost_items.all())
    total_amount = sum(c.amount for c in all_costs if c.amount)

    if all_costs:
        for idx, item in enumerate(all_costs):
            bg = colors.HexColor("#FFFFFF") if idx % 2 == 0 else colors.HexColor("#F9F9F9")
            cost_rows.append([
                Paragraph(item.get_category_display(), cell_normal),
                Paragraph(item.description or "-", cell_normal),
                Paragraph(f"S/ {item.amount:.2f}", cell_right),
            ])
    else:
        cost_rows.append([
            Paragraph("-", cell_normal),
            Paragraph("Sin registro de costos de mano de obra o materiales.", cell_normal),
            Paragraph("S/ 0.00", cell_right),
        ])

    cost_rows.append([
        Paragraph("<b>TOTAL GENERAL</b>", cell_bold),
        Paragraph("", cell_normal),
        Paragraph(f"<b>S/ {total_amount:.2f}</b>", cell_right_bold),
    ])

    t_costs = Table(cost_rows, colWidths=[4.0 * cm, 9.2 * cm, 3.8 * cm])
    t_costs.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#000000")),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#E5E5E5")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#888888")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t_costs)
    story.append(Spacer(1, 0.3 * cm))

    # ---------------------------------------------------------
    # SECCIÓN 4: OBSERVACIONES Y DIAGNÓSTICO
    # ---------------------------------------------------------
    notes_text = order.administrator_notes or "Sin observaciones registradas por la administración."
    diag_dict = getattr(order, "diagnosis", None) or {}
    diag_text = str(diag_dict.get("notes") or "").strip() if isinstance(diag_dict, dict) else ""

    story.append(Paragraph("4. INDICACIONES TÉCNICAS Y DIAGNÓSTICO DE CAMPO", section_heading))
    obs_content = f"<b>Instrucciones de Administración:</b> {notes_text}"
    if diag_text:
        obs_content += f"<br/><br/><b>Diagnóstico y Recomendaciones Técnicas:</b> {diag_text}"

    t_obs = Table([[Paragraph(obs_content, cell_normal)]], colWidths=[17.0 * cm])
    t_obs.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#FFFFFF")),
        ("BOX", (0, 0), (0, 0), 0.5, colors.HexColor("#888888")),
        ("PADDING", (0, 0), (0, 0), 8),
    ]))
    story.append(t_obs)
    story.append(Spacer(1, 0.3 * cm))

    # ---------------------------------------------------------
    # SECCIÓN 5: EVIDENCIA FOTOGRÁFICA (ANTES / DESPUÉS)
    # ---------------------------------------------------------
    photos_by_stage = {photo.stage: photo for photo in order.traceability_photos.all()}
    start_photo_elem = _image(photos_by_stage.get("INICIO") or photos_by_stage.get("START"))
    finish_photo_elem = _image(photos_by_stage.get("FINAL") or photos_by_stage.get("FINISH"))

    photo_block = []
    photo_block.append(Paragraph("5. EVIDENCIA FOTOGRÁFICA DE CAMPO", section_heading))

    photo_table_data = [
        [
            Paragraph("<b>ESTADO INICIAL (ANTES)</b>", ParagraphStyle("P1A", parent=cell_bold, alignment=1)),
            Paragraph("<b>ESTADO FINAL (DESPUÉS)</b>", ParagraphStyle("P2A", parent=cell_bold, alignment=1)),
        ],
        [
            start_photo_elem,
            finish_photo_elem,
        ]
    ]

    t_photos = Table(photo_table_data, colWidths=[8.5 * cm, 8.5 * cm])
    t_photos.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F2F2F2")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#888888")),
        ("ALIGN", (0, 1), (-1, 1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    photo_block.append(t_photos)
    story.append(KeepTogether(photo_block))
    story.append(Spacer(1, 0.8 * cm))

    # ---------------------------------------------------------
    # SECCIÓN 6: VALIDACIÓN Y FIRMAS DE CONFORMIDAD
    # ---------------------------------------------------------
    sig_block = []
    sig_data = [
        [
            Paragraph("<br/><br/><br/>________________________________________<br/><b>Firma del Técnico Responsable</b><br/>" + tech_main, ParagraphStyle("S1A", parent=cell_normal, alignment=1)),
            Paragraph("<br/><br/><br/>________________________________________<br/><b>V°B° Supervisor / Administración</b><br/>" + supervisor_name, ParagraphStyle("S2A", parent=cell_normal, alignment=1)),
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
        canvas.setFont("Times-Roman", 8)
        canvas.setFillColor(colors.HexColor("#444444"))
        canvas.drawString(2.0 * cm, 1.0 * cm, "INCALPACA FM S.A. — Documento Técnico Oficial de Gestión de Infraestructura")
        canvas.drawRightString(21.0 * cm - 2.0 * cm, 1.0 * cm, f"Página {doc.page}")
        canvas.setStrokeColor(colors.HexColor("#000000"))
        canvas.setLineWidth(0.5)
        canvas.line(2.0 * cm, 1.3 * cm, 21.0 * cm - 2.0 * cm, 1.3 * cm)
        canvas.restoreState()

    doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)
    output.seek(0)
    return output
