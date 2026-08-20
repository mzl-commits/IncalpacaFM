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
  return val ? (map[val] ?? val) : "Bueno";
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
  adminName,
}: {
  asset: AssetDetailRecord;
  action?: "download" | "print";
  adminName?: string;
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

  // MATRIZ DE 9 NIVELES SEGÚN ESPECIFICACIÓN
  const n1Code = (payload.n1_code as string) || (payload.site_code as string) || "INC1";
  const n1Name = (payload.site as string) || "INCALPACA (Sede Principal)";

  const n2Code = (payload.n2_code as string) || (payload.macro_area_code as string) || "—";
  const n2Name = (payload.macro_area as string) || "Sectores Administrativos";

  const n3Code = (payload.n3_code as string) || (payload.building_code as string) || (payload.area_code as string) || "—";
  const n3Name = asset.location_detail?.area || (payload.area as string) || (payload.building as string) || "No ubicado";

  const n4Code = (payload.n4_code as string) || (payload.room_code as string) || "—";
  const n4Name = asset.location_detail?.room || asset.location_detail?.specific_location || (payload.room as string) || "No ubicado";

  const n5Code = (payload.n5_code as string) || (payload.family_code as string) || (asset.taxonomy_detail ? "—" : "—");
  const n5Name = asset.taxonomy_detail?.category || (payload.family as string) || "Sin clasificar";

  const n6Code = (payload.n6_code as string) || (payload.type_code as string) || asset.taxonomy_detail?.prefix || "—";
  const n6Name = asset.taxonomy_detail?.subcategory || asset.taxonomy_detail?.name || (payload.type as string) || "Sin clasificar";

  const n7Code = (payload.n7_code as string) || (payload.part_code as string) || "—";
  const n7Name = (payload.part as string) || (payload.partName as string) || "—";

  const n8Code = (payload.n8_code as string) || (payload.piece_code as string) || "—";
  const n8Name = (payload.piece as string) || (payload.pieceName as string) || "—";

  const rawSku = (payload.n9_code as string) || (payload.sku as string) || (payload.skuCode as string) || asset.fm_code || "—";
  let cleanSku = rawSku;
  if (cleanSku !== "—" && cleanSku.includes("-")) {
    const parts = cleanSku.split("-");
    cleanSku = parts[parts.length - 1].trim();
  }
  const n9Code = cleanSku === "—" ? "—" : (cleanSku.toUpperCase().startsWith("SKU") ? cleanSku : `SKU ${cleanSku}`);

  // CADENA MATRIZ COMPLETA DE 9 NIVELES
  const fullMatrixCode = `${n1Code} - ${n2Code} - ${n3Code} - ${n4Code} - ${n5Code} - ${n6Code} - ${n7Code} - ${n8Code} - ${n9Code}`;

  // CUSTODIA Y RESPONSABLE
  const responsibleName = activeResponsible?.responsible 
    || (payload.responsibleName as string) 
    || (payload.responsible as string) 
    || "No asignado";

  const workerCode = (activeResponsible as unknown as { worker_code?: string; workerCode?: string })?.worker_code
    || (activeResponsible as unknown as { worker_code?: string; workerCode?: string })?.workerCode
    || (payload.workerCode as string)
    || "—";

  const costCenter = (activeResponsible as unknown as { cost_center?: string; costCenter?: string })?.cost_center
    || (activeResponsible as unknown as { cost_center?: string; costCenter?: string })?.costCenter
    || (payload.costCenter as string)
    || "—";

  const responsibleRows = (asset.responsible_history?.length ?? 0) > 0
    ? asset.responsible_history.map(r => `
        <tr>
          <td><strong>${r.responsible}</strong></td>
          <td>${r.code || "—"}</td>
          <td>${formatDate(r.start_date)}</td>
          <td>${r.end_date ? formatDate(r.end_date) : "<em>Vigente</em>"}</td>
          <td>${statusLabel(r.status)}</td>
          <td>${r.reason || "Asignación vigente"}</td>
        </tr>`).join("")
    : `<tr><td colspan="6" class="td-empty text-center" style="font-style:italic; color:#808080;">Sin historial de custodia registrado.</td></tr>`;

  const photoEvidenceHtml = asset.photo_url
    ? `
      <div class="photo-grid" style="grid-template-columns: 1fr; max-width: 600px; margin: 0 auto;">
        <div class="photo-col">
          <div class="photo-title">FOTOGRAFÍA DEL BIEN</div>
          <div class="photo-frame" style="height: auto; min-height: 280px; display: flex; align-items: center; justify-content: center;">
            <img src="${asset.photo_url}" alt="Fotografía del Bien" style="max-height: 400px; width: auto;" />
          </div>
        </div>
      </div>
    `
    : `
      <div class="photo-grid" style="grid-template-columns: 1fr; max-width: 600px; margin: 0 auto;">
        <div class="photo-col">
          <div class="photo-title">FOTOGRAFÍA DEL BIEN</div>
          <div class="photo-frame" style="height: 280px;">
            <span class="photo-empty">Sin registro fotográfico adjunto</span>
          </div>
        </div>
      </div>
    `;

  const entryTypeLabel = payload.entryType === "purchase" ? "Compra nueva" : 
                         payload.entryType === "own_creation" ? "Fabricación propia" : 
                         payload.entryType === "donation" ? "Donación" : 
                         payload.entryType === "rental" ? "Alquiler" : "Alta al inventario";
                         
  const entryDateStr = payload.effectiveEntryDate || asset.created_at;
  const assignmentDateStr = activeResponsible?.start_date || "—";
  const registeredByStr = payload.registeredBy || adminName || "—";

  const currentDateStr = new Date().toLocaleDateString("es-PE").replace(/\//g, "-");
  const safeName = asset.name.replace(/[^a-z0-9]/gi, '_');

  const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FT_${safeName}_${currentDateStr}</title>
  <style>
    ${getIncalpacaReportCSS()}
    .matrix-box-container {
      border: 1px solid #000000;
      background-color: #FFFFFF;
      padding: 10pt;
      margin-top: 10pt;
      margin-bottom: 14pt;
    }
    .matrix-box-title {
      font-size: 9.5pt;
      font-weight: bold;
      color: #000000;
      margin-bottom: 6pt;
      text-transform: uppercase;
    }
    .matrix-box-banner {
      background-color: #000000;
      color: #FFFFFF;
      font-family: "Times New Roman", Times, serif;
      font-size: 11pt;
      font-weight: bold;
      padding: 8pt 10pt;
      text-align: center;
      letter-spacing: 0.5px;
    }
    .qr-header {
      display: flex;
      gap: 15px;
      align-items: center;
      text-align: right;
    }
    .qr-header-img {
      width: 75px;
      height: 75px;
      border: 1px solid #000;
      padding: 2px;
      background: #fff;
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
        <div class="report-name">FICHA DE REGISTRO DEL BIEN<br/>MATRIZ 9 NIVELES</div>
      </div>
    </div>
    <div class="header-right qr-header">
      <div style="display: flex; flex-direction: column; gap: 3px;">
        <span>Fecha de Emisión: <strong>${nowStr}</strong></span>
        <span>Código Nivel 9: <strong>${n9Code}</strong></span>
        <span style="font-size: 8pt; color: #555;">Escanear QR para verificar en el sistema</span>
      </div>
      <img class="qr-header-img" src="${qrDataUrl}" alt="QR Code" />
    </div>
  </div>

  <!-- SECCIÓN 1: ESTRUCTURA Y MATRIZ DE 9 NIVELES -->
  <div class="section-block">
    <div class="section-heading">1. ESTRUCTURA Y MATRIZ DE 9 NIVELES (TAXONOMÍA Y UBICACIÓN)</div>
    <table class="data-table">
      <tbody>
        <tr>
          <td class="label" style="width:23%">Nivel 1 (Sede / Complejo):</td>
          <td class="value" style="width:27%"><strong>[${n1Code}]</strong> ${n1Name}</td>
          <td class="label" style="width:23%">Nivel 2 (Área Macro):</td>
          <td class="value" style="width:27%"><strong>[${n2Code}]</strong> ${n2Name}</td>
        </tr>
        <tr>
          <td class="label">Nivel 3 (Zona / Edificio):</td>
          <td class="value"><strong>[${n3Code}]</strong> ${n3Name}</td>
          <td class="label">Nivel 4 (Módulo / Ambiente):</td>
          <td class="value"><strong>[${n4Code}]</strong> ${n4Name}</td>
        </tr>
        <tr>
          <td class="label">Nivel 5 (Familia Taxonómica):</td>
          <td class="value"><strong>[${n5Code}]</strong> ${n5Name}</td>
          <td class="label">Nivel 6 (Tipo de Bien):</td>
          <td class="value"><strong>[${n6Code}]</strong> ${n6Name}</td>
        </tr>
        <tr>
          <td class="label">Nivel 7 (Parte / Componente):</td>
          <td class="value"><strong>[${n7Code}]</strong> ${n7Name}</td>
          <td class="label">Nivel 8 (Pieza / Elemento):</td>
          <td class="value"><strong>[${n8Code}]</strong> ${n8Name}</td>
        </tr>
        <tr>
          <td class="label">Nivel 9 (SKU / Inventario):</td>
          <td class="value" colspan="3"><strong>[${n9Code}]</strong> Identificador Correlativo Registrado</td>
        </tr>
      </tbody>
    </table>

    <div class="matrix-box-container">
      <div class="matrix-box-title">CÓDIGO DE MATRIZ COMPLETO (N1 + N2 + N3 + N4 + N5 + N6 + N7 + N8 + N9):</div>
      <div class="matrix-box-banner">"${fullMatrixCode}"</div>
    </div>
  </div>

  <!-- SECCIÓN 2: REGISTRO Y ASIGNACIÓN -->
  <div class="section-block">
    <div class="section-heading">2. REGISTRO, CUSTODIA Y ASIGNACIÓN</div>
    <table class="data-table">
      <tbody>
        <tr>
          <td class="label" style="width:23%">Tipo de Entrada:</td>
          <td class="value" style="width:27%"><strong>${entryTypeLabel}</strong></td>
          <td class="label" style="width:23%">Fecha de Ingreso:</td>
          <td class="value" style="width:27%"><strong>${formatDate(entryDateStr as string)}</strong></td>
        </tr>
        <tr>
          <td class="label">Registrado por:</td>
          <td class="value"><strong>${registeredByStr}</strong></td>
          <td class="label">Responsable Asignado:</td>
          <td class="value"><strong>${responsibleName}</strong></td>
        </tr>
        <tr>
          <td class="label">Centro de Costo:</td>
          <td class="value"><strong>${costCenter}</strong></td>
          <td class="label">Fecha de Asignación:</td>
          <td class="value"><strong>${formatDate(assignmentDateStr)}</strong></td>
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
          <td class="value">${asset.serial_number || "—"}</td>
        </tr>
        <tr>
          <td class="label">Condición Operativa:</td>
          <td class="value">${conditionLabel(asset.condition)}</td>
          <td class="label">Criticidad:</td>
          <td class="value">${asset.criticality || "Baja"}</td>
        </tr>
        <tr>
          <td class="label">Descripción Técnica:</td>
          <td class="value" colspan="3">${asset.description || "—"}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- SECCIÓN 4: FOTOGRAFÍA DEL BIEN -->
  <div class="section-block" style="page-break-inside: avoid; break-inside: avoid;">
    <div class="section-heading">4. FOTOGRAFÍA DEL BIEN</div>
    ${photoEvidenceHtml}
  </div>

  <!-- SECCIÓN 5: HISTORIAL DE ASIGNACIONES Y CUSTODIA -->
  <div class="section-block">
    <div class="section-heading">5. HISTORIAL DE ASIGNACIONES Y CUSTODIA</div>
    <table class="records-table">
      <thead style="background-color:#000000; color:#ffffff;">
        <tr>
          <th style="color:#ffffff;">Responsable</th>
          <th style="color:#ffffff;">Código</th>
          <th style="color:#ffffff;">Fecha Inicio</th>
          <th style="color:#ffffff;">Fecha Fin</th>
          <th style="color:#ffffff;">Estado</th>
          <th style="color:#ffffff;">Motivo</th>
        </tr>
      </thead>
      <tbody>
        ${responsibleRows}
      </tbody>
    </table>
  </div>

  <!-- FIRMAS DIGITALES -->
  <div class="digital-signatures" style="margin-top: 40pt; display: flex; justify-content: space-around; gap: 20px;">
    ${activeResponsible ? `
      <div style="text-align: center; border: 1px solid #aaa; padding: 15px; border-radius: 8px; width: 45%; background-color: #fcfcfc;">
        <p style="margin: 0; font-size: 8pt; color: #555; text-transform: uppercase; letter-spacing: 0.5px;">Validado y aceptado en SGTB por:</p>
        <p style="margin: 10px 0 5px 0; font-weight: bold; font-size: 11pt; color: #000;">${responsibleName}</p>
        <p style="margin: 0; font-size: 9pt; color: #333;">Custodio / Técnico Responsable</p>
        <p style="margin: 5px 0 0 0; font-size: 8pt; color: #777;">Firma registrada en formulario de asignación</p>
      </div>
    ` : ''}
    <div style="text-align: center; border: 1px solid #aaa; padding: 15px; border-radius: 8px; width: 45%; background-color: #fcfcfc;">
      <p style="margin: 0; font-size: 8pt; color: #555; text-transform: uppercase; letter-spacing: 0.5px;">Aprobado y registrado en SGTB por:</p>
      <p style="margin: 10px 0 5px 0; font-weight: bold; font-size: 11pt; color: #000;">${adminName || "Administración FM"}</p>
      <p style="margin: 0; font-size: 9pt; color: #333;">Control Patrimonial &amp; FM</p>
      <p style="margin: 5px 0 0 0; font-size: 8pt; color: #777;">Firma digital de sistema</p>
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
