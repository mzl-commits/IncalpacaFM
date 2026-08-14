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
    : `<tr><td colspan="4" class="td-empty">Tiempo acumulado total: ${formatHours(totalWorkedMinutes)}</td></tr>`;

  // Rows de costos
  const costRows = costs.length > 0
    ? costs.map(item => `
        <tr>
          <td><strong>${item.categoryLabel}</strong></td>
          <td>${item.description}</td>
          <td style="text-align:center;">1</td>
          <td style="text-align:right; font-weight:700;">S/ ${Number(item.amount || 0).toFixed(2)}</td>
        </tr>`).join("")
    : `<tr><td colspan="4" class="td-empty">Sin costos registrados en esta orden de trabajo.</td></tr>`;

  // Rows de materiales
  const materialRows = materials.length > 0
    ? materials.map(m => `
        <tr>
          <td><strong>${m.name || m.description || "—"}</strong></td>
          <td style="text-align:center;">${m.quantity ?? 1}</td>
          <td>${m.unit || "Unid."}</td>
          <td>${m.notes || "—"}</td>
        </tr>`).join("")
    : `<tr><td colspan="4" class="td-empty">Sin materiales registrados.</td></tr>`;

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

  <!-- ENCABEZADO INSTITUCIONAL -->
  <div class="page-header">
    <div class="logo-area">
      ${INCALPACA_LOGO_SVG}
      <div class="company-block">
        <div class="company-name">Incalpaca FM S.A.</div>
        <div class="company-subtitle">Sistema de Gestión Técnica y Bienes</div>
        <div class="company-subtitle" style="letter-spacing:0.5px; margin-top:2px;">Facilidades y Mantenimiento Corporativo</div>
      </div>
    </div>
    <div class="header-right">
      <span class="doc-code">${order.code}</span>
      <span>Emitido: ${nowStr}</span><br/>
      <span>Estado: <strong>${order.status || "—"}</strong></span><br/>
      <span>Tipo: ${order.orderTypeLabel || "Correctivo"}</span>
    </div>
  </div>

  <!-- TÍTULO DEL DOCUMENTO -->
  <div class="doc-title-block">
    <h1>Informe Técnico de Orden de Trabajo</h1>
    <div class="doc-meta">
      Orden N.° <strong>${order.code}</strong> &nbsp;·&nbsp;
      Fecha de registro: <strong>${formatDateLong(order.createdAt)}</strong> &nbsp;·&nbsp;
      Técnico responsable: <strong>${order.operatorName || "Sin asignar"}</strong>
    </div>
  </div>

  <!-- SECCIÓN 1: IDENTIFICACIÓN -->
  <div class="section-heading">1. Identificación del Trabajo y Activo Atendido</div>
  <div class="grid-2">
    <div class="grid-col">
      <div class="fact-card">
        <dt>Bien / Activo Afectado</dt>
        <dd>${order.assetDisplayCode || order.assetCode || "Sin bien asignado"}</dd>
      </div>
      <div class="fact-card">
        <dt>Ubicación / Área de Trabajo</dt>
        <dd>${order.specificLocation || order.zone || "Planta Principal Incalpaca"}</dd>
      </div>
      <div class="fact-card">
        <dt>Tipo de Mantenimiento</dt>
        <dd>${order.orderTypeLabel || "Correctivo"}</dd>
      </div>
    </div>
    <div class="grid-col">
      <div class="fact-card">
        <dt>Técnico Principal Ejecutor</dt>
        <dd>${order.operatorName || "Sin asignar"}</dd>
      </div>
      <div class="fact-card">
        <dt>Fecha de Inicio</dt>
        <dd>${formatDateLong(order.createdAt)}</dd>
      </div>
      <div class="fact-card">
        <dt>Horas Efectivas Totales</dt>
        <dd>${formatHours(totalWorkedMinutes)}</dd>
      </div>
    </div>
  </div>

  <!-- SECCIÓN 2: DESCRIPCIÓN / FALLA -->
  <div class="section-heading">2. Descripción del Requerimiento y Falla Reportada</div>
  <div class="description-block">
    ${order.description || "Sin descripción registrada para esta orden de trabajo."}
  </div>

  <!-- SECCIÓN 3: JORNADAS -->
  <div class="section-heading">3. Trazabilidad de Jornadas y Horas Efectivas</div>
  <table class="report-table">
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
    <tfoot>
      <tr style="background:#eeeeee;">
        <td colspan="3" style="text-align:right; font-weight:700; padding:7px 10px;">Total horas efectivas acumuladas:</td>
        <td style="font-weight:700; padding:7px 10px;">${formatHours(totalWorkedMinutes)}</td>
      </tr>
    </tfoot>
  </table>

  <!-- SECCIÓN 4: MATERIALES -->
  <div class="section-heading">4. Materiales e Insumos Utilizados</div>
  <table class="report-table">
    <thead>
      <tr>
        <th>Material / Insumo</th>
        <th style="text-align:center;">Cantidad</th>
        <th>Unidad</th>
        <th>Observaciones</th>
      </tr>
    </thead>
    <tbody>
      ${materialRows}
    </tbody>
  </table>

  <!-- SECCIÓN 5: COSTOS -->
  <div class="section-heading">5. Consolidado de Costos Operativos</div>
  <table class="report-table">
    <thead>
      <tr>
        <th>Categoría</th>
        <th>Descripción</th>
        <th style="text-align:center;">Cant.</th>
        <th style="text-align:right;">Importe (S/)</th>
      </tr>
    </thead>
    <tbody>
      ${costRows}
    </tbody>
  </table>
  ${costs.length > 0 ? `
  <div class="total-row">
    <span>Costo Total Acumulado de la Orden:</span>
    <span>S/ ${totalCost.toFixed(2)}</span>
  </div>` : ""}

  <!-- SECCIÓN 6: QR Y VERIFICACIÓN -->
  <div class="section-heading">6. Código de Verificación y Trazabilidad</div>
  <div style="display:table; width:100%; margin-bottom:10px;">
    <div style="display:table-cell; vertical-align:middle; width:130px; text-align:center;">
      <img src="${qrDataUrl}" alt="Código QR de verificación" style="width:110px;height:110px;display:block;margin:0 auto 4px;border:1px solid #dedede;"/>
      <span style="font-size:8pt;color:#777777;">Escanear para verificar</span>
    </div>
    <div style="display:table-cell; vertical-align:middle; padding-left:20px;">
      <div class="fact-card" style="margin-bottom:6px;">
        <dt>URL de Verificación Pública</dt>
        <dd class="normal" style="font-size:9.5pt; word-break:break-all;">${publicUrl}</dd>
      </div>
      <div class="fact-card">
        <dt>Normas de Referencia</dt>
        <dd class="normal" style="font-size:9.5pt;">APA 7 · ISO 55000 · EN 13460 · DS 005-2012-TR</dd>
      </div>
    </div>
  </div>

  <!-- FIRMAS -->
  <div class="signatures-block">
    <div class="sig-cell">
      <div class="sig-line"></div>
      <div class="sig-name">${order.operatorName || "Técnico Responsable"}</div>
      <div class="sig-role">Firma del Técnico Ejecutor</div>
    </div>
    <div class="sig-cell">
      <div class="sig-line"></div>
      <div class="sig-name">Control Operativo FM</div>
      <div class="sig-role">V°B° Supervisión — Incalpaca FM S.A.</div>
    </div>
  </div>

  <!-- PIE DE PÁGINA -->
  <div class="page-footer">
    <span>SGTB Incalpaca FM — Documento Técnico Oficial · ${nowStr}</span>
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
