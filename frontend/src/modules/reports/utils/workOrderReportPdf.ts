import QRCode from "qrcode";
import type { WorkOrder } from "@/modules/workorders/types";
import type { WorkOrderCost } from "@/modules/workorders/workOrderRepository";
import type { WorkOrderMaterial } from "@/modules/workorders/workOrderMaterialRepository";

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
    width: 180,
    color: { dark: "#111111", light: "#ffffff" },
  });

  const totalCost = costs.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalWorkedMinutes = (order.workSessions ?? []).reduce((total, session) => {
    const startedAt = new Date(session.startAt).getTime();
    const endedAt = session.endAt ? new Date(session.endAt).getTime() : Date.now();
    return total + Math.max(0, Math.round((endedAt - startedAt) / 60000));
  }, order.effectiveWorkMinutes ?? 0);

  const styleHtml = `
    <style>
      @page {
        size: A4;
        margin: 20mm 20mm 20mm 20mm;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        padding: 0;
        font-family: "Times New Roman", Times, Georgia, serif;
        font-size: 11pt;
        line-height: 1.6;
        color: #111111;
        background: #ffffff;
      }
      .apa-running-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid #111111;
        padding-bottom: 6px;
        margin-bottom: 24px;
        font-size: 9pt;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .apa-running-head strong {
        font-weight: bold;
      }
      .apa-header-table {
        width: 100%;
        margin-bottom: 24px;
        border-collapse: collapse;
      }
      .apa-header-table td {
        vertical-align: top;
      }
      .logo-box {
        width: 60px;
      }
      .title-box {
        padding-left: 12px;
      }
      .title-box h1 {
        font-size: 16pt;
        font-weight: bold;
        margin: 0 0 4px 0;
        text-transform: uppercase;
        letter-spacing: -0.5px;
      }
      .title-box p {
        margin: 0;
        font-size: 10pt;
        color: #444444;
      }
      .meta-box {
        text-align: right;
        font-size: 9.5pt;
      }
      .apa-section-heading {
        font-size: 12pt;
        font-weight: bold;
        border-bottom: 1px solid #111111;
        padding-bottom: 3px;
        margin-top: 22px;
        margin-bottom: 10px;
        text-transform: uppercase;
      }
      .apa-grid-2 {
        display: table;
        width: 100%;
        margin-bottom: 12px;
      }
      .apa-col {
        display: table-cell;
        width: 50%;
        vertical-align: top;
        padding-right: 10px;
      }
      .apa-col:last-child {
        padding-right: 0;
        padding-left: 10px;
      }
      .apa-card {
        border: 1px solid #cccccc;
        padding: 10px 12px;
        margin-bottom: 10px;
        border-radius: 2px;
      }
      .apa-card dt {
        font-size: 8.5pt;
        text-transform: uppercase;
        font-weight: bold;
        color: #555555;
      }
      .apa-card dd {
        margin: 2px 0 0 0;
        font-size: 10.5pt;
        font-weight: bold;
      }
      table.apa-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 10px;
        margin-bottom: 16px;
        font-size: 10pt;
      }
      table.apa-table th {
        background: #111111;
        color: #ffffff;
        text-align: left;
        padding: 6px 8px;
        font-size: 9pt;
        text-transform: uppercase;
      }
      table.apa-table td {
        padding: 6px 8px;
        border-bottom: 1px solid #e0e0e0;
      }
      .apa-footer {
        margin-top: 40px;
        padding-top: 10px;
        border-top: 1px solid #111111;
        display: flex;
        justify-content: space-between;
        font-size: 8.5pt;
        color: #555555;
      }
      .signatures {
        margin-top: 50px;
        display: table;
        width: 100%;
        text-align: center;
      }
      .sig-col {
        display: table-cell;
        width: 50%;
        vertical-align: bottom;
      }
      .sig-line {
        border-top: 1px solid #111111;
        width: 70%;
        margin: 0 auto 6px auto;
      }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    </style>
  `;

  const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Informe Técnico APA - ${order.code}</title>
  ${styleHtml}
