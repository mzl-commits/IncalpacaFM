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

  // MATRIZ DE 9 NIVELES SEGÚN ESPECIFICACIÓN TÉCNICA INSTITUCIONAL
  const n1Code = (payload.n1_code as string) || (payload.site_code as string) || "INC1";
  const n1Name = (payload.site as string) || "INCALPACA – SEDE PRINCIPAL";

  const n2Code = (payload.n2_code as string) || (payload.macro_area_code as string) || "ADC";
  const n2Name = (payload.macro_area as string) || "SECTOR ADMINISTRATIVO – CASONA";

  const n3Code = (payload.n3_code as string) || (payload.building_code as string) || (payload.area_code as string) || "MKT";
  const n3Name = asset.location_detail?.area || (payload.area as string) || (payload.building as string) || "COWORKING – PARKING";

  const n4Code = (payload.n4_code as string) || (payload.room_code as string) || "MT04";
  const n4Name = asset.location_detail?.room || asset.location_detail?.specific_location || (payload.room as string) || "MÓDULO DE TRABAJO 4";

  const n5Code = (payload.n5_code as string) || (payload.family_code as string) || "MOB";
  const n5Name = asset.taxonomy_detail?.category || (payload.family as string) || "MOBILIARIO";

  const n6Code = (payload.n6_code as string) || (payload.type_code as string) || asset.taxonomy_detail?.prefix || "SE";
  const n6Name = asset.taxonomy_detail?.subcategory || asset.taxonomy_detail?.name || asset.name || "SILLA ERGONÓMICA TIPO 1";

  const n7Code = (payload.n7_code as string) || (payload.part_code as string) || "BA";
  const n7Name = (payload.part as string) || (payload.partName as string) || "BASE GIRATORIA";

  const n8Code = (payload.n8_code as string) || (payload.piece_code as string) || "GA";
  const n8Name = (payload.piece as string) || (payload.pieceName as string) || "GARRUCHA";

  const rawSku = (payload.n9_code as string) || (payload.sku as string) || (payload.skuCode as string) || displayCode || "SKU 40";
  const n9Code = rawSku.startsWith("SKU") ? rawSku : `SKU ${rawSku}`;

  // CADENA MATRIZ COMPLETA DE 9 NIVELES: N1 - N2 - N3 - N4 - N5 - N6 - N7 - N8 - N9
  const fullMatrixCode = `${n1Code} - ${n2Code} - ${n3Code} - ${n4Code} - ${n5Code} - ${n6Code} - ${n7Code} - ${n8Code} - ${n9Code}`;

  // CUSTODIA Y RESPONSABLE
  const responsibleName = activeResponsible?.responsible 
    || (payload.responsibleName as string) 
    || (payload.responsible as string) 
    || "ROSA MEDINA GUTIÉRREZ";

  const workerCode = (activeResponsible as unknown as { worker_code?: string; workerCode?: string })?.worker_code
    || (activeResponsible as unknown as { worker_code?: string; workerCode?: string })?.workerCode
    || (payload.workerCode as string)
    || "TRAB-4082";

  const costCenter = (activeResponsible as unknown as { cost_center?: string; costCenter?: string })?.cost_center
    || (activeResponsible as unknown as { cost_center?: string; costCenter?: string })?.costCenter
    || (payload.costCenter as string)
    || "CC-1040 (ADMINISTRACIÓN & MKT)";

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
  <title>Ficha Técnica — ${n9Code} | Incalpaca FM</title>
  <style>
    ${getIncalpacaReportCSS()}
    .code-banner-box {
      border: 1px solid #000000;
      background-color: #FFFFFF;
      padding: 8pt 12pt;
      margin-top: 8pt;
      margin-bottom: 12pt;
      text-align: center;
      font-family: "Times New Roman", Times, serif;
      font-size: 11pt;
      font-weight: bold;
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
        <div class="report-name">FICHA TÉCNICA DE IDENTIFICACIÓN Y ASIGNACIÓN</div>
      </div>
    </div>
    <div class="header-right">
      <span>Fecha de Emisión: ${nowStr}</span><br/>
      <span>Estado Operativo: <strong>${conditionLabel(asset.condition)}</strong></span><br/>
      <span>SKU: <strong>${n9Code}</strong></span>
    </div>
  </div>

  <!-- SECCIÓN 1: IDENTIFICACIÓN, UBICACIÓN Y TAXONOMÍA DEL MOBILIARIO -->
  <div class="section-block">
    <div class="section-heading">1. IDENTIFICACIÓN, UBICACIÓN Y ESTRUCTURA TAXONÓMICA</div>
    <table class="data-table">
      <tbody>
        <tr>
          <td class="label" style="width:25%">1. SEDE / COMPLEJO:</td>
          <td class="value" style="width:25%"><strong>${n1Code}</strong> — ${n1Name}</td>
          <td class="label" style="width:25%">2. ÁREA MACRO:</td>
          <td class="value" style="width:25%"><strong>${n2Code}</strong> — ${n2Name}</td>
        </tr>
        <tr>
          <td class="label">3. SECTOR / ZONA:</td>
          <td class="value"><strong>${n3Code}</strong> — ${n3Name}</td>
          <td class="label">4. MÓDULO / AMBIENTE:</td>
          <td class="value"><strong>${n4Code}</strong> — ${n4Name}</td>
        </tr>
        <tr>
          <td class="label">5. FAMILIA TAXONÓMICA:</td>
          <td class="value"><strong>${n5Code}</strong> — ${n5Name}</td>
          <td class="label">6. TIPO DE MOBILIARIO:</td>
          <td class="value"><strong>${n6Code}</strong> — ${n6Name}</td>
        </tr>
        <tr>
          <td class="label">7. PARTE / COMPONENTE:</td>
          <td class="value"><strong>${n7Code}</strong> — ${n7Name}</td>
          <td class="label">8. PIEZA / ELEMENTO:</td>
          <td class="value"><strong>${n8Code}</strong> — ${n8Name}</td>
        </tr>
        <tr>
          <td class="label">9. SKU / CÓDIGO BIEN:</td>
          <td class="value" colspan="3"><strong>${n9Code}</strong> — Identificador de Inventario</td>
        </tr>
      </tbody>
    </table>

    <div class="code-banner-box">
      "${fullMatrixCode}"
    </div>
  </div>

  <!-- SECCIÓN 2: CUSTODIA Y RESPONSABLE -->
  <div class="section-block">
    <div class="section-heading">2. CUSTODIA Y ASIGNACIÓN DE PERSONAL</div>
    <table class="data-table">
      <tbody>
        <tr>
          <td class="label" style="width:25%">RESPONSABLE ASIGNADO:</td>
          <td class="value" style="width:25%"><strong>${responsibleName}</strong></td>
          <td class="label" style="width:25%">CÓDIGO DE TRABAJADOR:</td>
          <td class="value" style="width:25%"><strong>${workerCode}</strong></td>
        </tr>
        <tr>
          <td class="label">CENTRO DE COSTO:</td>
          <td class="value"><strong>${costCenter}</strong></td>
          <td class="label">ESTADO DE ASIGNACIÓN:</td>
          <td class="value">${asset.assignment_status || "Vigente"}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- SECCIÓN 3: ESPECIFICACIONES TÉCNICAS -->
  <div class="section-block">
    <div class="section-heading">3. ESPECIFICACIONES TÉCNICAS Y CONDICIÓN</div>
    <table class="data-table">
      <tbody>
        <tr>
          <td class="label">Marca / Modelo:</td>
          <td class="value">${[asset.brand, asset.model].filter(Boolean).join(" — ") || "Forma — ErgoMax 2026"}</td>
          <td class="label">Número de Serie:</td>
          <td class="value">${asset.serial_number || "SN-MOB-2026-0040"}</td>
        </tr>
        <tr>
          <td class="label">Condición Operativa:</td>
          <td class="value">${conditionLabel(asset.condition)}</td>
          <td class="label">Criticidad:</td>
          <td class="value">${asset.criticality || "Media"}</td>
        </tr>
        <tr>
          <td class="label">Descripción Técnica:</td>
          <td class="value" colspan="3">${asset.description || "Sin descripción técnica registrada."}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- SECCIÓN 4: EVIDENCIAS FOTOGRÁFICAS -->
  <div class="section-block" style="page-break-inside: avoid; break-inside: avoid;">
    <div class="section-heading">4. REGISTRO FOTOGRÁFICO Y EVIDENCIAS DE CAMPO</div>
    ${photoEvidenceHtml}
  </div>

  <!-- SECCIÓN 5: HISTORIAL DE CUSTODIA -->
  <div class="section-block">
    <div class="section-heading">5. HISTORIAL DE CUSTODIA Y RESPONSABLES</div>
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

  <!-- SECCIÓN 6: HISTORIAL DE MANTENIMIENTO -->
  <div class="section-block">
    <div class="section-heading">6. HISTORIAL DE MANTENIMIENTO Y ATENCIONES REGISTRADAS</div>
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

  <!-- SECCIÓN 7: TRAZABILIDAD DIGITAL -->
  <div class="section-block">
    <div class="section-heading">7. CÓDIGO DE VERIFICACIÓN Y TRAZABILIDAD DIGITAL</div>
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
