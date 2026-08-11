import * as XLSX from "xlsx";

/** Descarga un libro XLSX real, con filtros y encabezados legibles. */
export function downloadExcel(filename: string, headers: string[], rows: unknown[][], sheetName = "Datos") {
  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  worksheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(rows.length, 1), c: headers.length - 1 } }) };
  worksheet["!cols"] = headers.map((header, column) => ({
    wch: Math.min(42, Math.max(String(header).length + 2, ...rows.map((row) => String(row[column] ?? "").length + 2))),
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName.slice(0, 31));
  XLSX.writeFile(workbook, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`, { compression: true });
}
