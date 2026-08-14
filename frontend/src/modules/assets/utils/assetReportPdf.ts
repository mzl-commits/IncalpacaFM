import QRCode from "qrcode";
import type { AssetDetailRecord } from "../assetDetailRepository";

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

  const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>Ficha Técnica - ${displayCode}</title>
  <style>
    @page {
      size: A4;
      margin: 15mm;
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #111111;
      background: #ffffff;
      margin: 0;
      padding: 0;
      font-size: 12px;
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #111111;
      padding-bottom: 12px;
      margin-bottom: 20px;
    }
    .logo-group {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .company-title {
      font-weight: 800;
      font-size: 16px;
      letter-spacing: -0.5px;
      text-transform: uppercase;
    }
    .doc-type {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #555555;
    }
    .header-meta {
      text-align: right;
      font-size: 11px;
    }
    .header-meta strong {
      display: block;
      font-size: 13px;
    }
    .hero-grid {
      display: grid;
      grid-template-columns: 1fr 150px;
      gap: 20px;
      background: #f8f9fa;
      border: 1px solid #e4e4e4;
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 20px;
    }
    .asset-title {
      font-size: 20px;
      font-weight: 800;
      margin: 0 0 4px 0;
    }
    .asset-code-badge {
      display: inline-block;
      background: #111111;
      color: #ffffff;
      font-family: monospace;
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 4px;
      margin-bottom: 8px;
    }
    .qr-box {
      text-align: center;
      background: #ffffff;
      border: 1px solid #e4e4e4;
      padding: 8px;
      border-radius: 6px;
    }
    .qr-box img {
      width: 110px;
      height: 110px;
      display: block;
      margin: 0 auto 4px auto;
    }
    .qr-box small {
      font-size: 9px;
      color: #666666;
    }
    .section-title {
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #111111;
      padding-bottom: 4px;
      margin: 20px 0 10px 0;
    }
    .grid-2 {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .fact-card {
      border: 1px solid #e4e4e4;
      padding: 10px;
      border-radius: 4px;
    }
    .fact-card dt {
      font-size: 10px;
      text-transform: uppercase;
      color: #666666;
      font-weight: 600;
    }
    .fact-card dd {
      margin: 2px 0 0 0;
      font-weight: 700;
      font-size: 13px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      font-size: 11px;
    }
    th {
      background: #111111;
      color: #ffffff;
      text-transform: uppercase;
      font-size: 10px;
      padding: 6px 10px;
      text-align: left;
    }
    td {
      padding: 6px 10px;
      border-bottom: 1px solid #eeeeee;
    }
    .footer {
      margin-top: 30px;
      border-top: 1px solid #e4e4e4;
      padding-top: 10px;
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      color: #666666;
    }
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>

  <div class="header">
    <div class="logo-group">
      <svg width="32" height="32" viewBox="0 0 100 100" fill="none">
        <rect x="10" y="10" width="35" height="35" fill="#111111" />
        <rect x="55" y="10" width="35" height="35" fill="#111111" />
        <rect x="10" y="55" width="35" height="35" fill="#111111" />
      </svg>
      <div>
        <div class="company-title">Incalpaca FM</div>
        <div class="doc-type">Sistema de Gestión Técnica y Bienes</div>
      </div>
    </div>
    <div class="header-meta">
      <strong>FICHA TÉCNICA OFICIAL DE ACTIVO</strong>
      <span>Emitido: ${nowStr}</span>
    </div>
  </div>

  <div class="hero-grid">
    <div>
      <div class="asset-code-badge">${displayCode}</div>
      <h1 class="asset-title">${asset.name}</h1>
      <p style="margin: 4px 0 12px 0; color: #444444;">${asset.description}</p>
      
      <div class="grid-2">
        <div class="fact-card">
          <dt>Marca / Modelo</dt>
          <dd>${[asset.brand, asset.model].filter(Boolean).join(" ") || "No registrado"}</dd>
        </div>
        <div class="fact-card">
          <dt>Número de Serie</dt>
          <dd>${asset.serial_number || "Sin serie registrada"}</dd>
        </div>
        <div class="fact-card">
          <dt>Condición Operativa</dt>
          <dd>${asset.condition}</dd>
        </div>
        <div class="fact-card">
          <dt>Criticidad Patrimonio</dt>
          <dd>${asset.criticality}</dd>
        </div>
      </div>
    </div>

    <div class="qr-box">
      <img src="${qrDataUrl}" alt="QR" />
      <strong>Verificación QR</strong>
      <small>Escanea para trazabilidad pública</small>
    </div>
  </div>

  <div class="section-title">Ubicación y Custodia Actual</div>
  <div class="grid-2" style="margin-bottom: 16px;">
    <div class="fact-card">
      <dt>Ubicación Física</dt>
      <dd>${asset.location_detail ? `${asset.location_detail.building} / ${asset.location_detail.area} / ${asset.location_detail.room}` : "Ubicación General"}</dd>
    </div>
    <div class="fact-card">
      <dt>Responsable Actual</dt>
      <dd>${asset.responsible_history.find(r => r.status === "ACTIVA")?.responsible || asset.responsible_history[0]?.responsible || "Sin asignar"}</dd>
    </div>
  </div>

  <div class="section-title">Historial de Custodia y Responsables</div>
  <table>
    <thead>
      <tr>
        <th>Responsable</th>
        <th>Área</th>
        <th>Fecha Inicio</th>
        <th>Estado</th>
        <th>Motivo</th>
      </tr>
    </thead>
    <tbody>
      ${
        asset.responsible_history.length > 0
          ? asset.responsible_history.map(r => `
            <tr>
              <td><strong>${r.responsible}</strong></td>
              <td>${r.area || "N/A"}</td>
              <td>${formatDate(r.start_date)}</td>
              <td>${r.status}</td>
              <td>${r.reason || "Asignación técnica"}</td>
            </tr>
          `).join("")
          : `<tr><td colSpan="5" style="text-align: center; color: #888;">Sin historial previo registrado</td></tr>`
      }
    </tbody>
  </table>

  <div class="section-title">Historial de Mantenimiento y Reparaciones</div>
  <table>
    <thead>
      <tr>
        <th>Orden Trabajo</th>
        <th>Tipo</th>
        <th>Problema / Trabajo</th>
        <th>Técnico</th>
        <th>Costo</th>
      </tr>
    </thead>
    <tbody>
      ${
        asset.repair_history.length > 0
          ? asset.repair_history.map(m => `
            <tr>
              <td><strong>${m.work_order}</strong></td>
              <td>${m.type}</td>
              <td>${m.issue} - ${m.work_performed}</td>
              <td>${m.technician_name}</td>
              <td>${m.cost}</td>
            </tr>
          `).join("")
          : `<tr><td colSpan="5" style="text-align: center; color: #888;">Sin mantenimiento registrado</td></tr>`
      }
    </tbody>
  </table>

  <div style="margin-top: 45px; display: flex; justify-content: space-around; text-align: center; page-break-inside: avoid;">
    <div>
      <div style="border-bottom: 1px solid #111111; width: 220px; margin-bottom: 6px;"></div>
      <strong>Responsable del Activo / Custodio</strong>
      <div style="font-size: 10px; color: #555555;">${asset.responsible_history.find(r => r.status === "ACTIVA")?.responsible || "Firma de Custodia"}</div>
    </div>
    <div>
      <div style="border-bottom: 1px solid #111111; width: 220px; margin-bottom: 6px;"></div>
      <strong>V°B° Control Patrimonial & FM</strong>
      <div style="font-size: 10px; color: #555555;">Administración de Activos SGTB</div>
    </div>
  </div>

  <div class="footer">
    <span>SGTB Incalpaca FM — Documento Técnico Oficial</span>
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
