import QRCode from "qrcode";
import type { WorkOrder } from "@/modules/workorders/types";
import type { WorkOrderCost } from "@/modules/workorders/workOrderRepository";
import type { WorkOrderMaterial } from "@/modules/workorders/workOrderMaterialRepository";
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

function formatHours(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
}

export async function generateWorkOrderApaPdf({
  order,
  costs = [],
  materials = [],
  action = "download",
}: {
  order: WorkOrder;
  costs?: WorkOrderCost[];
  materials?: WorkOrderMaterial[];
  action?: "download" | "print";
}) {
  const publicUrl = window.location.origin + `/ordenes-trabajo/${order.id}`;
  const qrDataUrl = await QRCode.toDataURL(publicUrl, {
    margin: 1,
    width: 200,
    color: { dark: "#111111", light: "#ffffff" },
  });

  const totalCost = costs.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalWorkedMinutes = (order.workSessions ?? []).reduce((total, session) => {
    const startedAt = new Date(session.startAt).getTime();
    const endedAt = session.endAt ? new Date(session.endAt).getTime() : Date.now();
    return total + Math.max(0, Math.round((endedAt - startedAt) / 60000));
  }, order.effectiveWorkMinutes ?? 0);

  const nowStr = formatDateShort(new Date().toISOString());

  // Rows de sesiones de trabajo
  const sessionRows = (order.workSessions ?? []).length > 0
    ? (order.workSessions ?? []).map((session, i) => {
        const start = new Date(session.startAt).getTime();
        const end = session.endAt ? new Date(session.endAt).getTime() : Date.now();
        const mins = Math.max(0, Math.round((end - start) / 60000));
        return `
          <tr>
            <td><strong>Sesión #${i + 1}</strong></td>
            <td>${formatDateLong(session.startAt)}</td>
            <td>${session.endAt ? formatDateLong(session.endAt) : "<em>En ejecución</em>"}</td>
            <td style="font-weight:700;">${formatHours(mins)}</td>
          </tr>`;
      }).join("")
    : `<tr><td colspan="4" class="td-empty text-center" style="font-style:italic; color:#808080;">Tiempo acumulado total: ${formatHours(totalWorkedMinutes)}</td></tr>`;

  // Rows de costos
  const costRows = costs.length > 0
    ? costs.map(item => `
        <tr>
          <td><strong>${item.categoryLabel}</strong></td>
          <td>${item.description}</td>
          <td class="text-center">1</td>
          <td class="text-right">S/ ${Number(item.amount || 0).toFixed(2)}</td>
        </tr>`).join("")
    : `<tr><td colspan="4" class="td-empty text-center" style="font-style:italic; color:#808080;">Sin costos registrados en esta orden de trabajo.</td></tr>`;

  // Rows de materiales
  const materialRows = materials.length > 0
    ? materials.map(m => `
        <tr>
          <td><strong>${m.name || m.description || "—"}</strong></td>
          <td class="text-center">${m.quantity ?? 1}</td>
          <td>${m.unit || "Unid."}</td>
          <td>${m.notes || "—"}</td>
        </tr>`).join("")
    : `<tr><td colspan="4" class="td-empty text-center" style="font-style:italic; color:#808080;">Sin materiales registrados.</td></tr>`;

  // Work orders don't always have photos directly mapped as 'photo_url' like assets do in this mockup,
  // but if they do, we'd place it. Assuming none for now, but keeping the structure.
  const photoEvidenceHtml = `
      <div class="photo-grid">
        <div class="photo-col">
          <div class="photo-title">ESTADO INICIAL (ANTES)</div>
          <div class="photo-frame">
            <span class="photo-empty">Sin registro fotográfico adjunto</span>
          </div>
        </div>
        <div class="photo-col">
          <div class="photo-title">ESTADO FINAL (DESPUÉS)</div>
          <div class="photo-frame">
            <span class="photo-empty">Sin registro fotográfico adjunto</span>
          </div>
        </div>
      </div>
  `;

  const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Informe Técnico OT — ${order.code} | Incalpaca FM</title>
  <style>
    ${getIncalpacaReportCSS()}
  </style>
</head>
<body>
<div class="main-report">

  <!-- 1. ENCABEZADO INSTITUCIONAL -->
  <div class="page-header">
    <div class="logo-area">
      ${INCALPACA_LOGO_SVG}
      <div class="company-block">
        <div class="company-name">INCALPACA FM S.A.</div>
        <div class="company-subtitle">Sistema de Gestión Técnica y Facility Management</div>
        <div class="report-name">INFORME TÉCNICO DE ORDEN N° ${order.code}</div>
      </div>
    </div>
    <div class="header-right">
      <span>Fecha de Emisión: ${nowStr}</span><br/>
      <span>Estado de Orden: <strong>${order.status || "—"}</strong></span><br/>
      <span>Tipo: ${order.orderTypeLabel || "MANTENIMIENTO"}</span>
    </div>
  </div>

  <!-- 2. IDENTIFICACIÓN DEL DOCUMENTO -->
  <div class="section-block">
    <div class="section-heading">1. DATOS DE IDENTIFICACIÓN Y UBICACIÓN DEL BIEN</div>
    <table class="data-table">
      <tbody>
        <tr>
          <td class="label">Código de Orden:</td>
          <td class="value">${order.code}</td>
          <td class="label">Solicitud Origen:</td>
          <td class="value">${order.incidentCode || "Directa"}</td>
        </tr>
        <tr>
          <td class="label">Bien / Activo:</td>
          <td class="value">${order.assetDisplayCode || order.assetCode || "Sin bien asignado"}</td>
          <td class="label">Ubicación Física:</td>
          <td class="value">${order.specificLocation || order.zone || "Planta Incalpaca"}</td>
        </tr>
        <tr>
          <td class="label">Técnico Responsable:</td>
          <td class="value">${order.operatorName || "Sin asignar"}</td>
          <td class="label">Supervisor Asignado:</td>
          <td class="value">Área de Mantenimiento FM</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- 3. DESCRIPCIÓN -->
  <div class="section-block">
    <div class="section-heading">2. DESCRIPCIÓN Y FALLA REPORTADA</div>
    <table class="data-table">
      <tbody>
        <tr>
          <td class="value" style="width:100%;">
            ${order.description || "Sin descripción registrada."}
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- 4. JORNADAS -->
  <div class="section-block">
    <div class="section-heading">3. PROGRAMACIÓN Y REGISTRO DE CRONOGRAMA</div>
    <table class="data-table">
      <tbody>
        <tr>
          <td class="label">Inicio Registrado:</td>
          <td class="value">${formatDateLong(order.createdAt)}</td>
          <td class="label">Horas Efectivas Totales:</td>
          <td class="value">${formatHours(totalWorkedMinutes)}</td>
        </tr>
      </tbody>
    </table>
    <br>
    <table class="records-table">
      <thead>
        <tr>
          <th>Sesión / Tramo</th>
          <th>Inicio de Jornada</th>
          <th>Fin / Cierre de Jornada</th>
          <th>Duración</th>
        </tr>
      </thead>
      <tbody>
        ${sessionRows}
      </tbody>
    </table>
  </div>

  <!-- 5. EVIDENCIAS -->
  <div class="section-block" style="page-break-inside: avoid; break-inside: avoid;">
    <div class="section-heading">4. EVIDENCIAS Y REGISTRO FOTOGRÁFICO</div>
    ${photoEvidenceHtml}
  </div>

  <!-- 6. MATERIALES -->
  <div class="section-block">
    <div class="section-heading">5. MATERIALES E INSUMOS UTILIZADOS</div>
    <table class="records-table">
      <thead>
        <tr>
          <th>Material / Insumo</th>
          <th class="text-center">Cantidad</th>
          <th>Unidad</th>
          <th>Observaciones</th>
        </tr>
      </thead>
      <tbody>
        ${materialRows}
      </tbody>
    </table>
  </div>

  <!-- 7. COSTOS -->
  <div class="section-block">
    <div class="section-heading">6. CONSOLIDADO DE COSTOS OPERATIVOS</div>
    <table class="records-table">
      <thead>
        <tr>
          <th>Categoría</th>
          <th>Descripción del Concepto / Insumo</th>
          <th class="text-center">Cant.</th>
          <th class="text-right">Monto (S/)</th>
        </tr>
      </thead>
      <tbody>
        ${costRows}
        ${costs.length > 0 ? `
        <tr class="total-row">
          <td colspan="3" class="text-right">TOTAL GENERAL</td>
          <td class="text-right">S/ ${totalCost.toFixed(2)}</td>
        </tr>` : ""}
      </tbody>
    </table>
  </div>

  <!-- 8. QR Y TRAZABILIDAD -->
  <div class="section-block">
    <div class="section-heading">7. CÓDIGO DE VERIFICACIÓN Y TRAZABILIDAD</div>
    <div class="qr-block">
      <div class="qr-cell">
        <img src="${qrDataUrl}" alt="QR">
        <span>Escanear para verificar</span>
      </div>
      <div class="qr-info">
        <table class="data-table">
          <tbody>
            <tr>
              <td class="label" style="width:30%">URL Pública:</td>
              <td class="value">${publicUrl}</td>
            </tr>
            <tr>
              <td class="label" style="width:30%">Normas:</td>
              <td class="value">APA 7 · ISO 55000 · EN 13460</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- 9. FIRMAS -->
  <div class="signatures-block">
    <div class="sig-cell">
      <div class="sig-line"></div>
      <div class="sig-role">Técnico Responsable</div>
      <div class="sig-name">${order.operatorName || "_______________"}</div>
    </div>
    <div class="sig-cell">
      <div class="sig-line"></div>
      <div class="sig-role">V°B° Supervisor / Administración</div>
      <div class="sig-name">Control FM Incalpaca</div>
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

  if (action === "download") {
    const printWin = window.open("", "_blank");
    if (printWin) {
      printWin.document.write(htmlContent);
      printWin.document.close();
    }
    return;
  }

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
}
