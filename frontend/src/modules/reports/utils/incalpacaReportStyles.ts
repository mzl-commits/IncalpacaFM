/**
 * incalpacaReportStyles.ts
 * Estilos CSS compartidos para todos los reportes institucionales de Incalpaca FM.
 * Formato APA 7 — Documento corporativo oficial.
 */

export const INCALPACA_LOGO_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 105 105" fill="none">
  <rect x="0" y="0" width="35" height="35" fill="#000000" />
  <rect x="35" y="35" width="35" height="35" fill="#000000" />
  <rect x="70" y="70" width="35" height="35" fill="#000000" />
</svg>`;

/** CSS base compartido para todos los reportes APA 7 corporativos de Incalpaca */
export function getIncalpacaReportCSS(): string {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Calibri&display=swap');

    @page {
      size: A4 portrait;
      margin: 25.4mm 25.4mm 25.4mm 25.4mm; /* APA 7: márgenes de 2.54 cm */
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: "Calibri", "Arial", "Times New Roman", serif;
      font-size: 11pt;
      line-height: 2;           /* APA 7: interlineado doble */
      color: #111111;
      background: #ffffff;
      text-align: left;         /* APA 7: alineado a la izquierda */
    }

    /* ── Encabezado de página (running head APA) ── */
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 2.5px solid #111111;
      padding-bottom: 10px;
      margin-bottom: 24px;
    }

    .logo-area {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .logo-area svg {
      flex-shrink: 0;
    }

    .company-block .company-name {
      font-size: 15pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      line-height: 1.2;
      color: #111111;
    }

    .company-block .company-subtitle {
      font-size: 8.5pt;
      text-transform: uppercase;
      letter-spacing: 1.2px;
      color: #555555;
      line-height: 1.4;
    }

    .header-right {
      text-align: right;
      font-size: 9pt;
      color: #444444;
      line-height: 1.5;
    }

    .header-right .doc-code {
      font-size: 12pt;
      font-weight: 700;
      color: #111111;
      display: block;
    }

    /* ── Número de página (esquina superior derecha APA) ── */
    .page-number {
      position: running(page-number);
      text-align: right;
      font-size: 9pt;
    }

    @page {
      @top-right {
        content: counter(page);
        font-family: "Calibri", "Arial", serif;
        font-size: 9pt;
      }
    }

    /* ── Título principal del documento ── */
    .doc-title-block {
      text-align: center;
      margin: 0 0 28px 0;
      padding: 18px 0;
      border-bottom: 1px solid #cccccc;
    }

    .doc-title-block h1 {
      font-size: 14pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      margin: 0 0 6px 0;
      line-height: 1.3;
    }

    .doc-title-block .doc-meta {
      font-size: 9.5pt;
      color: #555555;
      line-height: 1.8;
    }

    /* ── Secciones / Títulos APA ── */
    .section-heading {
      font-size: 12pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      border-bottom: 1.5px solid #111111;
      padding-bottom: 4px;
      margin-top: 28px;
      margin-bottom: 12px;
      page-break-after: avoid;
    }

    .section-heading.level2 {
      font-size: 11pt;
      font-weight: 700;
      text-transform: none;
      border-bottom: 1px solid #888888;
      letter-spacing: 0;
      margin-top: 20px;
    }

    /* ── Grilla de 2 columnas ── */
    .grid-2 {
      display: table;
      width: 100%;
      margin-bottom: 14px;
      border-spacing: 10px 0;
    }

    .grid-col {
      display: table-cell;
      width: 50%;
      vertical-align: top;
      padding-right: 10px;
    }

    .grid-col:last-child {
      padding-right: 0;
      padding-left: 10px;
    }

    /* ── Ficha de dato ── */
    .fact-card {
      border: 1px solid #dedede;
      padding: 9px 12px;
      margin-bottom: 10px;
      page-break-inside: avoid;
      background: #fafafa;
    }

    .fact-card dt {
      font-size: 8pt;
      text-transform: uppercase;
      font-weight: 700;
      color: #666666;
      letter-spacing: 0.5px;
      line-height: 1.4;
    }

    .fact-card dd {
      font-size: 11pt;
      font-weight: 700;
      color: #111111;
      margin: 3px 0 0 0;
      line-height: 1.4;
    }

    .fact-card dd.normal {
      font-weight: 400;
      font-size: 10.5pt;
    }

    /* ── Bloque de descripción (con sangría APA) ── */
    .description-block {
      text-indent: 1.27cm;   /* APA 7: sangría de primera línea */
      margin-bottom: 14px;
      font-size: 11pt;
      color: #333333;
      line-height: 2;
    }

    /* ── Tablas ── */
    table.report-table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0 18px 0;
      font-size: 10pt;
      page-break-inside: auto;
    }

    table.report-table thead tr {
      background: #111111;
      color: #ffffff;
    }

    table.report-table th {
      padding: 7px 10px;
      text-align: left;
      font-size: 9pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.4px;
    }

    table.report-table td {
      padding: 7px 10px;
      border-bottom: 1px solid #e8e8e8;
      vertical-align: top;
      line-height: 1.5;
    }

    table.report-table tbody tr:nth-child(even) {
      background: #f7f7f7;
    }

    table.report-table tbody tr:last-child td {
      border-bottom: 2px solid #111111;
    }

    table.report-table .td-empty {
      text-align: center;
      color: #888888;
      font-style: italic;
      padding: 14px;
    }

    /* ── Bloque de total / resumen financiero ── */
    .total-row {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 20px;
      background: #111111;
      color: #ffffff;
      padding: 8px 14px;
      font-size: 11pt;
      font-weight: 700;
      margin-bottom: 22px;
    }

    /* ── Hero de bien (foto + datos) ── */
    .hero-block {
      display: table;
      width: 100%;
      margin-bottom: 22px;
      border: 1px solid #dedede;
      background: #f8f8f8;
    }

    .hero-main {
      display: table-cell;
      padding: 16px;
      vertical-align: top;
    }

    .hero-qr {
      display: table-cell;
      width: 145px;
      text-align: center;
      padding: 14px;
      vertical-align: middle;
      border-left: 1px solid #dedede;
      background: #ffffff;
    }

    .hero-qr img {
      width: 110px;
      height: 110px;
      display: block;
      margin: 0 auto 6px;
    }

    .hero-qr small {
      font-size: 8pt;
      color: #777777;
      display: block;
      line-height: 1.3;
    }

    .code-badge {
      display: inline-block;
      background: #111111;
      color: #ffffff;
      font-family: "Courier New", monospace;
      font-size: 10.5pt;
      padding: 2px 10px;
      margin-bottom: 8px;
    }

    .asset-name {
      font-size: 16pt;
      font-weight: 700;
      margin: 0 0 8px 0;
      line-height: 1.2;
    }

    /* ── Firmas ── */
    .signatures-block {
      margin-top: 52px;
      display: table;
      width: 100%;
      text-align: center;
      page-break-inside: avoid;
    }

    .sig-cell {
      display: table-cell;
      width: 50%;
      padding: 0 20px;
      vertical-align: bottom;
    }

    .sig-line {
      border-top: 1px solid #111111;
      width: 75%;
      margin: 0 auto 8px auto;
    }

    .sig-name {
      font-size: 10.5pt;
      font-weight: 700;
    }

    .sig-role {
      font-size: 8.5pt;
      color: #666666;
      margin-top: 2px;
    }

    /* ── Pie de página ── */
    .page-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      border-top: 1px solid #cccccc;
      padding-top: 6px;
      display: flex;
      justify-content: space-between;
      font-size: 8pt;
      color: #777777;
    }

    /* ── Print ── */
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
