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


def _image(photo):
    if not photo or not hasattr(photo, "image") or not photo.image:
        styles = getSampleStyleSheet()
        style = ParagraphStyle(
            "EmptyPhotoText",
            parent=styles["Normal"],
            fontSize=9,
            textColor=colors.HexColor("#777777"),
            alignment=1,
        )
        return Paragraph("<br/><br/><i>Sin fotografía registrada</i><br/><br/>", style)
    try:
        data = BytesIO(photo.image.open("rb").read())
        image = Image(data, width=7.2 * cm, height=5.2 * cm, kind="proportional")
        return image
    except Exception:
        styles = getSampleStyleSheet()
        style = ParagraphStyle(
            "EmptyPhotoTextErr",
            parent=styles["Normal"],
            fontSize=9,
            textColor=colors.HexColor("#777777"),
            alignment=1,
        )
        return Paragraph("<br/><br/><i>Error al cargar archivo de imagen</i><br/><br/>", style)


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
    
    # 1. Configuración del documento A4
    doc = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=1.2 * cm,
        leftMargin=1.2 * cm,
        topMargin=1.2 * cm,
        bottomMargin=1.4 * cm,
    )

    # 2. Estilos personalizados
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=14,
        leading=17,
        textColor=colors.HexColor("#111111"),
    )
    
    subtitle_style = ParagraphStyle(
        "DocSubTitle",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor("#555555"),
    )

    section_heading = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#111111"),
        spaceBefore=8,
        spaceAfter=4,
    )

    cell_bold = ParagraphStyle(
        "CellBold",
        parent=styles["Normal"],
        fontName="Helvetica-Bold",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#111111"),
    )

    cell_normal = ParagraphStyle(
        "CellNormal",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#333333"),
    )

    right_align = ParagraphStyle(
        "RightAlign",
        parent=cell_normal,
        alignment=2,
    )

    right_align_bold = ParagraphStyle(
        "RightAlignBold",
        parent=cell_bold,
        alignment=2,
    )

    story = []

    # ---------------------------------------------------------
    # CABECERA Y MEMBRETE CORPORATIVO
    # ---------------------------------------------------------
    now_str = timezone.localtime().strftime('%d/%m/%Y %H:%M')
    status_str = order.get_status_display().upper()
    
    header_data = [
        [
            Paragraph("<b>INCALPACA FM</b><br/><font color='#555555' size='8'>FACILITY MANAGEMENT & MANTENIMIENTO TÉCNICO</font><br/><b>Informe Ejecutivo de Orden Operativa</b>", title_style),
            Paragraph(f"<font color='#111111'><b>INFORME N°:</b> {order.code}</font><br/><font color='#555555'>Fecha Emisión: {now_str}</font><br/><font color='#111111'><b>Estado:</b> {status_str}</font>", right_align)
        ]
    ]

    header_table = Table(header_data, colWidths=[11.5 * cm, 7.1 * cm])
    header_table.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 0.2 * cm))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#111111"), spaceBefore=2, spaceAfter=8))

    # ---------------------------------------------------------
    # SECCIÓN 1: DATOS GENERALES DE LA ORDEN DE TRABAJO
    # ---------------------------------------------------------
    story.append(Paragraph("1. DATOS GENERALES DE LA ORDEN", section_heading))
    
    incident = getattr(order, "incident", None)
    asset = incident.asset if incident else None
    asset_code = (asset.fm_code or asset.code) if asset else "Sin bien asociado"
    asset_name = asset.name if asset else "-"
    location_parts = [getattr(incident, f, "") for f in ["building", "area", "room"] if getattr(incident, f, "")]
    location_str = " / ".join(location_parts) if location_parts else "Instalaciones FM"
    
    tech_main = order.technician.get_full_name() or order.technician.username
    supervisor_name = order.supervisor.get_full_name() or order.supervisor.username
    supporting_techs = ", ".join(t.get_full_name() or t.username for t in order.supporting_technicians.all()) or "No aplica"

    sec1_data = [
        [
            Paragraph("<b>Código OT / Tipo:</b>", cell_bold),
            Paragraph(f"{order.code} ({order.get_order_type_display()})", cell_normal),
            Paragraph("<b>Solicitud Origen:</b>", cell_bold),
            Paragraph(incident.code if incident else "Directa", cell_normal),
        ],
        [
            Paragraph("<b>Bien / Activo:</b>", cell_bold),
            Paragraph(f"{asset_code} - {asset_name}", cell_normal),
            Paragraph("<b>Ubicación:</b>", cell_bold),
            Paragraph(location_str, cell_normal),
        ],
        [
            Paragraph("<b>Técnico Principal:</b>", cell_bold),
            Paragraph(tech_main, cell_normal),
            Paragraph("<b>Supervisor Resp.:</b>", cell_bold),
            Paragraph(supervisor_name, cell_normal),
        ],
        [
            Paragraph("<b>Técnicos Apoyo:</b>", cell_bold),
            Paragraph(supporting_techs, cell_normal),
            Paragraph("<b>Prioridad:</b>", cell_bold),
            Paragraph(str(getattr(incident, "priority", "Alta")).upper(), cell_normal),
        ],
    ]

    t_sec1 = Table(sec1_data, colWidths=[3.8 * cm, 5.5 * cm, 3.8 * cm, 5.5 * cm])
    t_sec1.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F8F9FA")),
        ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F8F9FA")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D8D8D8")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t_sec1)
    story.append(Spacer(1, 0.3 * cm))

    # ---------------------------------------------------------
    # SECCIÓN 2: TIEMPOS Y JORNADA OPERATIVA
    # ---------------------------------------------------------
    story.append(Paragraph("2. REGISTRO DE TIEMPOS Y JORNADA", section_heading))
    
    start_time_str = f"{order.scheduled_date:%d/%m/%Y} {order.scheduled_start_time:%H:%M}"
    started_real_str = timezone.localtime(order.started_at).strftime("%d/%m/%Y %H:%M") if order.started_at else "No iniciado"
    finished_real_str = timezone.localtime(order.finished_at).strftime("%d/%m/%Y %H:%M") if order.finished_at else ("En proceso" if order.started_at else "Pendiente")
    eff_mins = _effective_minutes(order)
    eff_hours_str = f"{eff_mins} min ({round(eff_mins / 60, 1)} h)"
    sat_str = f"{order.satisfaction.rating}/5 ⭐" if hasattr(order, "satisfaction") and order.satisfaction and order.satisfaction.rating else "Pendiente"

    sec2_data = [
        [
            Paragraph("<b>Programación:</b>", cell_bold),
            Paragraph(start_time_str, cell_normal),
            Paragraph("<b>Duración Estimada:</b>", cell_bold),
            Paragraph(f"{order.planned_hours} horas", cell_normal),
        ],
        [
            Paragraph("<b>Inicio Real:</b>", cell_bold),
            Paragraph(started_real_str, cell_normal),
            Paragraph("<b>Fin Real:</b>", cell_bold),
            Paragraph(finished_real_str, cell_normal),
        ],
        [
            Paragraph("<b>Tiempo Efectivo:</b>", cell_bold),
            Paragraph(eff_hours_str, cell_normal),
            Paragraph("<b>Satisfacción:</b>", cell_bold),
            Paragraph(sat_str, cell_normal),
        ],
    ]

    t_sec2 = Table(sec2_data, colWidths=[3.8 * cm, 5.5 * cm, 3.8 * cm, 5.5 * cm])
    t_sec2.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F8F9FA")),
        ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F8F9FA")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D8D8D8")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t_sec2)
    story.append(Spacer(1, 0.3 * cm))

    # ---------------------------------------------------------
    # SECCIÓN 3: DETALLE DE COSTOS E INSUMOS
    # ---------------------------------------------------------
    story.append(Paragraph("3. DETALLE CONSOLIDADO DE COSTOS E INSUMOS", section_heading))
    
    cost_rows = [
        [
            Paragraph("<b>Categoría</b>", ParagraphStyle("TH1", parent=cell_bold, textColor=colors.white)),
            Paragraph("<b>Descripción del Concepto / Material</b>", ParagraphStyle("TH2", parent=cell_bold, textColor=colors.white)),
            Paragraph("<b>Importe (S/)</b>", ParagraphStyle("TH3", parent=right_align_bold, textColor=colors.white)),
        ]
    ]

    all_costs = list(order.cost_items.all())
    total_amount = sum(c.amount for c in all_costs if c.amount)

    if all_costs:
        for idx, item in enumerate(all_costs):
            bg = colors.HexColor("#FFFFFF") if idx % 2 == 0 else colors.HexColor("#F8F9FA")
            cost_rows.append([
                Paragraph(item.get_category_display(), cell_normal),
                Paragraph(item.description or "-", cell_normal),
                Paragraph(f"S/ {item.amount:.2f}", right_align),
            ])
    else:
        cost_rows.append([
            Paragraph("-", cell_normal),
            Paragraph("Sin costos de mano de obra o materiales registrados.", cell_normal),
            Paragraph("S/ 0.00", right_align),
        ])

    # Fila de Total
    cost_rows.append([
        Paragraph("<b>TOTAL COSTOS</b>", cell_bold),
        Paragraph("", cell_normal),
        Paragraph(f"<b>S/ {total_amount:.2f}</b>", right_align_bold),
    ])

    t_costs = Table(cost_rows, colWidths=[4.2 * cm, 10.4 * cm, 4.0 * cm])
    t_costs.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#111111")),
        ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#EAEAEA")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D8D8D8")),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 5),
    ]))
    story.append(t_costs)
    story.append(Spacer(1, 0.3 * cm))

    # ---------------------------------------------------------
    # SECCIÓN 4: INDICACIONES Y OBSERVACIONES TÉCNICAS
    # ---------------------------------------------------------
    notes_text = order.administrator_notes or "Sin observaciones o indicaciones adicionales registradas por el administrador."
    diag_dict = getattr(order, "diagnosis", None) or {}
    diag_text = str(diag_dict.get("notes") or "").strip() if isinstance(diag_dict, dict) else ""

    story.append(Paragraph("4. INDICACIONES Y DIAGNÓSTICO TÉCNICO", section_heading))
    obs_content = f"<b>Indicaciones Administrador:</b> {notes_text}"
    if diag_text:
        obs_content += f"<br/><br/><b>Diagnóstico Operativo:</b> {diag_text}"

    t_obs = Table([[Paragraph(obs_content, cell_normal)]], colWidths=[18.6 * cm])
    t_obs.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#F8F9FA")),
        ("BOX", (0, 0), (0, 0), 0.5, colors.HexColor("#D8D8D8")),
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
    photo_block.append(Paragraph("5. EVIDENCIA FOTOGRÁFICA DE TRABAJO", section_heading))

    photo_table_data = [
        [
            Paragraph("<b>EVIDENCIA INICIAL (ANTES)</b>", ParagraphStyle("P1", parent=cell_bold, alignment=1)),
            Paragraph("<b>EVIDENCIA FINAL (DESPUÉS)</b>", ParagraphStyle("P2", parent=cell_bold, alignment=1)),
        ],
        [
            start_photo_elem,
            finish_photo_elem,
        ]
    ]

    t_photos = Table(photo_table_data, colWidths=[9.3 * cm, 9.3 * cm])
    t_photos.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F8F9FA")),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#D8D8D8")),
        ("ALIGN", (0, 1), (-1, 1), "CENTER"),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    photo_block.append(t_photos)
    story.append(KeepTogether(photo_block))
    story.append(Spacer(1, 0.8 * cm))

    # ---------------------------------------------------------
    # SECCIÓN 6: FIRMAS Y VALIDACIÓN DE CONFORMIDAD
    # ---------------------------------------------------------
    sig_block = []
    sig_data = [
        [
            Paragraph("<br/><br/>________________________________________<br/><b>Firma Técnico Responsable</b><br/>" + tech_main, ParagraphStyle("S1", parent=cell_normal, alignment=1)),
            Paragraph("<br/><br/>________________________________________<br/><b>V°B° Supervisor / Administración</b><br/>" + supervisor_name, ParagraphStyle("S2", parent=cell_normal, alignment=1)),
        ]
    ]
    t_sig = Table(sig_data, colWidths=[9.3 * cm, 9.3 * cm])
    t_sig.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
        ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ]))
    sig_block.append(t_sig)
    story.append(KeepTogether(sig_block))

    # ---------------------------------------------------------
    # 3. Construcción del PDF
    # ---------------------------------------------------------
    def add_footer(canvas, doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(colors.HexColor("#777777"))
        canvas.drawString(1.2 * cm, 0.8 * cm, "Incalpaca FM — Sistema de Gestión Técnica de Bienes (SGTB)")
        canvas.drawRightString(21.0 * cm - 1.2 * cm, 0.8 * cm, f"Página {doc.page} | Generado automáticamente")
        canvas.restoreState()

    doc.build(story, onFirstPage=add_footer, onLaterPages=add_footer)
    output.seek(0)
    return output
