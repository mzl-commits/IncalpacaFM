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
    : `<tr><td colspan="6" class="td-empty">Sin historial de custodia registrado.</td></tr>`;

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
    : `<tr><td colspan="6" class="td-empty">Sin historial de mantenimiento registrado.</td></tr>`;

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

  <!-- ENCABEZADO INSTITUCIONAL -->
  <div class="page-header">
    <div class="logo-area">
      ${INCALPACA_LOGO_SVG}
      <div class="company-block">
        <div class="company-name">Incalpaca FM S.A.</div>
        <div class="company-subtitle">Sistema de Gestión Técnica y Bienes</div>
        <div class="company-subtitle" style="letter-spacing:0.5px; margin-top:2px;">Control Patrimonial y Facilidades</div>
      </div>
    </div>
    <div class="header-right">
      <span class="doc-code">${displayCode}</span>
      <span>Emitido: ${nowStr}</span><br/>
      <span>Estado operativo: <strong>${conditionLabel(asset.condition)}</strong></span><br/>
      <span>Criticidad: ${asset.criticality || "—"}</span>
    </div>
  </div>

  <!-- TÍTULO DEL DOCUMENTO -->
  <div class="doc-title-block">
    <h1>Ficha Técnica Oficial de Activo Patrimonial</h1>
    <div class="doc-meta">
      Código FM: <strong>${displayCode}</strong> &nbsp;·&nbsp;
      Identificador técnico: <strong>${asset.code}</strong> &nbsp;·&nbsp;
      Registrado: <strong>${formatDate(asset.created_at)}</strong>
    </div>
  </div>

  <!-- BLOQUE HERO: NOMBRE + DATOS CLAVE + QR -->
  <div class="hero-block">
    <div class="hero-main">
      <div class="code-badge">${displayCode}</div>
      <h2 class="asset-name">${asset.name}</h2>
      <div class="description-block" style="margin-bottom:14px; font-size:10.5pt;">
        ${asset.description || "Sin descripción registrada para este activo."}
      </div>
      <div class="grid-2">
        <div class="grid-col">
          <div class="fact-card">
            <dt>Marca / Modelo</dt>
            <dd>${[asset.brand, asset.model].filter(Boolean).join(" — ") || "No registrado"}</dd>
          </div>
          <div class="fact-card">
            <dt>Número de Serie</dt>
            <dd>${asset.serial_number || "Sin número de serie"}</dd>
          </div>
        </div>
        <div class="grid-col">
          <div class="fact-card">
            <dt>Condición Operativa</dt>
            <dd>${conditionLabel(asset.condition)}</dd>
          </div>
          <div class="fact-card">
            <dt>Nivel de Criticidad</dt>
            <dd>${asset.criticality || "No registrado"}</dd>
          </div>
        </div>
      </div>
    </div>
    <div class="hero-qr">
      <img src="${qrDataUrl}" alt="QR de verificación"/>
      <strong style="font-size:9pt; display:block; margin-bottom:4px;">Verificación QR</strong>
      <small>Escanear para acceso público y trazabilidad del activo</small>
    </div>
  </div>

  <!-- SECCIÓN 1: CLASIFICACIÓN Y TAXONOMÍA -->
  <div class="section-heading">1. Clasificación Técnica y Taxonomía</div>
  <div class="grid-2">
    <div class="grid-col">
      <div class="fact-card">
        <dt>Clasificación Técnica</dt>
        <dd class="normal">${taxonomyStr}</dd>
      </div>
      <div class="fact-card">
        <dt>Tipo de Ingreso al Sistema</dt>
        <dd>${asset.entry_type_label || "No especificado"}</dd>
      </div>
    </div>
    <div class="grid-col">
      <div class="fact-card">
        <dt>Estado Administrativo</dt>
        <dd>${asset.administrative_status || "No especificado"}</dd>
      </div>
      <div class="fact-card">
        <dt>Estado de Asignación</dt>
        <dd>${asset.assignment_status || "No especificado"}</dd>
      </div>
    </div>
  </div>

  <!-- SECCIÓN 2: UBICACIÓN Y CUSTODIA ACTUAL -->
  <div class="section-heading">2. Ubicación Física y Custodia Actual</div>
  <div class="grid-2">
    <div class="grid-col">
      <div class="fact-card">
        <dt>Ubicación Física Registrada</dt>
        <dd class="normal">${locationStr}</dd>
      </div>
    </div>
    <div class="grid-col">
      <div class="fact-card">
        <dt>Responsable / Custodio Actual</dt>
        <dd>${activeResponsible?.responsible || "Sin asignar"}</dd>
      </div>
      <div class="fact-card">
        <dt>Área de Custodia</dt>
        <dd class="normal">${activeResponsible?.area || "—"}</dd>
      </div>
    </div>
  </div>

  <!-- SECCIÓN 3: HISTORIAL DE CUSTODIA -->
  <div class="section-heading">3. Historial de Custodia y Responsables</div>
  <table class="report-table">
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

  <!-- SECCIÓN 4: HISTORIAL DE MANTENIMIENTO -->
  <div class="section-heading">4. Historial de Mantenimiento y Reparaciones</div>
  <table class="report-table">
    <thead>
      <tr>
        <th>N.° Orden</th>
        <th>Tipo</th>
        <th>Problema / Trabajo</th>
        <th>Técnico</th>
        <th>Condición Resultante</th>
        <th style="text-align:right;">Costo</th>
      </tr>
    </thead>
    <tbody>
      ${repairRows}
    </tbody>
  </table>

  <!-- SECCIÓN 5: REGISTRO Y TRAZABILIDAD -->
  <div class="section-heading">5. Datos de Registro y Trazabilidad Digital</div>
  <div class="grid-2">
    <div class="grid-col">
      <div class="fact-card">
        <dt>Registrado por</dt>
        <dd>${asset.registered_by_name || "Sistema"}</dd>
      </div>
      <div class="fact-card">
        <dt>Fecha de Alta en Sistema</dt>
        <dd>${formatDate(asset.created_at)}</dd>
      </div>
    </div>
    <div class="grid-col">
      <div class="fact-card">
        <dt>URL de Verificación Pública</dt>
        <dd class="normal" style="font-size:8.5pt; word-break:break-all;">${publicUrl}</dd>
      </div>
      <div class="fact-card">
        <dt>Normas de Referencia</dt>
        <dd class="normal" style="font-size:9pt;">APA 7 · ISO 55000 · NTP-ISO 55001</dd>
      </div>
    </div>
  </div>

  <!-- FIRMAS -->
  <div class="signatures-block">
    <div class="sig-cell">
      <div class="sig-line"></div>
      <div class="sig-name">${activeResponsible?.responsible || "Responsable / Custodio del Bien"}</div>
      <div class="sig-role">Firma de Custodia y Conformidad</div>
    </div>
    <div class="sig-cell">
      <div class="sig-line"></div>
      <div class="sig-name">V°B° Control Patrimonial &amp; FM</div>
      <div class="sig-role">Administración de Activos — Incalpaca FM S.A.</div>
    </div>
  </div>

  <!-- PIE DE PÁGINA -->
  <div class="page-footer">
    <span>SGTB Incalpaca FM — Ficha Técnica Oficial · ${nowStr}</span>
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

  const printWindow = window.open("", "_blank");
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
}
