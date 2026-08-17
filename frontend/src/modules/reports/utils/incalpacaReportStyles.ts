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
       Formato Institucional de Reportes (A4, Márgenes 25.4mm)
       ========================================================================== */

    @page {
      size: A4 portrait;
      margin: 25.4mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 10pt;
      color: #111111;
      background: #ffffff;
      text-align: left;
      line-height: 1.5;
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
      font-size: 9.5pt;
      color: #555555;
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
      font-size: 9.5pt;
      color: #111111;
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
      font-size: 11pt;
      font-weight: bold;
      text-transform: uppercase;
      color: #000000;
      margin-bottom: 10pt; /* Título -> contenido */
      page-break-after: avoid;
      break-after: avoid;
    }

    .section-block {
      margin-bottom: 18pt; /* Entre bloques */
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
      font-size: 10pt;
      margin-bottom: 8pt; /* Entre párrafos */
      text-align: justify;
    }

    .note-text {
      font-size: 9pt;
      font-style: italic;
      color: #777777;
    }

    /* ── 4. TABLAS MAESTRAS ── */
    table {
      width: 100%;
      border-collapse: collapse;
      page-break-inside: auto;
      margin-bottom: 8pt;
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
      border: 1px solid #A0A0A0;
    }

    table.data-table td {
      border: 1px solid #A0A0A0;
      padding: 7pt;
      vertical-align: middle;
      font-size: 9.5pt;
    }

    table.data-table td.label {
      background-color: #F4F4F4;
      font-weight: bold;
      width: 20%;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    table.data-table td.value {
      background-color: #FFFFFF;
      width: 30%;
    }

    /* ESTILO B: TABLA DE REGISTROS / COSTOS (Desarrollo, Costos, Materiales) */
    table.records-table {
      border-bottom: 2px solid #000000;
    }

    table.records-table th {
      background-color: #000000;
      color: #FFFFFF;
      font-weight: bold;
      font-size: 9.5pt;
      padding: 7pt;
      text-align: left;
      border: 1px solid #000000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    table.records-table td {
      border-bottom: 1px solid #A0A0A0;
      border-left: 1px solid #A0A0A0;
      border-right: 1px solid #A0A0A0;
      padding: 7pt;
      font-size: 9.5pt;
      vertical-align: top;
    }

    table.records-table tr:nth-child(even) td {
      background-color: #F8F8F8;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    table.records-table .text-right {
      text-align: right;
    }

    table.records-table .text-center {
      text-align: center;
    }

    table.records-table tr.total-row td {
      background-color: #E0E0E0;
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
      font-size: 10pt;
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
      object-fit: contain;
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
      color: #555555;
    }

    /* ── 7. FIRMAS (Reutilizable) ── */
    .signatures-block {
      margin-top: 40pt; /* Antes de firmas: 30-50 pt */
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
      width: 80%;
      margin: 0 auto 6pt auto;
    }

    .sig-role {
      font-size: 10pt;
      font-weight: bold;
      color: #000000;
      margin-bottom: 2pt;
    }

    .sig-name {
      font-size: 9.5pt;
      color: #111111;
    }

    /* ── 8. PIE DE PÁGINA INSTITUCIONAL ── */
    .page-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      border-top: 1px solid #A0A0A0;
      padding-top: 4pt;
      display: flex;
      justify-content: space-between;
      font-size: 8.5pt;
      color: #555555;
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
