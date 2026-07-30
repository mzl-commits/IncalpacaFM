import io
from openpyxl import Workbook
from openpyxl.styles import Font, Alignment
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet


def generar_excel_inspeccion(inspeccion):
    wb = Workbook()
    ws = wb.active
    ws.title = "Inspección"

    objetivo = inspeccion.pieza.codigo if inspeccion.pieza else inspeccion.material.codigo
    ws.append(["INCALPACA - Formato de Inspección"])
    ws["A1"].font = Font(bold=True, size=14)
    ws.append([])
    ws.append(["Código:", objetivo])
    ws.append(["Material:", inspeccion.material.nombre])
    ws.append(["Tipo:", inspeccion.get_tipo_display()])
    ws.append(["Plantilla:", inspeccion.plantilla.nombre])
    ws.append(["Inspector:", inspeccion.inspector.get_full_name() or inspeccion.inspector.username])
    ws.append(["Fecha:", inspeccion.fecha.strftime("%d/%m/%Y")])
    ws.append([])

    ws.append(["N°", "Criterio", "Cumple", "No cumple", "No aplica", "Observaciones"])
    for cell in ws[ws.max_row]:
        cell.font = Font(bold=True)

    for resp in inspeccion.respuestas.select_related("criterio").order_by("criterio__orden"):
        fila = [
            resp.criterio.orden,
            resp.criterio.texto,
            "X" if resp.valor == "cumple" else "",
            "X" if resp.valor == "no_cumple" else "",
            "X" if resp.valor == "no_aplica" else "",
            resp.observacion,
        ]
        ws.append(fila)

    ws.append([])
    ws.append(["Resultado general:", inspeccion.get_resultado_general_display()])
    ws.append(["Acción tomada:", inspeccion.get_accion_tomada_display()])
    ws.append(["Observaciones generales:", inspeccion.observaciones])
    ws.append([])
    ws.append(["FIRMAS DE CONFORMIDAD"])
    ws.append(["Inspector", "", "Supervisor SST / Mantenimiento", "", "Responsable de Área"])
    ws.append(["Fecha: ____________", "", "Fecha: ____________", "", "Fecha: ____________"])

    for col in ["A", "B", "C", "D", "E", "F"]:
        ws.column_dimensions[col].width = 22

    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer


def generar_pdf_inspeccion(inspeccion):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    styles = getSampleStyleSheet()
    elementos = []

    objetivo = inspeccion.pieza.codigo if inspeccion.pieza else inspeccion.material.codigo
    elementos.append(Paragraph("INCALPACA - Formato de Inspección", styles["Title"]))
    elementos.append(Spacer(1, 12))
    elementos.append(Paragraph(f"<b>Código:</b> {objetivo}", styles["Normal"]))
    elementos.append(Paragraph(f"<b>Material:</b> {inspeccion.material.nombre}", styles["Normal"]))
    elementos.append(Paragraph(f"<b>Tipo:</b> {inspeccion.get_tipo_display()}", styles["Normal"]))
    elementos.append(Paragraph(f"<b>Plantilla:</b> {inspeccion.plantilla.nombre}", styles["Normal"]))
    inspector_nombre = inspeccion.inspector.get_full_name() or inspeccion.inspector.username
    elementos.append(Paragraph(f"<b>Inspector:</b> {inspector_nombre}", styles["Normal"]))
    elementos.append(Paragraph(f"<b>Fecha:</b> {inspeccion.fecha.strftime('%d/%m/%Y')}", styles["Normal"]))
    elementos.append(Spacer(1, 12))

    data = [["N°", "Criterio", "Cumple", "No cumple", "No aplica", "Obs."]]
    for resp in inspeccion.respuestas.select_related("criterio").order_by("criterio__orden"):
        data.append([
            resp.criterio.orden,
            resp.criterio.texto,
            "X" if resp.valor == "cumple" else "",
            "X" if resp.valor == "no_cumple" else "",
            "X" if resp.valor == "no_aplica" else "",
            resp.observacion,
        ])

    tabla = Table(data, colWidths=[25, 180, 45, 55, 45, 100])
    tabla.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f1f3d")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    elementos.append(tabla)
    elementos.append(Spacer(1, 20))

    elementos.append(Paragraph(f"<b>Resultado general:</b> {inspeccion.get_resultado_general_display()}", styles["Normal"]))
    elementos.append(Paragraph(f"<b>Acción tomada:</b> {inspeccion.get_accion_tomada_display()}", styles["Normal"]))
    elementos.append(Paragraph(f"<b>Observaciones:</b> {inspeccion.observaciones}", styles["Normal"]))
    elementos.append(Spacer(1, 30))

    firmas = Table(
        [["Inspector", "Supervisor SST / Mantenimiento", "Responsable de Área"],
         ["Fecha: ____________", "Fecha: ____________", "Fecha: ____________"]],
        colWidths=[150, 150, 150],
    )
    firmas.setStyle(TableStyle([
        ("LINEABOVE", (0, 0), (-1, 0), 1, colors.black),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
    ]))
    elementos.append(firmas)

    doc.build(elementos)
    buffer.seek(0)
    return buffer