</head>
<body>
  <div class="apa-running-head">
    <span>INFORME TÉCNICO OFICIAL — FORMATO APA EN 60204-1</span>
    <strong>CÓDIGO: ${order.code}</strong>
  </div>

  <table class="apa-header-table">
    <tr>
      <td class="logo-box">
        <svg width="46" height="46" viewBox="0 0 100 100" fill="none">
          <rect x="10" y="10" width="35" height="35" fill="#111111" />
          <rect x="55" y="10" width="35" height="35" fill="#111111" />
          <rect x="10" y="55" width="35" height="35" fill="#111111" />
        </svg>
      </td>
      <td class="title-box">
        <h1>INCALPACA FM S.A.</h1>
        <p>Informe Técnico de Mantenimiento y Control Operativo</p>
      </td>
      <td class="meta-box">
        <strong>${order.code}</strong><br/>
        Fecha: ${formatDateLong(order.createdAt)}<br/>
        Estado: <strong>${order.status}</strong>
      </td>
    </tr>
  </table>

  <div class="apa-section-heading">1. Identificación del Trabajo y Activo Atendido</div>
  <div class="apa-grid-2">
    <div class="apa-col">
      <div class="apa-card">
        <dt>Bien / Activo Afectado</dt>
        <dd>${order.assetDisplayCode || order.assetCode || "Sin bien asignado"}</dd>
      </div>
      <div class="apa-card">
        <dt>Ubicación / Área</dt>
        <dd>${order.specificLocation || order.zone || "Planta Principal"}</dd>
      </div>
    </div>
    <div class="apa-col">
      <div class="apa-card">
        <dt>Técnico Principal</dt>
        <dd>${order.operatorName || "Sin asignar"}</dd>
      </div>
      <div class="apa-card">
        <dt>Tipo de Mantenimiento</dt>
        <dd>${order.orderTypeLabel || "Correctivo"}</dd>
      </div>
    </div>
  </div>

  <div class="apa-section-heading">2. Resumen Técnico del Trabajo Realizado</div>
  <div class="apa-card" style="margin-bottom: 16px;">
    <dt>Descripción del Requerimiento / Falla Reportada</dt>
    <dd style="font-weight: normal; font-size: 10pt;">${order.description || "Sin descripción registrada"}</dd>
  </div>

  <div class="apa-section-heading">3. Trazabilidad de Jornadas y Horas Efectivas</div>
  <table class="apa-table">
    <thead>
      <tr>
        <th>Sesión / Tramo</th>
        <th>Inicio</th>
        <th>Fin / Cierre</th>
        <th>Duración</th>
      </tr>
    </thead>
    <tbody>
      ${
        (order.workSessions ?? []).length > 0
          ? (order.workSessions ?? []).map((session, index) => {
              const start = new Date(session.startAt).getTime();
              const end = session.endAt ? new Date(session.endAt).getTime() : Date.now();
              const mins = Math.max(0, Math.round((end - start) / 60000));
              return `
                <tr>
                  <td><strong>Sesión #${index + 1}</strong></td>
                  <td>${formatDateLong(session.startAt)}</td>
                  <td>${session.endAt ? formatDateLong(session.endAt) : "En ejecución"}</td>
                  <td>${formatHours(mins)}</td>
                </tr>
              `;
            }).join("")
          : `<tr><td colspan="4" style="text-align: center; color: #666;">Registradas ${formatHours(totalWorkedMinutes)} en jornada acumulada.</td></tr>`
      }
    </tbody>
  </table>

  <div class="apa-section-heading">4. Consolidado de Materiales y Costos Operativos</div>
  <table class="apa-table">
    <thead>
      <tr>
        <th>Categoría</th>
        <th>Descripción / Material</th>
        <th>Cantidad</th>
        <th>Importe</th>
      </tr>
    </thead>
    <tbody>
      ${
        costs.length > 0
          ? costs.map(item => `
            <tr>
              <td><strong>${item.categoryLabel}</strong></td>
              <td>${item.description}</td>
              <td>1</td>
              <td>S/ ${Number(item.amount || 0).toFixed(2)}</td>
            </tr>
          `).join("")
          : `<tr><td colspan="4" style="text-align: center; color: #666;">Sin costos registrados en este informe.</td></tr>`
      }
    </tbody>
  </table>

  <div style="text-align: right; font-size: 11pt; font-weight: bold; margin-bottom: 20px;">
    Costo Total Acumulado: S/ ${totalCost.toFixed(2)}
  </div>

  <div class="signatures">
    <div class="sig-col">
      <div class="sig-line"></div>
      <strong>${order.operatorName || "Técnico Responsable"}</strong><br/>
      <span style="font-size: 9pt; color: #555;">Firma Técnico Ejecutor</span>
    </div>
    <div class="sig-col">
      <div class="sig-line"></div>
      <strong>Control Operativo FM</strong><br/>
      <span style="font-size: 9pt; color: #555;">V°B° Supervisión Incalpaca</span>
    </div>
  </div>

  <div class="apa-footer">
    <span>Documento generado con norma APA e ISO 55000 — SGTB Incalpaca FM</span>
    <span>Página 1 de 1</span>
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
    const blob = new Blob([htmlContent], { type: "text/html" });
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `Informe-APA-${order.code}.html`;
    link.click();
    URL.revokeObjectURL(blobUrl);

    // También abre la vista impresa en nueva ventana
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
