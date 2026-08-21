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

function strVal(val: unknown, fallback = "—"): string {
  if (val === null || val === undefined || val === "") return fallback;
  return String(val);
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
 * Generador general (despacha a generateAssetEntryPdf si el tipo es 'entrada' y a generateAssetAssignmentPdf si es 'asignacion').
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

  const publicUrl = asset.public_url || `${window.location.origin}/bienes/${asset.id}`;
  const qrDataUrl = await QRCode.toDataURL(publicUrl, {
    margin: 1,
    width: 200,
    color: { dark: "#111111", light: "#ffffff" },
  });

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

  const n5Code = (payload.n5_code as string) || (payload.family_code as string) || "—";
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

  const fullMatrixCode = `${n1Code} - ${n2Code} - ${n3Code} - ${n4Code} - ${n5Code} - ${n6Code} - ${n7Code} - ${n8Code} - ${n9Code}`;

  const responsibleName = activeResponsible?.responsible 
    || (payload.responsibleName as string) 
    || (payload.responsible as string) 
    || "No asignado";

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
        <div class="report-name">FICHA DETALLADA DEL BIEN</div>
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
