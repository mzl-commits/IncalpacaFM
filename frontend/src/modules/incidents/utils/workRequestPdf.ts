import QRCode from "qrcode";
import type { WorkRequest } from "../types";
import { INCALPACA_LOGO_SVG, getIncalpacaReportCSS } from "@/modules/reports/utils/incalpacaReportStyles";

function formatDate(dateStr?: string | null) {
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

function priorityLabel(p?: string) {
  const map: Record<string, string> = {
    BAJA: "Baja",
    MEDIA: "Media",
    ALTA: "Alta",
    URGENTE: "Urgente",
    EMERGENCIA: "Emergencia",
  };
  return p ? (map[p] ?? p) : "Normal";
}

function statusLabel(s?: string) {
  const map: Record<string, string> = {
    PENDIENTE: "Pendiente",
    EN_EVALUACION: "En evaluación",
    APROBADA: "Aprobada",
    CONVERTIDA_EN_OT: "Convertida en OT",
    RECHAZADA: "Rechazada",
    CANCELADA: "Cancelada",
  };
  return s ? (map[s] ?? s) : "Pendiente";
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
    width: 180,
    color: { dark: "#111111", light: "#ffffff" },
  });

  const nowStr = formatDate(new Date().toISOString());

  const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Solicitud de Trabajo — ${request.code} | Incalpaca FM</title>
  <style>
    ${getIncalpacaReportCSS()}
    .request-summary-table td {
      padding: 6pt 8pt;
    }
  </style>
</head>
<body>
<div class="main-report">

  <!-- ENCABEZADO INSTITUCIONAL -->
  <div class="page-header">
    <div class="logo-area">
      ${INCALPACA_LOGO_SVG}
      <div class="company-block">
        <div class="company-name">INCALPACA FM S.A.</div>
        <div class="company-subtitle">Sistema de Gestión de Mantenimiento y Servicios</div>
        <div class="report-name">SOLICITUD DE TRABAJO DE CAMPO</div>
      </div>
    </div>
    <div class="header-right">
      <span>Fecha Emisión: ${nowStr}</span><br/>
      <span>Código Solicitud: <strong>${request.code}</strong></span><br/>
      <span>Estado: <strong>${statusLabel(request.status)}</strong></span><br/>
      <span>Prioridad: <strong>${priorityLabel(request.requesterPriority)}</strong></span>
    </div>
  </div>

  <!-- SECCIÓN 1: DATOS GENERALES Y SOLICITANTE -->
  <div class="section-block">
    <div class="section-heading">1. DATOS DE IDENTIFICACIÓN Y SOLICITANTE</div>
    <table class="data-table request-summary-table">
      <tbody>
        <tr>
          <td class="label" style="width:24%">Código Solicitud:</td>
          <td class="value" style="width:26%"><strong>${request.code}</strong></td>
          <td class="label" style="width:24%">Fecha de Registro:</td>
          <td class="value" style="width:26%">${formatDate(request.reportedAt)}</td>
        </tr>
        <tr>
          <td class="label">Solicitante:</td>
          <td class="value"><strong>${request.requesterName}</strong></td>
          <td class="label">Correo Electrónico:</td>
          <td class="value">${request.requesterEmail || "—"}</td>
        </tr>
        <tr>
          <td class="label">Tipo de Solicitud:</td>
          <td class="value"><strong>${request.requestType || "Mantenimiento General"}</strong></td>
          <td class="label">Prioridad Declarada:</td>
          <td class="value"><strong>${priorityLabel(request.requesterPriority)}</strong></td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- SECCIÓN 2: UBICACIÓN Y BIEN VINCULADO -->
  <div class="section-block">
    <div class="section-heading">2. UBICACIÓN FÍSICA Y ACTIVO RELACIONADO</div>
    <table class="data-table request-summary-table">
      <tbody>
        <tr>
          <td class="label" style="width:24%">Edificio / Sector:</td>
          <td class="value" style="width:26%"><strong>${request.building || "Planta Principal"}</strong></td>
          <td class="label" style="width:24%">Área / Departamento:</td>
          <td class="value" style="width:26%">${request.area || "General"}</td>
        </tr>
        <tr>
          <td class="label">Módulo / Ambiente:</td>
          <td class="value">${request.room || "Oficina / Sala"}</td>
          <td class="label">Bien / Activo Afectado:</td>
          <td class="value"><strong>${request.assetName || request.assetCode || "Mueble o equipo general"}</strong></td>
        </tr>
        ${request.assetCode ? `
        <tr>
          <td class="label">ID Técnico Bien:</td>
          <td class="value" colspan="3"><code>${request.assetCode}</code></td>
        </tr>` : ''}
      </tbody>
    </table>
  </div>

  <!-- SECCIÓN 3: DESCRIPCIÓN DEL REQUERIMIENTO / PROBLEMA -->
  <div class="section-block">
    <div class="section-heading">3. DESCRIPCIÓN TÉCNICA DEL REQUERIMIENTO</div>
    <table class="data-table">
      <tbody>
        <tr>
          <td class="label" style="width:24%">Asunto / Requerimiento:</td>
          <td class="value" colspan="3" style="font-size:10pt;">
            <strong>${request.description}</strong>
          </td>
        </tr>
        ${request.observations ? `
        <tr>
          <td class="label">Observaciones Adicionales:</td>
          <td class="value" colspan="3">${request.observations}</td>
        </tr>` : ''}
      </tbody>
    </table>
  </div>

  <!-- SECCIÓN 4: EVIDENCIA FOTOGRÁFICA -->
  <div class="section-block" style="page-break-inside: avoid;">
    <div class="section-heading">4. REGISTRO FOTOGRÁFICO DE LA SOLICITUD</div>
    <div class="photo-grid">
      <div class="photo-col">
        <div class="photo-title">EVIDENCIA REGISTRADA</div>
        <div class="photo-frame">
          ${request.photoUrl ? `<img src="${request.photoUrl}" alt="Evidencia de solicitud"/>` : `<span class="photo-empty">Sin evidencia fotográfica adjunta</span>`}
        </div>
      </div>
    </div>
  </div>

  <!-- SECCIÓN 5: TRAZABILIDAD Y QR -->
  <div class="section-block">
    <div class="section-heading">5. TRAZABILIDAD DIGITAL Y VERIFICACIÓN</div>
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
              <td class="label" style="width:35%">Estado en Sistema:</td>
              <td class="value"><strong>${statusLabel(request.status)}</strong></td>
            </tr>
            <tr>
              <td class="label" style="width:35%">URL de Validación:</td>
              <td class="value">${publicUrl}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- FIRMAS -->
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
