export const INCALPACA_LOGO_SVG = `<svg width="42" height="42" viewBox="0 0 90 90" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="0"  y="0"  width="38" height="38" fill="#000000"/>
  <rect x="26" y="26" width="38" height="38" fill="#000000"/>
  <rect x="52" y="52" width="38" height="38" fill="#000000"/>
</svg>`;


export function getIncalpacaReportCSS() {
  return `
    @page {
      size: A4;
      margin: 1.5cm 1.5cm 1.2cm 1.5cm;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: "Times New Roman", Times, serif;
      font-size: 9.5pt;
      line-height: 1.35;
      color: #111111;
      background: #ffffff;
      padding-top: 10pt;
    }
    .main-report {
      width: 100%;
      max-width: 100%;
    }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2pt solid #000000;
      padding-bottom: 14pt;
      margin-bottom: 18pt;
    }
    .logo-area {
      display: flex;
      align-items: center;
      gap: 16pt;
    }
    .company-block {
      display: flex;
      flex-direction: column;
      gap: 3pt;
    }
    .company-name {
      font-size: 14pt;
      font-weight: bold;
      letter-spacing: 0.5px;
      color: #000000;
    }
    .company-subtitle {
      font-size: 8.5pt;
      color: #555555;
    }
    .report-name {
      font-size: 10.5pt;
      font-weight: bold;
      margin-top: 2pt;
      color: #000000;
    }
    .header-right {
      text-align: right;
      font-size: 9pt;
      line-height: 1.4;
    }
    .section-block {
      margin-bottom: 14pt;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .section-heading {
      font-size: 10.5pt;
      font-weight: bold;
      color: #000000;
      border-bottom: 1pt solid #000000;
      padding-bottom: 3pt;
      margin-bottom: 6pt;
      text-transform: uppercase;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4pt;
    }
    .data-table td {
      border: 0.5pt solid #A0A0A0;
      padding: 4.5pt 6pt;
      font-size: 9pt;
      vertical-align: middle;
    }
    .data-table td.label {
      background-color: #F8F9FA;
      font-weight: bold;
      color: #000000;
    }
    .records-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 6pt;
    }
    .records-table th {
      background-color: #000000;
      color: #FFFFFF;
      font-weight: bold;
      font-size: 9pt;
      padding: 5pt 6pt;
      border: 0.5pt solid #000000;
      text-align: left;
    }
    .records-table td {
      border: 0.5pt solid #A0A0A0;
      padding: 4.5pt 6pt;
      font-size: 8.5pt;
    }
    .matrix-box-container {
      border: 1pt solid #000000;
      background-color: #FFFFFF;
      padding: 8pt;
      margin-top: 8pt;
      margin-bottom: 10pt;
    }
    .matrix-box-title {
      font-size: 9pt;
      font-weight: bold;
      color: #000000;
      margin-bottom: 4pt;
    }
    .matrix-box-banner {
      background-color: #000000;
      color: #FFFFFF;
      font-family: "Times New Roman", Times, serif;
      font-size: 10.5pt;
      font-weight: bold;
      padding: 6pt 8pt;
      text-align: center;
    }
    .photo-grid {
      display: flex;
      gap: 12pt;
      margin-top: 6pt;
    }
    .photo-col {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .photo-title {
      font-size: 9pt;
      font-weight: bold;
      margin-bottom: 4pt;
    }
    .photo-frame {
      width: 100%;
      height: 140pt;
      border: 0.5pt solid #A0A0A0;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: #FAFAFA;
      overflow: hidden;
    }
    .photo-frame img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    .photo-empty {
      font-style: italic;
      color: #808080;
      font-size: 8.5pt;
    }
    .qr-block {
      display: flex;
      align-items: center;
      gap: 16pt;
      border: 0.5pt solid #A0A0A0;
      padding: 8pt;
      margin-top: 6pt;
    }
    .qr-cell {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4pt;
    }
    .qr-cell img {
      width: 90pt;
      height: 90pt;
    }
    .qr-cell span {
      font-size: 7.5pt;
      color: #555555;
    }
    .qr-info {
      flex: 1;
    }
    .signatures-block {
      display: flex;
      justify-content: space-around;
      margin-top: 30pt;
      page-break-inside: avoid;
    }
    .sig-cell {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 180pt;
    }
    .sig-line {
      width: 100%;
      border-top: 1pt solid #000000;
      margin-bottom: 4pt;
    }
    .sig-role {
      font-weight: bold;
      font-size: 9pt;
    }
    .sig-name {
      font-size: 8.5pt;
      color: #333333;
    }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
  `;
}
