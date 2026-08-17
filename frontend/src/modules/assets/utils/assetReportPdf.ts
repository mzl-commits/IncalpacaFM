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

  const activeResponsible = asset.responsible_history?.find(r => r.status === "ACTIVA")
    ?? asset.responsible_history?.[0]
    ?? null;

  const locationStr = asset.location_detail
    ? [
        asset.location_detail.building,
        asset.location_detail.area,
        asset.location_detail.room,
        asset.location_detail.specific_location,
      ].filter(Boolean).join(" / ")
    : "Ubicación no registrada";

  const taxonomyStr = asset.taxonomy_detail
    ? [
        asset.taxonomy_detail.asset_type,
        asset.taxonomy_detail.category,
        asset.taxonomy_detail.subcategory,
      ].filter(Boolean).join(" › ")
    : "Sin clasificar";

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
      <span>Tipo: FICHA DE BIEN</span>
    </div>
  </div>

  <!-- SECCIÓN 1: IDENTIFICACIÓN Y DESCRIPCIÓN -->
  <div class="section-block">
    <div class="section-heading">1. DATOS DE IDENTIFICACIÓN Y DESCRIPCIÓN DEL BIEN</div>
    <table class="data-table">
      <tbody>
        <tr>
          <td class="label">Código FM:</td>
          <td class="value">${displayCode}</td>
          <td class="label">Identificador Técnico:</td>
          <td class="value">${asset.code}</td>
        </tr>
        <tr>
          <td class="label">Nombre del Activo:</td>
          <td class="value" colspan="3"><strong>${asset.name}</strong></td>
        </tr>
        <tr>
          <td class="label">Descripción:</td>
          <td class="value" colspan="3">${asset.description || "Sin descripción registrada."}</td>
        </tr>
        <tr>
          <td class="label">Marca / Modelo:</td>
          <td class="value">${[asset.brand, asset.model].filter(Boolean).join(" — ") || "No registrado"}</td>
          <td class="label">Número de Serie:</td>
          <td class="value">${asset.serial_number || "Sin número de serie"}</td>
        </tr>
        <tr>
          <td class="label">Criticidad:</td>
          <td class="value">${asset.criticality || "No registrado"}</td>
          <td class="label">Clasificación:</td>
          <td class="value">${taxonomyStr}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- SECCIÓN 2: UBICACIÓN Y CUSTODIA -->
  <div class="section-block">
    <div class="section-heading">2. UBICACIÓN FÍSICA Y CUSTODIA ACTUAL</div>
    <table class="data-table">
      <tbody>
        <tr>
          <td class="label">Ubicación Física:</td>
          <td class="value">${locationStr}</td>
          <td class="label">Área de Custodia:</td>
          <td class="value">${activeResponsible?.area || "—"}</td>
        </tr>
        <tr>
          <td class="label">Responsable Actual:</td>
          <td class="value">${activeResponsible?.responsible || "Sin asignar"}</td>
          <td class="label">Estado de Asignación:</td>
          <td class="value">${asset.assignment_status || "No especificado"}</td>
        </tr>
      </tbody>
    </table>
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
      <div class="sig-name">${activeResponsible?.responsible || "Custodio del Bien"}</div>
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
