/**
 * incalpacaReportStyles.ts
 * PLANTILLA MAESTRA - Estilos CSS compartidos para todos los reportes PDF institucionales de Incalpaca FM.
 * Basado en formato APA 7 y diseño corporativo formal.
 */

export const INCALPACA_LOGO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 105 105" fill="none">
  <rect x="0" y="0" width="35" height="35" fill="#000000" />
  <rect x="35" y="35" width="35" height="35" fill="#000000" />
  <rect x="70" y="70" width="35" height="35" fill="#000000" />
</svg>`;

export function getIncalpacaReportCSS(): string {
  return `
    /* ==========================================================================
       PLANTILLA MAESTRA SGTB INCALPACA FM S.A.
       Formato Institucional de Reportes (A4, Márgenes 20mm)
       ========================================================================== */

    @page {
      size: A4 portrait;
      margin: 12mm 15mm;
    }

    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: white;
    }

    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 10.5pt;
      color: #000000;
      text-align: left;
      line-height: 1.5;
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }

    .report-page,
    .report-wrapper,
    .main-report {
      width: 100%;
      max-width: 180mm;
      box-sizing: border-box;
      margin: 0 auto !important;
      padding: 0 !important;
    }

    table, img, svg, canvas, .section, .header, .footer, .page-header, .page-footer {
      max-width: 100% !important;
      box-sizing: border-box;
    }

    * {
      box-sizing: border-box;
      overflow-wrap: break-word;
    }

    /* ── 1. ENCABEZADO INSTITUCIONAL ── */
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #000000;
      padding-bottom: 14pt;
      margin-bottom: 18pt; /* Línea -> primera sección */
    }

    .logo-area {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .logo-area svg {
      flex-shrink: 0;
    }

    .company-block .company-name {
      font-size: 13pt;
      font-weight: bold;
      color: #000000;
      line-height: 1.2;
    }

    .company-block .company-subtitle {
      font-size: 10pt;
      color: #000000;
      line-height: 1.3;
      margin-top: 2px;
    }

    .company-block .report-name {
      font-size: 13pt;
      font-weight: bold;
      color: #000000;
      margin-top: 6px;
      text-transform: uppercase;
    }

    .header-right {
      text-align: right;
      font-size: 10.5pt;
      color: #000000;
      line-height: 1.4;
    }

    .header-right .doc-code {
      font-size: 11pt;
      font-weight: bold;
      color: #000000;
      display: block;
      margin-bottom: 4px;
    }

    /* ── 2. SECCIONES Y TÍTULOS ── */
    .section-heading {
      font-size: 11.5pt;
      font-weight: bold;
      text-transform: uppercase;
      color: #000000;
      margin-bottom: 9pt; /* 9-10 pt entre título y tabla */
      page-break-after: avoid;
      break-after: avoid;
    }

    .section-block {
      margin-bottom: 34pt; /* Aproximadamente 34 pt entre el final de una sección y el siguiente título */
    }

    .sub-heading {
      font-size: 10.5pt;
      font-weight: bold;
      color: #000000;
      margin-bottom: 6pt;
      page-break-after: avoid;
      break-after: avoid;
    }

    /* ── 3. TIPOGRAFÍA GENERAL ── */
    p.description-text {
      font-size: 9.5pt;
      margin-bottom: 8pt;
      text-align: justify;
    }

    .note-text {
      font-size: 9.5pt;
      font-style: italic;
      color: #808080; /* Texto auxiliar: 9.5 pt Italic gris */
    }

    /* ── 4. TABLAS MAESTRAS ── */
    table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: auto;
      margin-bottom: 8pt;
      table-layout: fixed; /* Prevents tables from expanding beyond 100% and causing right margin clip */
      word-wrap: break-word;
    }

    thead {
      display: table-header-group;
    }

    tr {
      page-break-inside: avoid;
      break-inside: avoid;
    }

    /* ESTILO A: TABLA DE DATOS (Identificación e Info General) */
    table.data-table {
      border: 1px solid #A0A0A0; /* Bordes finos gris #A0A0A0 */
    }

    table.data-table td {
      border: 1px solid #A0A0A0;
      padding: 6pt; /* Padding interno aproximado de 6 pt */
      vertical-align: middle;
      font-size: 10.5pt;
      color: #000000;
    }

    table.data-table td.label {
      background-color: #F4F4F4; /* Labels con fondo #F4F4F4 */
      font-weight: bold;
      width: 20%;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    table.data-table td.value {
      background-color: #FFFFFF; /* Valores con fondo blanco */
      width: 30%;
    }

    /* ESTILO B: TABLA DE REGISTROS / COSTOS (Desarrollo, Costos, Materiales) */
    table.records-table {
      border-bottom: 2px solid #000000;
    }

    table.records-table th {
      background-color: #000000; /* Encabezados en negro */
      color: #FFFFFF; /* Texto blanco */
      font-weight: bold;
      font-size: 10.5pt;
      padding: 6pt;
      text-align: left;
      border: 1px solid #000000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    table.records-table td {
      border-bottom: 1px solid #A0A0A0;
      border-left: 1px solid #A0A0A0;
      border-right: 1px solid #A0A0A0;
      padding: 6pt;
      font-size: 10.5pt;
      color: #000000;
      vertical-align: top;
      background-color: #FFFFFF;
    }

    table.records-table .text-right {
      text-align: right;
    }

    table.records-table .text-center {
      text-align: center;
    }

    table.records-table tr.total-row td {
      background-color: #E0E0E0; /* Fila TOTAL con fondo #E0E0E0 */
      font-weight: bold;
      border-top: 1px solid #000000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* ── 5. EVIDENCIAS FOTOGRÁFICAS ── */
    .photo-grid {
      display: table;
      width: 100%;
      table-layout: fixed;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    
    .photo-col {
      display: table-cell;
      width: 50%;
      padding: 0 10pt;
      text-align: center;
      vertical-align: top;
    }

    .photo-title {
      font-size: 9.5pt;
      font-weight: bold;
      margin-bottom: 8pt;
    }

    .photo-frame {
      width: 100%;
      height: 200px;
      border: 1px solid #A0A0A0;
      background-color: #F4F4F4;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    .photo-frame img {
      width: 100%;
      height: 100%;
      object-fit: contain; /* Mantener proporción */
    }

    .photo-empty {
      font-family: "Times New Roman", Times, serif;
      font-size: 9.5pt;
      font-style: italic;
      color: #808080;
    }

    /* ── 6. QR ── */
    .qr-block {
      display: table;
      width: 100%;
      page-break-inside: avoid;
      break-inside: avoid;
      margin-top: 8pt;
    }
    
    .qr-cell {
      display: table-cell;
      width: 140px;
      vertical-align: middle;
      text-align: center;
    }

    .qr-info {
      display: table-cell;
      vertical-align: middle;
      padding-left: 14pt;
    }

    .qr-cell img {
      width: 110px;
      height: 110px;
      display: block;
      margin: 0 auto 4pt;
      border: 1px solid #A0A0A0;
      background: #FFFFFF;
    }

    .qr-cell span {
      font-size: 8.5pt;
      color: #808080;
    }

    /* ── 7. FIRMAS (Reutilizable) ── */
    .signatures-block {
      margin-top: 40pt;
      display: table;
      width: 100%;
      table-layout: fixed;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .sig-cell {
      display: table-cell;
      padding: 0 20pt;
      text-align: center;
      vertical-align: bottom;
    }

    .sig-line {
      border-top: 1px solid #000000;
      width: 67mm; /* Línea de firma de aproximadamente 67 mm */
      margin: 0 auto 6pt auto;
    }

    .sig-role {
      font-size: 10.5pt;
      font-weight: bold;
      color: #000000;
      margin-bottom: 2pt;
    }

    .sig-name {
      font-size: 10.5pt;
      font-weight: normal;
      color: #000000;
    }

    /* ── PRINT MEDIA QUERIES ── */
    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      .page-footer {
        position: fixed;
      }
    }
  `;
}
