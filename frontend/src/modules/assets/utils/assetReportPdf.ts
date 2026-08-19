import QRCode from "qrcode";
import type { AssetDetailRecord } from "../assetDetailRepository";
import { INCALPACA_LOGO_SVG, getIncalpacaReportCSS } from "@/modules/reports/utils/incalpacaReportStyles";

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "Fecha no registrada";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function conditionLabel(val?: string | null) {
  const map: Record<string, string> = {
    BUENO: "Bueno",
    REGULAR: "Regular",
    MALO: "Malo",
    NUEVO: "Nuevo",
    EN_REPARACION: "En reparación",
    DADO_DE_BAJA: "Dado de baja",
  };
  return val ? (map[val] ?? val) : "No registrado";
}

function statusLabel(val?: string | null) {
  const map: Record<string, string> = {
    ACTIVA: "Activa",
    INACTIVA: "Inactiva",
    PENDIENTE: "Pendiente",
    COMPLETADA: "Completada",
  };
  return val ? (map[val] ?? val) : "—";
}

export async function generateAssetApaPdf({
  asset,
  action = "print",
}: {
  asset: AssetDetailRecord;
  action?: "download" | "print";
}) {
  const publicUrl = asset.public_url || `${window.location.origin}/bienes/${asset.id}`;
  const qrDataUrl = await QRCode.toDataURL(publicUrl, {
    margin: 1,
    width: 200,
    color: { dark: "#111111", light: "#ffffff" },
  });

  const displayCode = asset.display_code || asset.fm_code || asset.code;
  const nowStr = formatDate(new Date().toISOString());

  const payload = (asset as unknown as { entry_payload?: Record<string, unknown> }).entry_payload || {};

  const activeResponsible = asset.responsible_history?.find(r => r.status === "ACTIVA")
    ?? asset.responsible_history?.[0]
    ?? null;

  // Campos específicos de identificación y jerarquía para Mobiliario / Bienes
  const siteStr = (payload.site as string) || "INCALPACA – SEDE PRINCIPAL";
  const buildingStr = asset.location_detail?.building || (payload.building as string) || (payload.zone as string) || "SECTOR ADMINISTRATIVO – CASONA";
  const areaStr = asset.location_detail?.area || (payload.area as string) || "COWORKING MARKETING";
  const roomStr = asset.location_detail?.room || asset.location_detail?.specific_location || (payload.room as string) || "MÓDULO DE TRABAJO 4";

  const familyStr = asset.taxonomy_detail?.category || (payload.family as string) || (payload.assetType as string) || "MOBILIARIO";
  const typeStr = asset.taxonomy_detail?.subcategory || asset.taxonomy_detail?.name || asset.name || "SILLA ERGONÓMICA TIPO 1";
  const partStr = (payload.part as string) || (payload.partName as string) || "BASE GIRATORIA";
  const pieceStr = (payload.piece as string) || (payload.pieceName as string) || "GARRUCHA";
  const skuCode = (payload.sku as string) || (payload.skuCode as string) || displayCode || "SKU 40";

  const responsibleName = activeResponsible?.responsible || (payload.responsibleName as string) || (payload.responsible as string) || "RESPONSABLE ASIGNADO";
  const workerCode = (activeResponsible as unknown as { worker_code?: string; workerCode?: string })?.worker_code
    || (activeResponsible as unknown as { worker_code?: string; workerCode?: string })?.workerCode
    || (payload.workerCode as string)
    || "CÓDIGO DE TRABAJADOR";
  const costCenter = (activeResponsible as unknown as { cost_center?: string; costCenter?: string })?.cost_center
    || (activeResponsible as unknown as { cost_center?: string; costCenter?: string })?.costCenter
    || (payload.costCenter as string)
    || "CENTRO DE COSTO";

  // Cadena Estructural Integrada de Trazabilidad
  const structuralChain = `${siteStr} › ${buildingStr} › ${areaStr} › ${roomStr} › ${familyStr} › ${typeStr} › ${partStr} › ${pieceStr} › ${skuCode}`;

  // Tabla de responsables
  const responsibleRows = (asset.responsible_history?.length ?? 0) > 0
    ? asset.responsible_history.map(r => `
        <tr>
          <td><strong>${r.responsible}</strong></td>
          <td>${r.area || "—"}</td>
          <td>${formatDate(r.start_date)}</td>
          <td>${r.end_date ? formatDate(r.end_date) : "<em>Vigente</em>"}</td>
          <td>${statusLabel(r.status)}</td>
          <td>${r.reason || "Asignación técnica"}</td>
        </tr>`).join("")
    : `<tr><td colspan="6" class="td-empty text-center" style="font-style:italic; color:#808080;">Sin historial de custodia registrado.</td></tr>`;

  // Tabla de mantenimientos
  const repairRows = (asset.repair_history?.length ?? 0) > 0
    ? asset.repair_history.map(m => `
        <tr>
          <td><strong>${m.work_order}</strong></td>
          <td>${m.type}</td>
          <td style="max-width:180px;">${m.issue || "—"}</td>
          <td>${m.technician_name || "—"}</td>
          <td>${m.resulting_condition || "—"}</td>
          <td style="text-align:right;">${m.cost ? `S/ ${Number(m.cost).toFixed(2)}` : "—"}</td>
        </tr>`).join("")
    : `<tr><td colspan="6" class="td-empty text-center" style="font-style:italic; color:#808080;">Sin historial de mantenimiento registrado.</td></tr>`;

  const photoEvidenceHtml = asset.photo_url
    ? `
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
            <img src="${asset.photo_url}" alt="Estado Final del Bien"/>
          </div>
        </div>
      </div>
    `
    : `
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
  <title>Ficha Técnica — ${displayCode} | Incalpaca FM</title>
  <style>
    ${getIncalpacaReportCSS()}
    .structural-chain-box {
      background-color: #F8F9FA;
      border: 1px solid #A0A0A0;
      border-left: 3px solid #000000;
      padding: 8pt 10pt;
      font-size: 9.5pt;
      font-weight: bold;
      color: #111111;
      margin-top: 8pt;
      margin-bottom: 12pt;
      letter-spacing: 0.2px;
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
        <div class="company-subtitle">Sistema de Gestión Técnica y Bienes</div>
        <div class="report-name">FICHA TÉCNICA OFICIAL N° ${displayCode}</div>
      </div>
    </div>
    <div class="header-right">
      <span>Fecha de Emisión: ${nowStr}</span><br/>
      <span>Estado Operativo: <strong>${conditionLabel(asset.condition)}</strong></span><br/>
      <span>Tipo: FICHA DE MOBILIARIO / BIEN</span>
    </div>
  </div>

  <!-- SECCIÓN 1: IDENTIFICACIÓN Y ESPECIFICACIONES DE CLASIFICACIÓN -->
  <div class="section-block">
    <div class="section-heading">1. DATOS DE IDENTIFICACIÓN Y CLASIFICACIÓN DEL BIEN</div>
    <table class="data-table">
      <tbody>
        <tr>
          <td class="label">Código FM / SKU:</td>
          <td class="value"><strong>${displayCode}</strong> (${skuCode})</td>
          <td class="label">ID Técnico:</td>
          <td class="value">${asset.code}</td>
        </tr>
        <tr>
          <td class="label">Nombre del Activo:</td>
          <td class="value" colspan="3"><strong>${asset.name}</strong></td>
        </tr>
        <tr>
          <td class="label">Familia Taxonómica:</td>
          <td class="value">${familyStr}</td>
          <td class="label">Tipo de Bien:</td>
          <td class="value">${typeStr}</td>
        </tr>
        <tr>
          <td class="label">Parte / Componente:</td>
          <td class="value">${partStr}</td>
          <td class="label">Pieza / Elemento:</td>
          <td class="value">${pieceStr}</td>
        </tr>
        <tr>
          <td class="label">Marca / Modelo:</td>
          <td class="value">${[asset.brand, asset.model].filter(Boolean).join(" — ") || "No registrado"}</td>
          <td class="label">Número de Serie:</td>
          <td class="value">${asset.serial_number || "Sin número de serie"}</td>
        </tr>
        <tr>
          <td class="label">Condición Operativa:</td>
          <td class="value">${conditionLabel(asset.condition)}</td>
          <td class="label">Criticidad:</td>
          <td class="value">${asset.criticality || "Media"}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- SECCIÓN 2: UBICACIÓN ESPACIAL Y CUSTODIA (RESPONSABLE) -->
  <div class="section-block">
    <div class="section-heading">2. UBICACIÓN ESPACIAL Y ASIGNACIÓN DE CUSTODIA</div>
    <table class="data-table">
      <tbody>
        <tr>
          <td class="label">Sede Principal:</td>
          <td class="value">${siteStr}</td>
          <td class="label">Sector / Edificio:</td>
          <td class="value">${buildingStr}</td>
        </tr>
        <tr>
          <td class="label">Área / Zona:</td>
          <td class="value">${areaStr}</td>
          <td class="label">Ambiente / Módulo:</td>
          <td class="value">${roomStr}</td>
        </tr>
        <tr>
          <td class="label">Responsable Asignado:</td>
          <td class="value"><strong>${responsibleName}</strong></td>
          <td class="label">Código Trabajador:</td>
          <td class="value">${workerCode}</td>
        </tr>
        <tr>
          <td class="label">Centro de Costo:</td>
          <td class="value">${costCenter}</td>
          <td class="label">Estado Asignación:</td>
          <td class="value">${asset.assignment_status || "Vigente"}</td>
        </tr>
      </tbody>
    </table>

    <div class="structural-chain-box">
      <strong>CADENA ESTRUCTURAL Y TRAZABILIDAD INTEGRADA:</strong><br/>
      ${structuralChain}
    </div>
  </div>

  <!-- SECCIÓN 3: EVIDENCIAS FOTOGRÁFICAS -->
  <div class="section-block" style="page-break-inside: avoid; break-inside: avoid;">
    <div class="section-heading">3. REGISTRO FOTOGRÁFICO Y EVIDENCIAS</div>
    ${photoEvidenceHtml}
  </div>

  <!-- SECCIÓN 4: HISTORIAL DE CUSTODIA -->
  <div class="section-block">
    <div class="section-heading">4. HISTORIAL DE CUSTODIA Y RESPONSABLES</div>
    <table class="records-table">
      <thead>
        <tr>
          <th>Responsable</th>
          <th>Área</th>
          <th>Fecha Inicio</th>
          <th>Fecha Fin</th>
          <th>Estado</th>
          <th>Motivo</th>
        </tr>
      </thead>
      <tbody>
        ${responsibleRows}
      </tbody>
    </table>
  </div>

  <!-- SECCIÓN 5: HISTORIAL DE MANTENIMIENTO -->
  <div class="section-block">
    <div class="section-heading">5. HISTORIAL DE MANTENIMIENTO Y REPARACIONES</div>
    <table class="records-table">
      <thead>
        <tr>
          <th>N.° Orden</th>
          <th>Tipo</th>
          <th>Problema / Trabajo</th>
          <th>Técnico</th>
          <th>Condición Resultante</th>
          <th class="text-right">Costo</th>
        </tr>
      </thead>
      <tbody>
        ${repairRows}
      </tbody>
    </table>
  </div>

  <!-- SECCIÓN 6: CÓDIGO DE VERIFICACIÓN Y TRAZABILIDAD -->
  <div class="section-block">
    <div class="section-heading">6. CÓDIGO DE VERIFICACIÓN Y TRAZABILIDAD DIGITAL</div>
    <div class="qr-block">
      <div class="qr-cell">
        <img src="${qrDataUrl}" alt="QR">
        <span>Escanear para verificar</span>
      </div>
      <div class="qr-info">
        <table class="data-table">
          <tbody>
            <tr>
              <td class="label" style="width:30%">URL de Verificación:</td>
              <td class="value">${publicUrl}</td>
            </tr>
            <tr>
              <td class="label" style="width:30%">Fecha de Alta:</td>
              <td class="value">${formatDate(asset.created_at)}</td>
            </tr>
            <tr>
              <td class="label" style="width:30%">Normas:</td>
              <td class="value">APA 7 · ISO 55000 · NTP-ISO 55001</td>
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
      <div class="sig-role">Técnico Responsable</div>
      <div class="sig-name">${responsibleName}</div>
    </div>
    <div class="sig-cell">
      <div class="sig-line"></div>
      <div class="sig-role">V°B° Supervisor / Administración</div>
      <div class="sig-name">Control Patrimonial &amp; FM</div>
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
