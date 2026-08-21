import QRCode from "qrcode";
import type { WorkRequest } from "../types";
import { requestPriorityLabels, requestStatusLabels, requestTypeLabels } from "../incidentModel";
import { INCALPACA_LOGO_SVG, getIncalpacaReportCSS } from "@/modules/reports/utils/incalpacaReportStyles";

function formatDateLong(dateStr?: string | null) {
  if (!dateStr) return "Fecha no registrada";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDateShort(dateStr?: string | null) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export async function generateWorkRequestPdf({
  request,
  action = "print",
}: {
  request: WorkRequest;
  action?: "download" | "print";
}) {
  const publicUrl = `${window.location.origin}/incidencias/${request.id}`;
  const qrDataUrl = await QRCode.toDataURL(publicUrl, {
    margin: 1,
    width: 200,
    color: { dark: "#111111", light: "#ffffff" },
  });

  const nowStr = formatDateShort(new Date().toISOString());

  // Evidencias fotográficas
  const evidencias = request.evidence ?? [];
  const fotoHtml = evidencias.length > 0
    ? evidencias.slice(0, 2).map((ev, i) =>
        `<div class="photo-col">
          <div class="photo-title">${i === 0 ? "EVIDENCIA ADJUNTA (1)" : "EVIDENCIA ADJUNTA (2)"}</div>
          <div class="photo-frame">
            ${ev.dataUrl
              ? `<img src="${ev.dataUrl}" alt="${ev.name}"/>`
              : `<span class="photo-empty">${ev.name || "Archivo adjunto"}</span>`
            }
          </div>
        </div>`
      ).join("")
    : `<div class="photo-col">
        <div class="photo-title">EVIDENCIA ADJUNTA</div>
        <div class="photo-frame">
          <span class="photo-empty">Sin registro fotográfico adjunto</span>
        </div>
      </div>`;

  // Evaluación de impacto / respuestas del formulario
  const impact = request.impactAssessment;
  const answers = impact?.answers;
  const impactRows = impact
    ? `
      <tr>
        <td class="label">Prioridad Sugerida por Sistema:</td>
        <td class="value">${requestPriorityLabels[impact.suggestedPriority ?? "NORMAL"] ?? (impact.suggestedPriority || "—")}</td>
        <td class="label">¿Para trabajo operativo?:</td>
        <td class="value">${answers?.stopsWork === "SI" ? "Sí, paraliza actividades" : answers?.stopsWork === "NO" ? "No" : "—"}</td>
      </tr>
      <tr>
        <td class="label">¿Riesgo de seguridad?:</td>
        <td class="value">${answers?.safetyRisk === "SI" ? "Sí" : "No"}</td>
        <td class="label">¿Personas afectadas?:</td>
        <td class="value">${answers?.affectedPeople === "TODA_EL_AREA" ? "Toda el área" : answers?.affectedPeople === "VARIAS_PERSONAS" ? "Varias personas" : "Solo el solicitante"}</td>
      </tr>`
    : `<tr><td colspan="4" style="font-style:italic; color:#808080; text-align:center;">Sin evaluación de impacto registrada.</td></tr>`;

  // Motivo de rechazo si aplica
  const rejectionHtml = request.rejectionReason
    ? `<div class="section-block">
        <div class="section-heading">MOTIVO DE RECHAZO / OBSERVACIÓN</div>
        <table class="data-table"><tbody>
          <tr>
            <td class="label" style="width:24%">Motivo:</td>
            <td class="value" colspan="3">${request.rejectionReason}</td>
          </tr>
        </tbody></table>
      </div>`
    : "";

  const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Solicitud de Trabajo — ${request.code} | Incalpaca FM</title>
  <style>
    ${getIncalpacaReportCSS()}
  </style>
</head>
<body>
<div class="main-report">

  <!-- ENCABEZADO INSTITUCIONAL (igual que workOrderReportPdf) -->
  <div class="page-header">
    <div class="logo-area">
      ${INCALPACA_LOGO_SVG}
      <div class="company-block">
        <div class="company-name">INCALPACA FM S.A.</div>
        <div class="company-subtitle">Sistema de Gestión Técnica y Facility Management</div>
        <div class="report-name">SOLICITUD DE TRABAJO N° ${request.code}</div>
      </div>
    </div>
    <div class="header-right">
      <span>Fecha de Emisión: ${nowStr}</span><br/>
      <span>Estado: <strong>${requestStatusLabels[request.status] ?? request.status}</strong></span><br/>
      <span>Prioridad: <strong>${requestPriorityLabels[request.requesterPriority] ?? request.requesterPriority}</strong></span>
    </div>
  </div>

  <!-- 1. DATOS DE IDENTIFICACIÓN Y UBICACIÓN DEL BIEN -->
  <div class="section-block">
    <div class="section-heading">1. DATOS DE IDENTIFICACIÓN Y UBICACIÓN DEL BIEN</div>
    <table class="data-table">
      <tbody>
        <tr>
          <td class="label" style="width:24%">Código Solicitud:</td>
          <td class="value" style="width:26%"><strong>${request.code}</strong></td>
          <td class="label" style="width:24%">Fecha de Registro:</td>
          <td class="value" style="width:26%">${formatDateLong(request.reportedAt)}</td>
        </tr>
        <tr>
          <td class="label">Solicitante:</td>
          <td class="value"><strong>${request.requesterName}</strong></td>
          <td class="label">Correo / Teléfono:</td>
          <td class="value">${request.requesterEmail || "—"}${request.requesterPhone ? ` · ${request.requesterPhone}` : ""}</td>
        </tr>
        <tr>
          <td class="label">Bien / Activo:</td>
          <td class="value">${request.assetDisplayCode || request.assetCode || "Sin bien asignado"}</td>
          <td class="label">Ubicación Física:</td>
          <td class="value">${[request.building, request.area, request.room].filter(Boolean).join(" / ") || "—"}</td>
        </tr>
        <tr>
          <td class="label">Tipo de Solicitud:</td>
          <td class="value"><strong>${requestTypeLabels[request.requestType] ?? request.requestType}</strong></td>
          <td class="label">¿Trato como Proyecto?:</td>
          <td class="value">${request.project ? "Sí, tratamiento como proyecto" : "No"}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- 2. DESCRIPCIÓN Y FALLA REPORTADA -->
  <div class="section-block">
    <div class="section-heading">2. DESCRIPCIÓN Y DETALLE DEL REQUERIMIENTO</div>
    <table class="data-table">
      <tbody>
        <tr>
          <td class="label" style="width:24%; vertical-align:top;">Descripción:</td>
          <td class="value" colspan="3" style="font-size:9.5pt; line-height:1.5;">${request.description}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- 3. EVALUACIÓN DE IMPACTO -->
  <div class="section-block">
    <div class="section-heading">3. EVALUACIÓN DE IMPACTO Y DIAGNÓSTICO INICIAL</div>
    <table class="data-table">
      <tbody>
        ${impactRows}
      </tbody>
    </table>
  </div>

  <!-- 4. EVIDENCIA FOTOGRÁFICA DE CAMPO -->
  <div class="section-block" style="page-break-inside:avoid; break-inside:avoid;">
    <div class="section-heading">4. EVIDENCIA FOTOGRÁFICA DE CAMPO</div>
    <div class="photo-grid">
      ${fotoHtml}
    </div>
  </div>

  <!-- 5. PROGRAMACIÓN Y ESTADO DE ATENCIÓN -->
  <div class="section-block">
    <div class="section-heading">5. PROGRAMACIÓN Y ESTADO DE ATENCIÓN</div>
    <table class="data-table">
      <tbody>
        <tr>
          <td class="label" style="width:24%">Estado Actual:</td>
          <td class="value" style="width:26%"><strong>${requestStatusLabels[request.status] ?? request.status}</strong></td>
          <td class="label" style="width:24%">Última Actualización:</td>
          <td class="value" style="width:26%">${formatDateLong(request.updatedAt)}</td>
        </tr>
        <tr>
          <td class="label">Orden de Trabajo Asignada:</td>
          <td class="value" colspan="3">${request.workOrderId ? `OT vinculada: ${request.workOrderId}` : "Sin orden de trabajo asignada aún."}</td>
        </tr>
      </tbody>
    </table>
  </div>

  ${rejectionHtml}

  <!-- 6. TRAZABILIDAD DIGITAL Y QR -->
  <div class="section-block">
    <div class="section-heading">6. TRAZABILIDAD DIGITAL Y VERIFICACIÓN</div>
    <div class="qr-block">
      <div class="qr-cell">
        <img src="${qrDataUrl}" alt="QR vinculado a ${request.code}">
        <span>Escanear para verificar solicitud</span>
      </div>
      <div class="qr-info">
        <table class="data-table">
          <tbody>
            <tr>
              <td class="label" style="width:35%">Código de Registro:</td>
              <td class="value"><strong>${request.code}</strong></td>
            </tr>
            <tr>
              <td class="label">Estado en Sistema:</td>
              <td class="value"><strong>${requestStatusLabels[request.status] ?? request.status}</strong></td>
            </tr>
            <tr>
              <td class="label">URL de Validación:</td>
              <td class="value">${publicUrl}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- FIRMAS (igual que workOrderReportPdf) -->
  <div class="signatures-block">
    <div class="sig-cell">
      <div class="sig-line"></div>
      <div class="sig-role">Solicitante</div>
      <div class="sig-name">${request.requesterName}</div>
    </div>
    <div class="sig-cell">
      <div class="sig-line"></div>
      <div class="sig-role">V°B° Evaluación / Mantenimiento</div>
      <div class="sig-name">Gestión Patrimonial &amp; FM</div>
    </div>
  </div>

</div>
  <script>
    if (${action === "print"}) {
      window.onload = function() {
        window.focus();
        window.print();
      };
    }
  </script>
</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
}
