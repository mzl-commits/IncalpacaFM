import { Plus, MagnifyingGlass, Funnel, ArrowClockwise } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import { useAlmacenActivo } from "@/modules/almacen/AlmacenContext";
import { listMovimientos } from "@/modules/almacen/inventarioRepository";
import type { TipoMovimiento } from "@/modules/almacen/types";

export function MovimientosPage() {
  const { almacenId } = useAlmacenActivo();
  const [q, setQ] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<TipoMovimiento | "todos">("todos");
  const [pagina, setPagina] = useState(1);

  const {
    data: movimientosData,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["movimientos", almacenId, tipoFiltro, q, pagina],
    queryFn: () =>
      listMovimientos({
        almacenId,
        tipo: tipoFiltro === "todos" ? undefined : tipoFiltro,
        q,
        page: pagina,
      }),
    enabled: !!almacenId,
  });

  const lista = Array.isArray(movimientosData)
    ? movimientosData
    : movimientosData?.results ?? [];

  return (
    <section className="page-container">
      {/* Header */}
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <p className="breadcrumb">Almacén / Movimientos</p>
          <h1 style={{ margin: 0 }}>Historial de Movimientos</h1>
        </div>
        <Link
          to={`/almacen/${almacenId}/movimientos/nuevo`}
          className="button button-primary"
          style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          <Plus size={18} weight="bold" /> Registrar movimiento
        </Link>
      </div>

      {/* Controles y Filtros */}
      <div className="filter-bar" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ flex: 1, minWidth: 260, position: "relative" }}>
          <MagnifyingGlass size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }} />
          <input
            type="search"
            className="input-search"
            placeholder="Buscar por código, material o referencia..."
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPagina(1);
            }}
            style={{ paddingLeft: 36, width: "100%" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Funnel size={16} style={{ color: "var(--muted)" }} />
          <select
            value={tipoFiltro}
            onChange={(e) => {
              setTipoFiltro(e.target.value as TipoMovimiento | "todos");
              setPagina(1);
            }}
            style={{ padding: "8px 12px", borderRadius: 6, border: "1px solid var(--border)" }}
          >
            <option value="todos">Todos los tipos</option>
            <option value="entrada">Entradas / Devoluciones</option>
            <option value="salida">Salidas</option>
            <option value="baja">Bajas</option>
          </select>

          <button
            type="button"
            className="button button-ghost"
            onClick={() => refetch()}
            title="Recargar datos"
          >
            <ArrowClockwise size={16} className={isFetching ? "spin" : ""} />
          </button>
        </div>
      </div>

      {/* Tabla de Movimientos */}
      <div className="table-container" style={{ background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden" }}>
        {isLoading ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>Cargando historial de movimientos...</div>
        ) : lista.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--muted)" }}>
            No se encontraron movimientos registrados con los filtros aplicados.
          </div>
        ) : (
          <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ background: "var(--surface-subtle)", textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "12px 16px" }}>Fecha / Hora</th>
                <th style={{ padding: "12px 16px" }}>Tipo</th>
                <th style={{ padding: "12px 16px" }}>Material / Pieza</th>
                <th style={{ padding: "12px 16px" }}>Cantidad</th>
                <th style={{ padding: "12px 16px" }}>Responsable</th>
                <th style={{ padding: "12px 16px" }}>Referencia / OT</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((mov: any) => {
                const esEntrada = mov.tipo === "entrada";
                const esSalida = mov.tipo === "salida";
                const badgeColor = esEntrada ? "#dcfce7" : esSalida ? "#dbeafe" : "#fee2e2";
                const textColor = esEntrada ? "#15803d" : esSalida ? "#1d4ed8" : "#b91c1c";

                return (
                  <tr key={mov.id} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "12px 16px", whiteSpace: "nowrap" }}>
                      {mov.creado_at ? new Date(mov.creado_at).toLocaleString() : "—"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          background: badgeColor,
                          color: textColor,
                          padding: "3px 8px",
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: 600,
                          textTransform: "capitalize",
                        }}
                      >
                        {mov.tipo}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <strong>{mov.material_codigo || mov.pieza_codigo || "—"}</strong>
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>{mov.material_nombre || mov.pieza_nombre || "—"}</div>
                    </td>
                    <td style={{ padding: "12px 16px", fontWeight: 600 }}>
                      {mov.cantidad_cajas ? `${mov.cantidad_cajas} caja(s)` : `${mov.cantidad ?? 1} u.`}
                    </td>
                    <td style={{ padding: "12px 16px" }}>{mov.responsable_nombre || mov.usuario_nombre || "—"}</td>
                    <td style={{ padding: "12px 16px", fontSize: 13, color: "var(--muted)" }}>
                      {mov.referencia_externa || mov.work_order_code || "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}