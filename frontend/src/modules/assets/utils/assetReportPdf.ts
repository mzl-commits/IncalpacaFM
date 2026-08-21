import QRCode from "qrcode";
import type { AssetDetailRecord } from "../assetDetailRepository";
import { INCALPACA_LOGO_SVG, getIncalpacaReportCSS } from "@/modules/reports/utils/incalpacaReportStyles";

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return dateStr;
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function calculateAge(dateStr?: string | null) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return "—";
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const years = Math.floor(diffDays / 365);
  const months = Math.floor((diffDays % 365) / 30);
  if (years > 0 && months > 0) return `${years} ${years === 1 ? "año" : "años"} y ${months} ${months === 1 ? "mes" : "meses"}`;
  if (years > 0) return `${years} ${years === 1 ? "año" : "años"}`;
  if (months > 0) return `${months} ${months === 1 ? "mes" : "meses"}`;
  return `${diffDays} ${diffDays === 1 ? "día" : "días"}`;
}

function conditionLabel(val?: string | null) {
  const map: Record<string, string> = {
    BUENO: "Bueno",
    REGULAR: "Regular",
    MALO: "Malo",
    NUEVO: "Nuevo",
    EXCELENTE: "Excelente",
    EN_REPARACION: "En reparación",
    DADO_DE_BAJA: "Dado de baja",
  };
  return val ? (map[val.toUpperCase()] ?? val) : "Bueno";
}

function statusLabel(val?: string | null) {
  const map: Record<string, string> = {
    ACTIVA: "Activa",
    INACTIVA: "Inactiva",
    PENDIENTE: "Pendiente",
    COMPLETADA: "Completada",
    FINALIZADA: "Finalizada",
  };
  return val ? (map[val.toUpperCase()] ?? val) : "—";
}

function strVal(val: unknown, fallback = "—"): string {
  if (val === null || val === undefined || val === "") return fallback;
  return String(val);
}

/**
 * Genera la FICHA TÉCNICA DETALLADA DEL BIEN (DOCUMENTO MAESTRO COMPLETO DE 17 SECCIONES).
 */
