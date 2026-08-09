from io import BytesIO

from django.utils import timezone
from django.utils.dateparse import parse_datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def _image(photo):
    if not photo:
        return Paragraph("No registrada", getSampleStyleSheet()["BodyText"])
    data = BytesIO(photo.image.open("rb").read())
    image = Image(data, width=7.4 * cm, height=5.4 * cm, kind="proportional")
    return image


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
    styles = getSampleStyleSheet()
    body = styles["BodyText"]
    title = styles["Title"]
    story = [Paragraph(f"Informe de orden de trabajo {order.code}", title)]
    story.append(Paragraph(f"Generado el {timezone.localtime().strftime('%d/%m/%Y %H:%M')}", body))
    story.append(Spacer(1, 0.35 * cm))
    asset = order.incident.asset
    details = [
        ["Bien", (asset.fm_code or asset.code) if asset else "Sin bien asociado"],
        ["Estado", order.get_status_display()],
        ["Técnico principal", order.technician.get_full_name() or order.technician.username],
        ["Técnicos de apoyo", ", ".join(t.get_full_name() or t.username for t in order.supporting_technicians.all()) or "No aplica"],
        ["Programación", f"{order.scheduled_date:%d/%m/%Y} {order.scheduled_start_time:%H:%M}"],
        ["Inicio", timezone.localtime(order.started_at).strftime("%d/%m/%Y %H:%M") if order.started_at else "No iniciado"],
        ["Fin", timezone.localtime(order.finished_at).strftime("%d/%m/%Y %H:%M") if order.finished_at else "En proceso"],
        ["Tiempo efectivo", f"{_effective_minutes(order)} min"],
        ["Satisfacción", f"{order.satisfaction.rating}/5" if hasattr(order, "satisfaction") and order.satisfaction.rating else "Pendiente"],
    ]
    table = Table(details, colWidths=[4.2 * cm, 12.5 * cm])
    table.setStyle(TableStyle([("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#eff4ff")), ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#c3c6d1")), ("VALIGN", (0, 0), (-1, -1), "TOP"), ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"), ("PADDING", (0, 0), (-1, -1), 7)]))
    story += [table, Spacer(1, 0.35 * cm), Paragraph("Costos registrados", styles["Heading2"])]
    costs = [["Categoría", "Descripción", "Importe"]] + [[item.get_category_display(), item.description, f"S/ {item.amount:.2f}"] for item in order.cost_items.all()]
    if len(costs) == 1: costs.append(["-", "Sin costos registrados", "S/ 0.00"])
    costs.append(["", "Total", f"S/ {sum(item.amount for item in order.cost_items.all()):.2f}"])
    cost_table = Table(costs, colWidths=[3.4 * cm, 9.5 * cm, 3.8 * cm])
    cost_table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#003366")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white), ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#c3c6d1")), ("ALIGN", (2, 1), (2, -1), "RIGHT"), ("PADDING", (0, 0), (-1, -1), 7)]))
    story += [cost_table, Spacer(1, 0.35 * cm), Paragraph("Evidencia fotográfica", styles["Heading2"])]
    photos = {photo.stage: photo for photo in order.traceability_photos.all()}
    photo_table = Table([[Paragraph("Antes de la atención", body), Paragraph("Después de la atención", body)], [_image(photos.get("INICIO")), _image(photos.get("FINAL"))]], colWidths=[8.5 * cm, 8.5 * cm])
    photo_table.setStyle(TableStyle([("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#c3c6d1")), ("PADDING", (0, 0), (-1, -1), 8)]))
    story.append(photo_table)
    SimpleDocTemplate(output, pagesize=A4, rightMargin=1.4 * cm, leftMargin=1.4 * cm, topMargin=1.4 * cm, bottomMargin=1.4 * cm).build(story)
    output.seek(0)
    return output
