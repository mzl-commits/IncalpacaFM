import type { ReactNode } from "react";

export interface ColDef<T> {
  key: string;
  header: string;
  width?: string;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: ColDef<T>[];
  rows: T[];
  keyFn: (row: T) => string | number;
  emptyMessage?: string;
  loading?: boolean;
}

export function DataTable<T>({
  columns,
  rows,
  keyFn,
  emptyMessage = "No hay registros.",
  loading = false,
}: DataTableProps<T>) {
  if (loading) {
    return <div className="loading-panel">Cargando…</div>;
  }

  return (
    <div className="table-scroll" role="region" aria-label="tabla de datos">
      <table>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={col.width ? { width: col.width } : undefined}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={keyFn(row)}>
              {columns.map((col) => (
                <td key={col.key}>{col.render(row)}</td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="empty-row">
                {emptyMessage}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