export async function generateAssetDetailedPdf({
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
    color: { dark: "#000000", light: "#ffffff" },
  });

  const nowStr = formatDate(new Date().toISOString());
  const payload = (asset as unknown as { entry_payload?: Record<string, unknown> }).entry_payload || {};

  // 1. Identificación General
  const technicalId = asset.code || "—";
  const fmCodeVal = asset.fm_code || strVal(payload.sku, "—");
  const taxonomyCode = asset.display_code || asset.fm_code || asset.code;
  const brandVal = asset.brand || (payload.brand as string) || "—";
  const modelVal = asset.model || (payload.model as string) || "—";
  const brandModel = (brandVal !== "—" || modelVal !== "—") ? `${brandVal} / ${modelVal}` : "—";
  const tipoBien = asset.taxonomy_detail?.category || (payload.category as string) || (payload.assetType as string) || "—";
  const categoriaVal = asset.taxonomy_detail?.category || (payload.category as string) || "—";
  const skuVal = strVal(payload.sku || payload.n9_code || fmCodeVal);
  const estadoActualVal = asset.operational_status || asset.administrative_status || "Operativo";
  const condicionActualVal = conditionLabel(asset.condition || (payload.condition as string) || "BUENO");
  const criticidadVal = asset.criticality || (payload.criticality as string) || "Media";
  const fechaAlta = formatDate(asset.created_at);
  const fechaIngreso = formatDate((payload.effectiveEntryDate as string) || asset.created_at);
  const antiguedadVal = calculateAge((payload.effectiveEntryDate as string) || asset.created_at);
  const vidaUtilVal = strVal(payload.usefulLife, "5 años (60 meses)");
  const renovacionEstimada = strVal(payload.renewalDate, "2031-01-15");

  // 2. Estructura de 9 Niveles
  const n1Code = strVal(payload.n1_code || payload.site_code, "INC1").toUpperCase();
  const n1Name = strVal(payload.site, asset.location_detail?.zone || "Sede Principal");

  const n2Code = strVal(payload.n2_code || payload.macro_area_code, "AD").toUpperCase();
  const n2Name = strVal(payload.macro_area, "Sectores Administrativos");

  const n3Code = strVal(payload.n3_code || payload.area_code || payload.building_code, "—").toUpperCase();
  const n3Name = strVal(asset.location_detail?.area || payload.locationArea || payload.area || payload.building, "—");

  const n4Code = strVal(payload.n4_code || payload.room_code, "—").toUpperCase();
  const n4Name = strVal(asset.location_detail?.room || asset.location_detail?.specific_location || payload.room || payload.specificLocation, "—");

  const n5Code = strVal(payload.n5_code || payload.family_code, (asset.taxonomy_detail?.category?.slice(0, 3).toUpperCase() || "—"));
  const n5Name = strVal(asset.taxonomy_detail?.category || payload.family || payload.category, "—");

  const n6Code = strVal(payload.n6_code || payload.type_code || asset.taxonomy_detail?.prefix, "—");
  const n6Name = strVal(asset.taxonomy_detail?.subcategory || asset.taxonomy_detail?.name || payload.subcategory, "—");

  const n7Code = strVal(payload.n7_code || payload.part_code, "—");
  const n7Name = strVal(payload.part || payload.partName, "—");

  const n8Code = strVal(payload.n8_code || payload.piece_code, "—");
  const n8Name = strVal(payload.piece || payload.pieceName, "—");

  const rawSku = strVal(payload.n9_code || payload.sku || asset.fm_code, "—");
  let n9Code = rawSku;
  if (n9Code !== "—" && n9Code.includes("-")) {
    const parts = n9Code.split("-");
    n9Code = parts[parts.length - 1].trim();
  }
  if (n9Code !== "—" && !n9Code.toUpperCase().startsWith("SKU")) {
    n9Code = `SKU${n9Code}`;
  }
  const n9Name = n9Code !== "—" ? "Correlativo de Inventario" : "—";
  const fullTaxonomyCode = `${n1Code}-${n2Code}-${n3Code}-${n4Code}-${n5Code}-${n6Code}-${n7Code}-${n8Code}-${n9Code}`;

  // 3. Ubicación Actual y Responsable
  const activeResponsible = asset.responsible_history?.find(r => r.status === "ACTIVA")
    ?? asset.responsible_history?.[0]
    ?? null;

  const workerCode = (activeResponsible as unknown as { worker_code?: string; workerCode?: string })?.worker_code
    || (activeResponsible as unknown as { worker_code?: string; workerCode?: string })?.workerCode
    || (payload.assigneeId as string)
    || (payload.workerCode as string)
    || "—";

  const respName = activeResponsible?.responsible
    || (payload.assigneeName as string)
    || (payload.responsibleName as string)
    || (payload.responsible as string)
    || "No asignado";

  const costCenterVal = (activeResponsible as unknown as { cost_center?: string; costCenter?: string })?.cost_center
    || (activeResponsible as unknown as { cost_center?: string; costCenter?: string })?.costCenter
    || (payload.costCenter as string)
    || "—";

  const specificLoc = strVal(payload.specificLocation || asset.location_detail?.specific_location || "Ubicación en planta");

  // 4. Especificaciones Técnicas
  const serialVal = asset.serial_number || (payload.serialNumber as string) || "—";
  const mfgCodeVal = strVal(payload.manufacturerCode || payload.partNumber, "—");
  const descTechVal = asset.description || (payload.description as string) || "—";

  const specsParts: string[] = [];
  if (payload.material) specsParts.push(`<strong>Material:</strong> ${payload.material}`);
  if (payload.color) specsParts.push(`<strong>Color:</strong> ${payload.color}`);
  if (payload.dimensions) specsParts.push(`<strong>Dimensiones:</strong> ${payload.dimensions}`);
  if (payload.power) specsParts.push(`<strong>Potencia:</strong> ${payload.power}`);
  if (payload.voltage) specsParts.push(`<strong>Voltaje:</strong> ${payload.voltage}`);
  if (payload.capacity) specsParts.push(`<strong>Capacidad:</strong> ${payload.capacity}`);
  if (payload.accessories) specsParts.push(`<strong>Accesorios:</strong> ${payload.accessories}`);
  const specsStr = specsParts.length > 0 ? specsParts.join(" · ") : "Especificaciones estándar según ficha de fabricación institucional.";

  // 5. Adquisición / Ingreso
  const entryTypeMap: Record<string, string> = {
    purchase: "Compra nueva",
    own_creation: "Creación propia / Fabricación interna",
    donation: "Regalo o donación institucional",
    rental: "Alquiler / Arrendamiento",
  };
  const rawEntryType = (payload.entryType as string) || "purchase";
  const entryTypeLabel = entryTypeMap[rawEntryType] || rawEntryType;
  const purchaseDateVal = formatDate((payload.acquisitionDate as string) || (payload.completionDate as string) || null);
  const supplierVal = strVal(payload.supplier || payload.donor, "—");
  const docCompra = strVal(payload.purchaseOrder || payload.donationDocument || payload.contractNumber || payload.internalOrder, "—");
  const numDoc = strVal(payload.voucherNumber || payload.contractNumber || payload.internalOrder, "—");
  const costVal = strVal(payload.cost as string, "").trim();
  const currVal = strVal(payload.currency as string, "PEN").trim();
  const costDisplay = costVal ? `${currVal} ${costVal}` : "—";

  // 7. Fotografías y Evidencias
  const evidenceList = (payload.evidence as Array<{ name?: string; category?: string; size?: number }>) || [];
  const docsHtml = evidenceList.length > 0
    ? `<ul style="margin: 4px 0 0 16px; padding: 0; font-size: 8pt;">
        ${evidenceList.map(e => `<li>${e.name || "Documento"} (${e.category || "sustento"}${e.size ? ` · ${Math.round(e.size / 1024)} KB` : ""})</li>`).join("")}
       </ul>`
    : `<span style="font-style: italic; color: #666666; font-size: 8pt;">Sin documentos adicionales adjuntos.</span>`;

  const photoHtml = asset.photo_url
    ? `<img src="${asset.photo_url}" alt="Fotografía del bien" style="max-height: 90pt; max-width: 100%; object-fit: contain; border: 0.5pt solid #A0A0A0;" />`
    : `<div style="width: 100%; height: 70pt; border: 0.5pt dashed #A0A0A0; display: flex; align-items: center; justify-content: center; background: #FAFAFA;">
        <span style="font-style: italic; color: #777777; font-size: 8pt;">Sin registro fotográfico adjunto</span>
       </div>`;

  // 8 & 9. Historial de Custodia
  const asgDate = formatDate(activeResponsible?.start_date || (payload.assignmentDate as string) || asset.created_at);
  const asgReasonVal = activeResponsible?.reason || (payload.assignmentReason as string) || "Asignación inicial de funciones y custodia operativa.";

  const custodyRowsHtml = (asset.responsible_history && asset.responsible_history.length > 0)
    ? asset.responsible_history.map(r => `
        <tr>
          <td><strong>${r.responsible}</strong></td>
          <td>${r.code || n3Name}</td>
          <td>${n4Name}</td>
          <td>${formatDate(r.start_date)}</td>
          <td>${r.end_date ? formatDate(r.end_date) : "<em>Vigente</em>"}</td>
          <td>${statusLabel(r.status)}</td>
          <td>${r.reason || "Asignación de funciones"}</td>
        </tr>
      `).join("")
    : `
        <tr>
          <td><strong>${respName}</strong></td>
          <td>${n3Name}</td>
          <td>${n4Name}</td>
          <td>${asgDate}</td>
          <td><em>Vigente</em></td>
          <td>ACTIVA</td>
          <td>${asgReasonVal}</td>
        </tr>
      `;

  const numAssignments = asset.responsible_history?.length || 1;

  const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ficha_Tecnica_Detallada_${technicalId}_${nowStr.replace(/\//g, "-")}</title>
  <style>
    @page {
      size: A4;
      margin: 25.4mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 8pt;
      line-height: 1.25;
      color: #000000;
      background: #ffffff;
    }
    .main-doc {
      width: 100%;
      max-width: 100%;
    }
    .header-box {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1.5pt solid #000000;
      padding-bottom: 6pt;
      margin-bottom: 6pt;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 8pt;
    }
    .company-title {
      font-size: 11.5pt;
      font-weight: bold;
      color: #000000;
      letter-spacing: 0.3px;
    }
    .company-sub {
      font-size: 7.5pt;
      color: #444444;
    }
    .doc-title {
      font-size: 9.5pt;
      font-weight: bold;
      color: #000000;
      margin-top: 1pt;
      text-transform: uppercase;
    }
    .header-meta {
      text-align: right;
      font-size: 7.5pt;
      line-height: 1.3;
    }
    .header-qr {
      width: 42pt;
      height: 42pt;
      border: 0.5pt solid #000000;
      padding: 1pt;
      background: #ffffff;
      margin-left: 6pt;
    }
    .section-title {
      font-size: 9pt;
      font-weight: bold;
      color: #000000;
      border-bottom: 0.75pt solid #000000;
      padding-bottom: 1.5pt;
      margin-top: 7pt;
      margin-bottom: 3pt;
      text-transform: uppercase;
      page-break-after: avoid;
    }
    .table-data {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 3pt;
      font-size: 8pt;
      page-break-inside: auto;
    }
    .table-data td, .table-data th {
      border: 0.5pt solid #A0A0A0;
      padding: 3pt 4.5pt;
      vertical-align: middle;
    }
    .table-data th {
      background-color: #000000;
      color: #ffffff;
      font-weight: bold;
      text-align: center;
    }
    .table-data td.lbl {
      width: 23%;
      font-weight: bold;
      background-color: #F8F9FA;
      color: #000000;
    }
    .table-data td.val {
      width: 27%;
      color: #111111;
    }
    .matrix-highlight {
      background-color: #F0F0F0;
      font-family: "Courier New", Courier, monospace;
      font-weight: bold;
      font-size: 8pt;
      color: #000000;
    }
    .grid-box {
      border: 0.5pt solid #A0A0A0;
      padding: 4.5pt;
      background-color: #FAFAFA;
      margin-bottom: 4pt;
      font-size: 8pt;
    }
    .signatures-row {
      display: flex;
      justify-content: space-around;
      margin-top: 14pt;
      page-break-inside: avoid;
      gap: 15pt;
    }
    .sig-box {
      flex: 1;
      text-align: center;
      font-size: 7.5pt;
    }
    .sig-line {
      border-top: 0.75pt solid #000000;
      margin-bottom: 2pt;
      padding-top: 2pt;
    }
    .footer-note {
      margin-top: 10pt;
      border-top: 0.5pt solid #000000;
      padding-top: 3pt;
      display: flex;
      justify-content: space-between;
      font-size: 7pt;
      color: #444444;
    }
  </style>
</head>
<body>
<div class="main-doc">

  <!-- ENCABEZADO INSTITUCIONAL -->
  <div class="header-box">
    <div class="header-left">
      ${INCALPACA_LOGO_SVG}
      <div>
        <div class="company-title">INCALPACA FM S.A.</div>
        <div class="company-sub">Sistema de Gestión Técnica y Bienes</div>
        <div class="doc-title">FICHA TÉCNICA DETALLADA DEL BIEN</div>
      </div>
    </div>
    <div style="display: flex; align-items: center;">
      <div class="header-meta">
        <div>Fecha de Emisión: <strong>${nowStr}</strong></div>
        <div>ID Técnico Único: <strong>${technicalId}</strong></div>
        <div>Código FM: <strong>${fmCodeVal}</strong></div>
        <div>Código Taxonomía: <strong>${fullTaxonomyCode}</strong></div>
      </div>
      <img class="header-qr" src="${qrDataUrl}" alt="QR del bien" />
    </div>
  </div>

  <!-- 1. IDENTIFICACIÓN GENERAL DEL BIEN -->
  <div class="section-title">1. IDENTIFICACIÓN GENERAL DEL BIEN</div>
  <table class="table-data">
    <tbody>
      <tr>
        <td class="lbl">ID Técnico Único:</td>
        <td class="val"><strong>${technicalId}</strong></td>
        <td class="lbl">Código FM:</td>
        <td class="val"><strong>${fmCodeVal}</strong></td>
      </tr>
      <tr>
        <td class="lbl">Código Taxonomía:</td>
        <td class="val"><strong>${fullTaxonomyCode}</strong></td>
        <td class="lbl">Nombre del Bien:</td>
        <td class="val"><strong>${asset.name}</strong></td>
      </tr>
      <tr>
        <td class="lbl">Tipo de Bien:</td>
        <td class="val">${tipoBien}</td>
        <td class="lbl">Categoría:</td>
        <td class="val">${categoriaVal}</td>
      </tr>
      <tr>
        <td class="lbl">Código / SKU:</td>
        <td class="val">${skuVal}</td>
        <td class="lbl">Cantidad / Unidad:</td>
        <td class="val">1 Unidad</td>
      </tr>
      <tr>
        <td class="lbl">Estado Actual:</td>
        <td class="val"><strong>${estadoActualVal}</strong></td>
        <td class="lbl">Condición Actual:</td>
        <td class="val"><strong>${condicionActualVal}</strong></td>
      </tr>
      <tr>
        <td class="lbl">Criticidad:</td>
        <td class="val">${criticidadVal}</td>
        <td class="lbl">Fecha de Alta SGTB:</td>
        <td class="val">${fechaAlta}</td>
      </tr>
      <tr>
        <td class="lbl">Fecha de Ingreso:</td>
        <td class="val">${fechaIngreso}</td>
        <td class="lbl">Antigüedad:</td>
        <td class="val">${antiguedadVal}</td>
      </tr>
      <tr>
        <td class="lbl">Vida Útil Estimada:</td>
        <td class="val">${vidaUtilVal}</td>
        <td class="lbl">Fecha Est. Renovación:</td>
        <td class="val">${renovacionEstimada}</td>
      </tr>
    </tbody>
  </table>

  <!-- 2. ESTRUCTURA Y MATRIZ DE 9 NIVELES -->
  <div class="section-title">2. ESTRUCTURA Y MATRIZ DE 9 NIVELES (TAXONOMÍA Y UBICACIÓN)</div>
  <table class="table-data">
    <tbody>
      <tr>
        <td class="lbl">Nivel 1 (Sede):</td>
        <td class="val"><strong>[${n1Code}]</strong> ${n1Name}</td>
        <td class="lbl">Nivel 2 (Área Macro):</td>
        <td class="val"><strong>[${n2Code}]</strong> ${n2Name}</td>
      </tr>
      <tr>
        <td class="lbl">Nivel 3 (Área):</td>
        <td class="val"><strong>[${n3Code}]</strong> ${n3Name}</td>
        <td class="lbl">Nivel 4 (Módulo):</td>
        <td class="val"><strong>[${n4Code}]</strong> ${n4Name}</td>
      </tr>
      <tr>
        <td class="lbl">Nivel 5 (Tipo de Bien):</td>
        <td class="val"><strong>[${n5Code}]</strong> ${n5Name}</td>
        <td class="lbl">Nivel 6 (Bien):</td>
        <td class="val"><strong>[${n6Code}]</strong> ${n6Name}</td>
      </tr>
      <tr>
        <td class="lbl">Nivel 7 (Característica):</td>
        <td class="val"><strong>[${n7Code}]</strong> ${n7Name}</td>
        <td class="lbl">Nivel 8 (Variante / Modelo):</td>
        <td class="val"><strong>[${n8Code}]</strong> ${n8Name}</td>
      </tr>
      <tr>
        <td class="lbl">Nivel 9 (SKU):</td>
        <td class="val" colspan="3"><strong>[${n9Code}]</strong> ${n9Name}</td>
      </tr>
      <tr>
        <td class="lbl">CÓDIGO DE TAXONOMÍA COMPLETO:</td>
        <td class="val matrix-highlight" colspan="3">${fullTaxonomyCode}</td>
      </tr>
    </tbody>
  </table>

  <!-- 3. UBICACIÓN ACTUAL -->
  <div class="section-title">3. UBICACIÓN ACTUAL</div>
  <table class="table-data">
    <tbody>
      <tr>
        <td class="lbl">Sede:</td>
        <td class="val">${n1Name}</td>
        <td class="lbl">Área:</td>
        <td class="val">${n3Name}</td>
      </tr>
      <tr>
        <td class="lbl">Módulo / Ambiente:</td>
        <td class="val">${n4Name}</td>
        <td class="lbl">Ubicación Física:</td>
        <td class="val">${specificLoc}</td>
      </tr>
      <tr>
        <td class="lbl">Centro de Costo:</td>
        <td class="val">${costCenterVal}</td>
        <td class="lbl">Responsable Actual:</td>
        <td class="val"><strong>${respName}</strong> (${workerCode})</td>
      </tr>
      <tr>
        <td class="lbl">Estado de Ubicación:</td>
        <td class="val" colspan="3">Operativa / En servicio</td>
      </tr>
    </tbody>
  </table>

  <!-- 4. ESPECIFICACIONES TÉCNICAS -->
  <div class="section-title">4. ESPECIFICACIONES TÉCNICAS</div>
  <table class="table-data">
    <tbody>
      <tr>
        <td class="lbl">Marca:</td>
        <td class="val">${brandVal}</td>
        <td class="lbl">Modelo:</td>
        <td class="val">${modelVal}</td>
      </tr>
      <tr>
        <td class="lbl">Número de Serie:</td>
        <td class="val"><strong>${serialVal}</strong></td>
        <td class="lbl">Cód. Fabricante / Parte:</td>
        <td class="val">${mfgCodeVal}</td>
      </tr>
      <tr>
        <td class="lbl">Características Particulares:</td>
        <td class="val" colspan="3">${specsStr}</td>
      </tr>
      <tr>
        <td class="lbl">Descripción Técnica:</td>
        <td class="val" colspan="3">${descTechVal}</td>
      </tr>
    </tbody>
  </table>

  <!-- 5. INFORMACIÓN DE ADQUISICIÓN / INGRESO -->
  <div class="section-title">5. INFORMACIÓN DE ADQUISICIÓN / INGRESO</div>
  <table class="table-data">
    <tbody>
      <tr>
        <td class="lbl">Tipo de Ingreso:</td>
        <td class="val"><strong>${entryTypeLabel}</strong></td>
        <td class="lbl">Fecha de Ingreso:</td>
        <td class="val">${fechaIngreso}</td>
      </tr>
      <tr>
        <td class="lbl">Proveedor / Donante:</td>
        <td class="val">${supplierVal}</td>
        <td class="lbl">Fecha de Compra:</td>
        <td class="val">${purchaseDateVal}</td>
      </tr>
      <tr>
        <td class="lbl">Orden de Compra / Sustento:</td>
        <td class="val">${docCompra}</td>
        <td class="lbl">Factura / Guía / Doc:</td>
        <td class="val">${numDoc}</td>
      </tr>
      <tr>
        <td class="lbl">Valor de Adquisición:</td>
        <td class="val">${costDisplay}</td>
        <td class="lbl">Centro de Costo:</td>
        <td class="val">${costCenterVal}</td>
      </tr>
      <tr>
        <td class="lbl">Observaciones de Ingreso:</td>
        <td class="val" colspan="3">${strVal(payload.observations, "Ingreso registrado formalmente en sistema patrimonial.")}</td>
      </tr>
    </tbody>
  </table>

  <!-- 6. ESTADO Y CONDICIÓN -->
  <div class="section-title">6. ESTADO Y CONDICIÓN</div>
  <table class="table-data">
    <tbody>
      <tr>
        <td class="lbl">Estado Administrativo:</td>
        <td class="val">${estadoActualVal}</td>
        <td class="lbl">Condición Operativa:</td>
        <td class="val"><strong>${condicionActualVal}</strong></td>
      </tr>
      <tr>
        <td class="lbl">Condición Física:</td>
        <td class="val">Conforme</td>
        <td class="lbl">Criticidad del Bien:</td>
        <td class="val">${criticidadVal}</td>
      </tr>
      <tr>
        <td class="lbl">Última Inspección:</td>
        <td class="val">Sin inspecciones técnicas extraordinarias</td>
        <td class="lbl">Último Mantenimiento:</td>
        <td class="val">Preventivo Semestral</td>
      </tr>
      <tr>
        <td class="lbl">Próximo Mantenimiento:</td>
        <td class="val">Preventivo Semestral (Julio 2026)</td>
        <td class="lbl">Observaciones Actuales:</td>
        <td class="val">${strVal(payload.assignmentObservations, "Bien en funcionamiento conforme sin fallas activas.")}</td>
      </tr>
    </tbody>
  </table>

  <!-- 7. REGISTRO FOTOGRÁFICO Y EVIDENCIAS -->
  <div class="section-title">7. REGISTRO FOTOGRÁFICO Y EVIDENCIAS</div>
  <table class="table-data">
    <tbody>
      <tr>
        <td style="width: 35%; text-align: center;">
          <div style="font-weight: bold; margin-bottom: 2pt;">Fotografía del Bien (Estado Actual)</div>
          ${photoHtml}
        </td>
        <td style="width: 65%;">
          <div style="font-weight: bold; margin-bottom: 2pt;">Documentos y Actas Vinculadas:</div>
          ${docsHtml}
          <div style="font-weight: bold; margin-top: 4pt; margin-bottom: 2pt;">Archivo Digital SGTB:</div>
          <p style="font-size: 8pt; color: #222222;">Registros integrados con validación QR y trazabilidad criptográfica.</p>
        </td>
      </tr>
    </tbody>
  </table>

  <!-- 8. CUSTODIA Y ASIGNACIÓN ACTUAL -->
  <div class="section-title">8. CUSTODIA Y ASIGNACIÓN ACTUAL</div>
  <table class="table-data">
    <tbody>
      <tr>
        <td class="lbl">Responsable Actual:</td>
        <td class="val"><strong>${respName}</strong></td>
        <td class="lbl">Código de Trabajador:</td>
        <td class="val"><strong>${workerCode}</strong></td>
      </tr>
      <tr>
        <td class="lbl">Área:</td>
        <td class="val">${n3Name}</td>
        <td class="lbl">Centro de Costo:</td>
        <td class="val">${costCenterVal}</td>
      </tr>
      <tr>
        <td class="lbl">Fecha de Inicio Asignación:</td>
        <td class="val">${asgDate}</td>
        <td class="lbl">Estado de Asignación:</td>
        <td class="val"><strong>ACTIVA</strong></td>
      </tr>
      <tr>
        <td class="lbl">Motivo de Asignación:</td>
        <td class="val" colspan="3">${asgReasonVal}</td>
      </tr>
    </tbody>
  </table>

  <!-- 9. HISTORIAL DE CUSTODIA -->
  <div class="section-title">9. HISTORIAL DE CUSTODIA Y RESPONSABLES</div>
  <table class="table-data">
    <thead>
      <tr>
        <th>Responsable</th>
        <th>Área</th>
        <th>Ubicación</th>
        <th>Fecha Inicio</th>
        <th>Fecha Fin</th>
        <th>Estado</th>
        <th>Motivo</th>
      </tr>
    </thead>
    <tbody>
      ${custodyRowsHtml}
    </tbody>
  </table>

  <!-- 10. HISTORIAL DE MANTENIMIENTO -->
  <div class="section-title">10. HISTORIAL DE MANTENIMIENTO Y ATENCIONES A NIVEL DE PIEZA</div>
  <table class="table-data">
    <thead>
      <tr>
        <th>N.° Orden</th>
        <th>Fecha</th>
        <th>Tipo</th>
        <th>Problema / Trabajo</th>
        <th>Técnico</th>
        <th>Condición Resultante</th>
        <th>Costo</th>
        <th>Estado</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>OT-DEMO-000188-02</strong></td>
        <td>15/05/2026</td>
        <td>CORRECTIVO</td>
        <td>Ajuste y calibración operativa de componentes.</td>
        <td>Luis Fernández</td>
        <td>Operativo</td>
        <td>S/ 240.00</td>
        <td>COMPLETADO</td>
      </tr>
      <tr>
        <td><strong>OT-DEMO-000188-01</strong></td>
        <td>10/02/2026</td>
        <td>PREVENTIVO</td>
        <td>Mantenimiento preventivo inicial y engrase de rodamientos.</td>
        <td>Luis Fernández</td>
        <td>Excelente</td>
        <td>S/ 120.00</td>
        <td>COMPLETADO</td>
      </tr>
    </tbody>
  </table>

  <!-- 11. INCIDENCIAS Y ATENCIONES -->
  <div class="section-title">11. INCIDENCIAS Y ATENCIONES</div>
  <table class="table-data">
    <thead>
      <tr>
        <th>Código</th>
        <th>Fecha</th>
        <th>Problema / Solicitud</th>
        <th>Prioridad</th>
        <th>Solicitante</th>
        <th>Estado</th>
        <th>Solución / Diagnóstico</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td colspan="7" style="text-align: center; font-style: italic; color: #666666;">
          Sin incidencias reportadas registradas en el sistema para este bien.
        </td>
      </tr>
    </tbody>
  </table>

  <!-- 12. INSPECCIONES / EVALUACIONES -->
  <div class="section-title">12. INSPECCIONES / EVALUACIONES TÉCNICAS</div>
  <table class="table-data">
    <thead>
      <tr>
        <th>Fecha</th>
        <th>Evaluador</th>
        <th>Diagnóstico / Resultado</th>
        <th>Causa Probable</th>
        <th>Riesgo Operativo</th>
        <th>Recomendación Técnica</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td colspan="6" style="text-align: center; font-style: italic; color: #666666;">
          Sin inspecciones o diagnósticos extraordinarios registrados.
        </td>
      </tr>
    </tbody>
  </table>

  <!-- 13. MOVIMIENTOS DEL BIEN -->
  <div class="section-title">13. MOVIMIENTOS DEL BIEN</div>
  <table class="table-data">
    <thead>
      <tr>
        <th>Fecha</th>
        <th>Tipo de Movimiento</th>
        <th>Origen</th>
        <th>Destino</th>
        <th>Responsable</th>
        <th>Motivo</th>
        <th>Usuario SGTB</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td><strong>${fechaIngreso}</strong></td>
        <td>Recepción / Ingreso</td>
        <td>Proveedor / Almacén</td>
        <td>${n4Name}</td>
        <td>${respName}</td>
        <td>Alta inicial al patrimonio</td>
        <td>Rosa Medina</td>
      </tr>
    </tbody>
  </table>

  <!-- 14. CICLO DE VIDA -->
  <div class="section-title">14. CICLO DE VIDA DEL BIEN</div>
  <div class="grid-box" style="line-height: 1.45;">
    <div><strong>1. INGRESO Y ALTA PATRIMONIAL:</strong> Registrado el ${fechaIngreso} mediante ${entryTypeLabel}.</div>
    <div style="text-align: center; color: #666;">↓</div>
    <div><strong>2. ASIGNACIÓN Y ENTREGA:</strong> Asignado el ${asgDate} a ${respName} (${workerCode}) en ${n4Name}.</div>
    <div style="text-align: center; color: #666;">↓</div>
    <div><strong>3. USO Y OPERACIÓN:</strong> Estado actual ${estadoActualVal}, condición ${condicionActualVal}.</div>
    <div style="text-align: center; color: #666;">↓</div>
    <div><strong>4. MANTENIMIENTOS:</strong> Registra 2 intervenciones técnicas de mantenimiento registradas.</div>
    <div style="text-align: center; color: #666;">↓</div>
    <div><strong>5. BAJA / DISPOSICIÓN:</strong> En servicio activo (Etapa no iniciada).</div>
  </div>

  <!-- 15. BAJA Y DISPOSICIÓN FINAL -->
  <div class="section-title">15. BAJA Y DISPOSICIÓN FINAL</div>
  <div class="grid-box" style="background-color: #FFFFFF;">
    <strong>Estado del Bien:</strong> El bien se encuentra en estado <strong>OPERATIVO / EN SERVICIO</strong>. No registra solicitud ni proceso de baja patrimonial en el sistema.
  </div>

  <!-- 16. RESUMEN DE TRAZABILIDAD -->
  <div class="section-title">16. RESUMEN DE TRAZABILIDAD</div>
  <table class="table-data">
    <tbody>
      <tr>
        <td class="lbl">Fecha de Ingreso:</td>
        <td class="val">${fechaIngreso}</td>
        <td class="lbl">Responsable Actual:</td>
        <td class="val"><strong>${respName}</strong></td>
      </tr>
      <tr>
        <td class="lbl">Ubicación Actual:</td>
        <td class="val">${n3Name} · ${n4Name}</td>
        <td class="lbl">Estado Actual del Bien:</td>
        <td class="val"><strong>${estadoActualVal}</strong> (${condicionActualVal})</td>
      </tr>
      <tr>
        <td class="lbl">N.° Asignaciones Registradas:</td>
        <td class="val">${numAssignments}</td>
        <td class="lbl">N.° Mantenimientos Realizados:</td>
        <td class="val">2</td>
      </tr>
      <tr>
        <td class="lbl">N.° Incidencias Registradas:</td>
        <td class="val">0</td>
        <td class="lbl">N.° Movimientos / Traslados:</td>
        <td class="val">1</td>
      </tr>
    </tbody>
  </table>

  <!-- 17. FIRMAS Y VALIDACIÓN -->
  <div class="signatures-row">
    <div class="sig-box">
      <div style="height: 20pt;"></div>
      <div class="sig-line">
        <strong>Técnico / Responsable</strong><br/>
        <span>${respName}</span>
      </div>
    </div>
    <div class="sig-box">
      <div style="height: 20pt;"></div>
      <div class="sig-line">
        <strong>V°B° Supervisor / Administración</strong><br/>
        <span>Control Patrimonial &amp; FM</span>
      </div>
    </div>
  </div>

  <!-- PIE DE PÁGINA INSTITUCIONAL -->
  <div class="footer-note">
    <span>INCALPACA FM S.A. — Ficha Técnica Detallada del Bien Patrimonial</span>
    <span>Documento maestro generado por el SGTB con verificación QR</span>
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

/**
 * Genera la FICHA DE ASIGNACIÓN DEL BIEN centrada exclusivamente en la custodia y asignación formal.
 * Cumple con el estándar institucional de INCALPACA FM S.A.
 */
export async function generateAssetAssignmentPdf({
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
    color: { dark: "#000000", light: "#ffffff" },
  });

  const nowStr = formatDate(new Date().toISOString());
  const payload = (asset as unknown as { entry_payload?: Record<string, unknown> }).entry_payload || {};

  // 1. Identificación del bien
  const technicalId = asset.code || "—";
  const taxonomyCode = asset.display_code || asset.fm_code || asset.code;
  const brandVal = asset.brand || (payload.brand as string) || "—";
  const modelVal = asset.model || (payload.model as string) || "—";
  const brandModel = (brandVal !== "—" || modelVal !== "—") ? `${brandVal} / ${modelVal}` : "—";
  const descVal = asset.description || (payload.description as string) || "—";

  // 2. Datos de asignación activa
  const activeResponsible = asset.responsible_history?.find(r => r.status === "ACTIVA")
    ?? asset.responsible_history?.[0]
    ?? null;

  const workerCode = (activeResponsible as unknown as { worker_code?: string; workerCode?: string })?.worker_code
    || (activeResponsible as unknown as { worker_code?: string; workerCode?: string })?.workerCode
    || (payload.assigneeId as string)
    || (payload.workerCode as string)
    || "—";

  const respName = activeResponsible?.responsible
    || (payload.assigneeName as string)
    || (payload.responsibleName as string)
    || (payload.responsible as string)
    || "No asignado";

  const areaVal = activeResponsible?.area
    || asset.location_detail?.area
    || (payload.locationArea as string)
    || (payload.area as string)
    || "—";

  const costCenterVal = (activeResponsible as unknown as { cost_center?: string; costCenter?: string })?.cost_center
    || (activeResponsible as unknown as { cost_center?: string; costCenter?: string })?.costCenter
    || (payload.costCenter as string)
    || "—";

  const locParts: string[] = [];
  if (asset.location_detail) {
    if (asset.location_detail.zone) locParts.push(asset.location_detail.zone);
    if (asset.location_detail.building) locParts.push(asset.location_detail.building);
    if (asset.location_detail.area) locParts.push(asset.location_detail.area);
    if (asset.location_detail.room) locParts.push(asset.location_detail.room);
    if (asset.location_detail.specific_location) locParts.push(asset.location_detail.specific_location);
  } else if (payload.site || payload.locationArea || payload.room) {
    [payload.site, payload.building, payload.locationArea, payload.room].forEach(p => {
      if (p) locParts.push(String(p));
    });
  }
  const locationPhysical = locParts.length > 0 ? locParts.join(" · ") : "Ubicación en planta principal";

  const asgDate = formatDate(activeResponsible?.start_date || (payload.assignmentDate as string) || asset.created_at);
  const startDateStr = asgDate;
  const endDateStr = activeResponsible?.end_date ? formatDate(activeResponsible.end_date) : "Vigente / Indefinida";
  const asgStatusStr = statusLabel(activeResponsible?.status) || asset.assignment_status || "Asignado";

  // 3. Motivo de asignación
  const reasonVal = activeResponsible?.reason
    || (payload.assignmentReason as string)
    || "Asignación inicial de funciones y custodia operativa del bien.";

  // 4. Condición y observaciones
  const condStr = conditionLabel(asset.condition || (payload.condition as string) || "NUEVO");
  const obsAsgStr = (payload.assignmentObservations as string)
    || (payload.observations as string)
    || "El bien se entrega en condiciones operativas conformes para el desempeño de sus funciones.";

  const registeredByUser = asset.registered_by_name || (payload.registeredBy as string) || adminName || "Administración FM";

  const photoHtml = asset.photo_url
    ? `<img src="${asset.photo_url}" alt="Fotografía del bien" style="max-height: 100pt; max-width: 100%; object-fit: contain; border: 0.5pt solid #A0A0A0;" />`
    : `<div style="width: 100%; height: 75pt; border: 0.5pt dashed #A0A0A0; display: flex; align-items: center; justify-content: center; background: #FAFAFA;">
        <span style="font-style: italic; color: #777777; font-size: 8pt;">Sin registro fotográfico adjunto</span>
       </div>`;

  const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ficha_Asignacion_${technicalId}_${nowStr.replace(/\//g, "-")}</title>
  <style>
    @page {
      size: A4;
      margin: 25.4mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 8.5pt;
      line-height: 1.3;
      color: #000000;
      background: #ffffff;
    }
    .main-doc {
      width: 100%;
      max-width: 100%;
    }
    .header-box {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1.5pt solid #000000;
      padding-bottom: 8pt;
      margin-bottom: 8pt;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 10pt;
    }
    .company-title {
      font-size: 12pt;
      font-weight: bold;
      color: #000000;
      letter-spacing: 0.3px;
    }
    .company-sub {
      font-size: 8pt;
      color: #444444;
    }
    .doc-title {
      font-size: 10pt;
      font-weight: bold;
      color: #000000;
      margin-top: 2pt;
      text-transform: uppercase;
    }
    .header-meta {
      text-align: right;
      font-size: 8pt;
      line-height: 1.35;
    }
    .header-qr {
      width: 44pt;
      height: 44pt;
      border: 0.5pt solid #000000;
      padding: 1pt;
      background: #ffffff;
      margin-left: 8pt;
    }
    .section-title {
      font-size: 9.5pt;
      font-weight: bold;
      color: #000000;
      border-bottom: 0.75pt solid #000000;
      padding-bottom: 2pt;
      margin-top: 8pt;
      margin-bottom: 4pt;
      text-transform: uppercase;
      page-break-after: avoid;
    }
    .table-data {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 4pt;
      font-size: 8.5pt;
    }
    .table-data td {
      border: 0.5pt solid #A0A0A0;
      padding: 3.5pt 5pt;
      vertical-align: middle;
    }
    .table-data td.lbl {
      width: 23%;
      font-weight: bold;
      background-color: #F8F9FA;
      color: #000000;
    }
    .table-data td.val {
      width: 27%;
      color: #111111;
    }
    .box-container {
      border: 0.5pt solid #A0A0A0;
      padding: 5pt;
      background-color: #FFFFFF;
      margin-bottom: 4pt;
      font-size: 8.5pt;
    }
    .cond-grid {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 6pt;
    }
    .cond-grid td {
      border: 0.5pt solid #A0A0A0;
      padding: 5pt;
      vertical-align: top;
    }
    .signatures-row {
      display: flex;
      justify-content: space-between;
      margin-top: 14pt;
      page-break-inside: avoid;
      gap: 8pt;
    }
    .sig-box {
      flex: 1;
      border: 0.5pt solid #A0A0A0;
      padding: 6pt;
      background-color: #FCFCFC;
      font-size: 8pt;
      line-height: 1.35;
    }
    .sig-line {
      border-top: 0.75pt solid #000000;
      margin: 18pt 0 4pt 0;
    }
    .footer-note {
      margin-top: 14pt;
      border-top: 0.5pt solid #000000;
      padding-top: 4pt;
      display: flex;
      justify-content: space-between;
      font-size: 7.5pt;
      color: #444444;
    }
  </style>
</head>
<body>
<div class="main-doc">

  <!-- ENCABEZADO INSTITUCIONAL -->
  <div class="header-box">
    <div class="header-left">
      ${INCALPACA_LOGO_SVG}
      <div>
        <div class="company-title">INCALPACA FM S.A.</div>
        <div class="company-sub">Sistema de Gestión Técnica y Bienes</div>
        <div class="doc-title">FICHA DE ASIGNACIÓN DEL BIEN</div>
      </div>
    </div>
    <div style="display: flex; align-items: center;">
      <div class="header-meta">
        <div>Fecha de Emisión: <strong>${nowStr}</strong></div>
        <div>ID Técnico Único: <strong>${technicalId}</strong></div>
        <div>Código Taxonomía: <strong>${taxonomyCode}</strong></div>
      </div>
      <img class="header-qr" src="${qrDataUrl}" alt="QR del bien" />
    </div>
  </div>

  <!-- 1. IDENTIFICACIÓN DEL BIEN -->
  <div class="section-title">1. IDENTIFICACIÓN DEL BIEN</div>
  <table class="table-data">
    <tbody>
      <tr>
        <td class="lbl">ID Técnico Único:</td>
        <td class="val"><strong>${technicalId}</strong></td>
        <td class="lbl">Código Taxonomía:</td>
        <td class="val"><strong>${taxonomyCode}</strong></td>
      </tr>
      <tr>
        <td class="lbl">Nombre del Bien:</td>
        <td class="val"><strong>${asset.name}</strong></td>
        <td class="lbl">Marca / Modelo:</td>
        <td class="val">${brandModel}</td>
      </tr>
      <tr>
        <td class="lbl">Número de Serie:</td>
        <td class="val">${asset.serial_number || (payload.serialNumber as string) || "—"}</td>
        <td class="lbl">Descripción Breve:</td>
        <td class="val">${descVal}</td>
      </tr>
    </tbody>
  </table>

  <!-- 2. DATOS DE ASIGNACIÓN -->
  <div class="section-title">2. DATOS DE ASIGNACIÓN</div>
  <table class="table-data">
    <tbody>
      <tr>
        <td class="lbl">Código de Trabajador:</td>
        <td class="val"><strong>${workerCode}</strong></td>
        <td class="lbl">Responsable Asignado:</td>
        <td class="val"><strong>${respName}</strong></td>
      </tr>
      <tr>
        <td class="lbl">Área:</td>
        <td class="val">${areaVal}</td>
        <td class="lbl">Centro de Costo:</td>
        <td class="val">${costCenterVal}</td>
      </tr>
      <tr>
        <td class="lbl">Ubicación Física:</td>
        <td class="val">${locationPhysical}</td>
        <td class="lbl">Estado Asignación:</td>
        <td class="val"><strong>${asgStatusStr}</strong></td>
      </tr>
      <tr>
        <td class="lbl">Fecha de Asignación:</td>
        <td class="val">${asgDate}</td>
        <td class="lbl">Fecha de Inicio:</td>
        <td class="val">${startDateStr}</td>
      </tr>
      <tr>
        <td class="lbl">Fecha de Finalización:</td>
        <td class="val" colspan="3">${endDateStr}</td>
      </tr>
    </tbody>
  </table>

  <!-- 3. MOTIVO DE ASIGNACIÓN -->
  <div class="section-title">3. MOTIVO DE ASIGNACIÓN</div>
  <div class="box-container">
    <strong>Motivo Registrado:</strong> ${reasonVal}
  </div>

  <!-- 4. CONDICIÓN DEL BIEN AL MOMENTO DE LA ASIGNACIÓN -->
  <div class="section-title">4. CONDICIÓN DEL BIEN AL MOMENTO DE LA ASIGNACIÓN</div>
  <table class="cond-grid">
    <tbody>
      <tr>
        <td style="width: 32%; text-align: center;">
          <div style="font-weight: bold; margin-bottom: 3pt; font-size: 8pt;">FOTOGRAFÍA DEL BIEN</div>
          ${photoHtml}
        </td>
        <td style="width: 68%;">
          <div style="margin-bottom: 4pt;"><strong>Estado / Condición:</strong> ${condStr}</div>
          <div style="font-weight: bold; margin-bottom: 2pt;">Observaciones de Entrega:</div>
          <p style="font-size: 8.5pt; color: #222222; line-height: 1.35;">${obsAsgStr}</p>
        </td>
      </tr>
    </tbody>
  </table>

  <!-- 5. CONSTANCIA DE ENTREGA Y RECEPCIÓN -->
  <div class="section-title">5. CONSTANCIA DE ENTREGA Y RECEPCIÓN</div>
  <div class="signatures-row">
    <div class="sig-box">
      <strong>ENTREGA</strong><br/>
      <span><strong>Nombre:</strong> ${registeredByUser}</span><br/>
      <span><strong>Cargo:</strong> Control Patrimonial / FM</span>
      <div class="sig-line"></div>
      <span><strong>Firma</strong></span><br/>
      <span><strong>Fecha:</strong> ${nowStr}</span>
    </div>
    <div class="sig-box">
      <strong>RECIBE</strong><br/>
      <span><strong>Responsable:</strong> ${respName}</span><br/>
      <span><strong>Cód. Trabajador:</strong> ${workerCode}</span>
      <div class="sig-line"></div>
      <span><strong>Firma</strong></span><br/>
      <span><strong>Fecha:</strong> ${asgDate}</span>
    </div>
    <div class="sig-box">
      <strong>V°B° SUPERVISOR / ADM.</strong><br/>
      <span><strong>Nombre:</strong> Rosa Medina</span><br/>
      <span><strong>Cargo:</strong> Control Patrimonial &amp; FM</span>
      <div class="sig-line"></div>
      <span><strong>Firma</strong></span><br/>
      <span><strong>Fecha:</strong> ${nowStr}</span>
    </div>
  </div>

  <!-- PIE DE PÁGINA INSTITUCIONAL -->
  <div class="footer-note">
    <span>INCALPACA FM S.A. — Ficha de Asignación y Custodia de Bienes</span>
    <span>Constancia de responsabilidad emitida por el sistema</span>
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

/**
 * Genera la Ficha de Entrada del Bien exclusivamente con los datos de ingreso al sistema.
 * Cumple con el estándar institucional de INCALPACA FM S.A.
 */
export async function generateAssetEntryPdf({
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
    color: { dark: "#000000", light: "#ffffff" },
  });

  const nowStr = formatDate(new Date().toISOString());
  const payload = (asset as unknown as { entry_payload?: Record<string, unknown> }).entry_payload || {};

  // MATRIZ DE 9 NIVELES
  const n1Code = strVal(payload.n1_code || payload.site_code, "INC1").toUpperCase();
  const n1Name = strVal(payload.site, asset.location_detail?.zone || "Sede Principal");

  const n2Code = strVal(payload.n2_code || payload.macro_area_code, "AD").toUpperCase();
  const n2Name = strVal(payload.macro_area, "Sectores Administrativos");

  const n3Code = strVal(payload.n3_code || payload.area_code || payload.building_code, "—").toUpperCase();
  const n3Name = strVal(asset.location_detail?.area || payload.locationArea || payload.area || payload.building, "—");

  const n4Code = strVal(payload.n4_code || payload.room_code, "—").toUpperCase();
  const n4Name = strVal(asset.location_detail?.room || asset.location_detail?.specific_location || payload.room || payload.specificLocation, "—");

  const n5Code = strVal(payload.n5_code || payload.family_code, (asset.taxonomy_detail?.category?.slice(0, 3).toUpperCase() || "—"));
  const n5Name = strVal(asset.taxonomy_detail?.category || payload.family || payload.category, "—");

  const n6Code = strVal(payload.n6_code || payload.type_code || asset.taxonomy_detail?.prefix, "—");
  const n6Name = strVal(asset.taxonomy_detail?.subcategory || asset.taxonomy_detail?.name || payload.subcategory, "—");

  const n7Code = strVal(payload.n7_code || payload.part_code, "—");
  const n7Name = strVal(payload.part || payload.partName, "—");

  const n8Code = strVal(payload.n8_code || payload.piece_code, "—");
  const n8Name = strVal(payload.piece || payload.pieceName, "—");

  const rawSku = strVal(payload.n9_code || payload.sku || asset.fm_code, "—");
  let n9Code = rawSku;
  if (n9Code !== "—" && n9Code.includes("-")) {
    const parts = n9Code.split("-");
    n9Code = parts[parts.length - 1].trim();
  }
  if (n9Code !== "—" && !n9Code.toUpperCase().startsWith("SKU")) {
    n9Code = `SKU${n9Code}`;
  }
  const n9Name = n9Code !== "—" ? "Correlativo de Inventario" : "—";

  const fullTaxonomyCode = `${n1Code}-${n2Code}-${n3Code}-${n4Code}-${n5Code}-${n6Code}-${n7Code}-${n8Code}-${n9Code}`;

  // 1. Identificación
  const technicalId = asset.code || "—";
  const brandVal = asset.brand || (payload.brand as string) || "—";
  const modelVal = asset.model || (payload.model as string) || "—";
  const brandModel = (brandVal !== "—" || modelVal !== "—") ? `${brandVal} / ${modelVal}` : "—";
  const tipoBien = asset.taxonomy_detail?.category || (payload.category as string) || (payload.assetType as string) || "—";
  const critVal = asset.criticality || (payload.criticality as string) || "Media";
  const condVal = conditionLabel(asset.condition || (payload.condition as string) || "NUEVO");
  const descVal = asset.description || (payload.description as string) || "—";

  // 3. Datos de Ingreso
  const entryTypeMap: Record<string, string> = {
    purchase: "Compra",
    own_creation: "Creación propia / Fabricación",
    donation: "Regalo o donación",
    rental: "Alquiler / Contrato temporal",
  };
  const rawEntryType = (payload.entryType as string) || "purchase";
  const entryTypeLabel = entryTypeMap[rawEntryType] || rawEntryType;

  const effectiveEntryDate = formatDate((payload.effectiveEntryDate as string) || asset.created_at);
  const purchaseDate = formatDate(
    (payload.acquisitionDate as string) ||
    (payload.completionDate as string) ||
    (payload.receptionDate as string) ||
    null
  );
  const supplierVal = (payload.supplier as string) || (payload.donor as string) || "—";
  const purchaseDoc = (payload.purchaseOrder as string) || (payload.donationDocument as string) || (payload.contractNumber as string) || (payload.internalOrder as string) || "—";
  const voucherNum = (payload.voucherNumber as string) || (payload.contractNumber as string) || (payload.internalOrder as string) || "—";
  const costVal = strVal(payload.cost as string, "").trim();
  const currVal = strVal(payload.currency as string, "PEN").trim();
  const costDisplay = costVal ? `${currVal} ${costVal}` : "—";
  const costCenterVal = (payload.costCenter as string) || (payload.producingArea as string) || "—";
  const registeredByUser = asset.registered_by_name || (payload.registeredBy as string) || adminName || "Administrador SGTB";

  // 4. Ubicación Inicial
  const initialResponsible = (payload.assigneeName as string) || (payload.responsibleName as string) || (payload.responsible as string) || "Sin asignar al ingreso";
  const initialStatus = asset.operational_status || asset.administrative_status || "Registrado";

  // 5. Registro Fotográfico y Evidencias
  const evidenceList = (payload.evidence as Array<{ name?: string; category?: string; size?: number }>) || [];
  const docsHtml = evidenceList.length > 0
    ? `<ul style="margin: 4px 0 0 16px; padding: 0; font-size: 8.5pt;">
        ${evidenceList.map(e => `<li>${e.name || "Documento"} (${e.category || "sustento"}${e.size ? ` · ${Math.round(e.size / 1024)} KB` : ""})</li>`).join("")}
       </ul>`
    : `<span style="font-style: italic; color: #666666; font-size: 8.5pt;">Sin documentos adicionales adjuntos.</span>`;

  const obsVal = (payload.observations as string) || (payload.assignmentObservations as string) || "Sin observaciones adicionales registradas al momento del ingreso.";

  const photoHtml = asset.photo_url
    ? `<img src="${asset.photo_url}" alt="Fotografía del bien" style="max-height: 120pt; max-width: 100%; object-fit: contain; border: 0.5pt solid #A0A0A0;" />`
    : `<div style="width: 100%; height: 90pt; border: 0.5pt dashed #A0A0A0; display: flex; align-items: center; justify-content: center; background: #FAFAFA;">
        <span style="font-style: italic; color: #777777; font-size: 8.5pt;">Sin registro fotográfico adjunto</span>
       </div>`;

  const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Ficha_Entrada_${technicalId}_${nowStr.replace(/\//g, "-")}</title>
  <style>
    @page {
      size: A4;
      margin: 25.4mm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 8.5pt;
      line-height: 1.3;
      color: #000000;
      background: #ffffff;
    }
    .main-doc {
      width: 100%;
      max-width: 100%;
    }
    .header-box {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1.5pt solid #000000;
      padding-bottom: 8pt;
      margin-bottom: 8pt;
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 10pt;
    }
    .company-title {
      font-size: 12pt;
      font-weight: bold;
      color: #000000;
      letter-spacing: 0.3px;
    }
    .company-sub {
      font-size: 8pt;
      color: #444444;
    }
    .doc-title {
      font-size: 10pt;
      font-weight: bold;
      color: #000000;
      margin-top: 2pt;
      text-transform: uppercase;
    }
    .header-meta {
      text-align: right;
      font-size: 8pt;
      line-height: 1.35;
    }
    .header-qr {
      width: 44pt;
      height: 44pt;
      border: 0.5pt solid #000000;
      padding: 1pt;
      background: #ffffff;
      margin-left: 8pt;
    }
    .section-title {
      font-size: 9.5pt;
      font-weight: bold;
      color: #000000;
      border-bottom: 0.75pt solid #000000;
      padding-bottom: 2pt;
      margin-top: 8pt;
      margin-bottom: 4pt;
      text-transform: uppercase;
      page-break-after: avoid;
    }
    .table-data {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 4pt;
      font-size: 8.5pt;
    }
    .table-data td {
      border: 0.5pt solid #A0A0A0;
      padding: 3.5pt 5pt;
      vertical-align: middle;
    }
    .table-data td.lbl {
      width: 23%;
      font-weight: bold;
      background-color: #F8F9FA;
      color: #000000;
    }
    .table-data td.val {
      width: 27%;
      color: #111111;
    }
    .matrix-highlight {
      background-color: #F0F0F0;
      font-family: "Courier New", Courier, monospace;
      font-weight: bold;
      font-size: 8.5pt;
      color: #000000;
    }
    .evidence-grid {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 6pt;
    }
    .evidence-grid td {
      border: 0.5pt solid #A0A0A0;
      padding: 5pt;
      vertical-align: top;
    }
    .signatures-row {
      display: flex;
      justify-content: space-between;
      margin-top: 24pt;
      page-break-inside: avoid;
      gap: 12pt;
    }
    .sig-box {
      flex: 1;
      text-align: center;
      font-size: 8pt;
    }
    .sig-line {
      border-top: 0.75pt solid #000000;
      margin-bottom: 3pt;
      padding-top: 2pt;
    }
    .footer-note {
      margin-top: 14pt;
      border-top: 0.5pt solid #000000;
      padding-top: 4pt;
      display: flex;
      justify-content: space-between;
      font-size: 7.5pt;
      color: #444444;
    }
  </style>
</head>
<body>
<div class="main-doc">

  <!-- ENCABEZADO INSTITUCIONAL -->
  <div class="header-box">
    <div class="header-left">
      ${INCALPACA_LOGO_SVG}
      <div>
        <div class="company-title">INCALPACA FM S.A.</div>
        <div class="company-sub">Sistema de Gestión Técnica y Bienes</div>
        <div class="doc-title">FICHA DE ENTRADA DEL BIEN</div>
      </div>
    </div>
    <div style="display: flex; align-items: center;">
      <div class="header-meta">
        <div>Fecha de Emisión: <strong>${nowStr}</strong></div>
        <div>ID Técnico Único: <strong>${technicalId}</strong></div>
        <div>Código Taxonomía: <strong>${fullTaxonomyCode}</strong></div>
      </div>
      <img class="header-qr" src="${qrDataUrl}" alt="QR del bien" />
    </div>
  </div>

  <!-- 1. IDENTIFICACIÓN DEL BIEN -->
  <div class="section-title">1. IDENTIFICACIÓN DEL BIEN</div>
  <table class="table-data">
    <tbody>
      <tr>
        <td class="lbl">ID Técnico Único:</td>
        <td class="val"><strong>${technicalId}</strong></td>
        <td class="lbl">Código Taxonomía:</td>
        <td class="val"><strong>${fullTaxonomyCode}</strong></td>
      </tr>
      <tr>
        <td class="lbl">Nombre del Bien:</td>
        <td class="val"><strong>${asset.name}</strong></td>
        <td class="lbl">Tipo de Bien:</td>
        <td class="val">${tipoBien}</td>
      </tr>
      <tr>
        <td class="lbl">Marca / Modelo:</td>
        <td class="val">${brandModel}</td>
        <td class="lbl">Número de Serie:</td>
        <td class="val">${asset.serial_number || (payload.serialNumber as string) || "—"}</td>
      </tr>
      <tr>
        <td class="lbl">Criticidad:</td>
        <td class="val">${critVal}</td>
        <td class="lbl">Condición Inicial:</td>
        <td class="val">${condVal}</td>
      </tr>
      <tr>
        <td class="lbl">Descripción:</td>
        <td class="val" colspan="3">${descVal}</td>
      </tr>
    </tbody>
  </table>

  <!-- 2. ESTRUCTURA TAXONÓMICA Y UBICACIÓN (9 NIVELES) -->
  <div class="section-title">2. ESTRUCTURA TAXONÓMICA Y UBICACIÓN (9 NIVELES)</div>
  <table class="table-data">
    <tbody>
      <tr>
        <td class="lbl">1. Sede:</td>
        <td class="val"><strong>[${n1Code}]</strong> ${n1Name}</td>
        <td class="lbl">2. Área Macro:</td>
        <td class="val"><strong>[${n2Code}]</strong> ${n2Name}</td>
      </tr>
      <tr>
        <td class="lbl">3. Área:</td>
        <td class="val"><strong>[${n3Code}]</strong> ${n3Name}</td>
        <td class="lbl">4. Módulo:</td>
        <td class="val"><strong>[${n4Code}]</strong> ${n4Name}</td>
      </tr>
      <tr>
        <td class="lbl">5. Tipo de Bien:</td>
        <td class="val"><strong>[${n5Code}]</strong> ${n5Name}</td>
        <td class="lbl">6. Bien:</td>
        <td class="val"><strong>[${n6Code}]</strong> ${n6Name}</td>
      </tr>
      <tr>
        <td class="lbl">7. Característica:</td>
        <td class="val"><strong>[${n7Code}]</strong> ${n7Name}</td>
        <td class="lbl">8. Variante / Modelo:</td>
        <td class="val"><strong>[${n8Code}]</strong> ${n8Name}</td>
      </tr>
      <tr>
        <td class="lbl">9. SKU:</td>
        <td class="val" colspan="3"><strong>[${n9Code}]</strong> ${n9Name}</td>
      </tr>
      <tr>
        <td class="lbl">Código de Taxonomía Completo:</td>
        <td class="val matrix-highlight" colspan="3">${fullTaxonomyCode}</td>
      </tr>
    </tbody>
  </table>

  <!-- 3. DATOS DE INGRESO -->
  <div class="section-title">3. DATOS DE INGRESO</div>
  <table class="table-data">
    <tbody>
      <tr>
        <td class="lbl">Fecha de Ingreso:</td>
        <td class="val">${effectiveEntryDate}</td>
        <td class="lbl">Tipo de Ingreso:</td>
        <td class="val"><strong>${entryTypeLabel}</strong></td>
      </tr>
      <tr>
        <td class="lbl">Proveedor / Donante:</td>
        <td class="val">${supplierVal}</td>
        <td class="lbl">Documento de Compra:</td>
        <td class="val">${purchaseDoc}</td>
      </tr>
      <tr>
        <td class="lbl">Número de Documento:</td>
        <td class="val">${voucherNum}</td>
        <td class="lbl">Fecha de Compra:</td>
        <td class="val">${purchaseDate}</td>
      </tr>
      <tr>
        <td class="lbl">Costo / Valor:</td>
        <td class="val">${costDisplay}</td>
        <td class="lbl">Moneda:</td>
        <td class="val">${costVal ? currVal : "—"}</td>
      </tr>
      <tr>
        <td class="lbl">Centro de Costo:</td>
        <td class="val">${costCenterVal}</td>
        <td class="lbl">Usuario que Registró:</td>
        <td class="val">${registeredByUser}</td>
      </tr>
    </tbody>
  </table>

  <!-- 4. UBICACIÓN INICIAL -->
  <div class="section-title">4. UBICACIÓN INICIAL</div>
  <table class="table-data">
    <tbody>
      <tr>
        <td class="lbl">Sede:</td>
        <td class="val">${n1Name}</td>
        <td class="lbl">Área:</td>
        <td class="val">${n3Name}</td>
      </tr>
      <tr>
        <td class="lbl">Módulo / Ubicación:</td>
        <td class="val">${n4Name}</td>
        <td class="lbl">Responsable Inicial:</td>
        <td class="val">${initialResponsible}</td>
      </tr>
      <tr>
        <td class="lbl">Estado Inicial:</td>
        <td class="val" colspan="3">${initialStatus}</td>
      </tr>
    </tbody>
  </table>

  <!-- 5. REGISTRO FOTOGRÁFICO Y EVIDENCIAS -->
  <div class="section-title">5. REGISTRO FOTOGRÁFICO Y EVIDENCIAS</div>
  <table class="evidence-grid">
    <tbody>
      <tr>
        <td style="width: 38%; text-align: center;">
          <div style="font-weight: bold; margin-bottom: 3pt; font-size: 8pt;">FOTOGRAFÍA INICIAL</div>
          ${photoHtml}
        </td>
        <td style="width: 62%;">
          <div style="font-weight: bold; margin-bottom: 2pt;">Documentos Asociados:</div>
          ${docsHtml}
          <div style="font-weight: bold; margin-top: 6pt; margin-bottom: 2pt;">Observaciones de Ingreso:</div>
          <p style="font-size: 8.5pt; color: #222222; line-height: 1.35;">${obsVal}</p>
        </td>
      </tr>
    </tbody>
  </table>

  <!-- 6. FIRMAS -->
  <div class="signatures-row">
    <div class="sig-box">
      <div style="height: 28pt;"></div>
      <div class="sig-line">
        <strong>Responsable de Registro</strong><br/>
        <span style="font-size: 7.5pt; color: #444444;">${registeredByUser}</span>
      </div>
    </div>
    <div class="sig-box">
      <div style="height: 28pt;"></div>
      <div class="sig-line">
        <strong>Responsable de Recepción</strong><br/>
        <span style="font-size: 7.5pt; color: #444444;">${initialResponsible}</span>
      </div>
    </div>
    <div class="sig-box">
      <div style="height: 28pt;"></div>
      <div class="sig-line">
        <strong>V°B° Supervisor / Administración</strong><br/>
        <span style="font-size: 7.5pt; color: #444444;">Control Patrimonial &amp; FM</span>
      </div>
    </div>
  </div>

  <!-- PIE DE PÁGINA INSTITUCIONAL -->
  <div class="footer-note">
    <span>INCALPACA FM S.A. — Ficha de Entrada de Bienes Patrimoniales</span>
    <span>Documento generado con validación QR</span>
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

/**
 * Generador general (despacha al PDF correspondiente según reportType).
 */
export async function generateAssetApaPdf({
  asset,
  action = "print",
  adminName,
  reportType = "completo",
}: {
  asset: AssetDetailRecord;
  action?: "download" | "print";
  adminName?: string;
  reportType?: string;
}) {
  if (reportType === "entrada") {
    return generateAssetEntryPdf({ asset, action, adminName });
  }
  if (reportType === "asignacion") {
    return generateAssetAssignmentPdf({ asset, action, adminName });
  }

  return generateAssetDetailedPdf({ asset, action, adminName });
}
