import { Plus, MagnifyingGlass, Funnel, ArrowClockwise, FileXls, ClipboardText } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAlmacenActivo } from "@/modules/almacen/AlmacenContext";
import { listMovimientos, listGruposSolicitud, descargarExcelMovimientos } from "@/modules/almacen/inventarioRepository";
import { useAuth } from "@/modules/accounts/AuthContext";
import type { TipoMovimiento } from "@/modules/almacen/types";

export function MovimientosPage() {
  const { almacenId } = useAlmacenActivo();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState<TipoMovimiento | "todos">("todos");
  const [exportando, setExportando] = useState(false);

  const esAdmin = user?.role === "ADMINISTRADOR";

  async function handleExportarExcel() {
    setExportando(true);
    try {
      await descargarExcelMovimientos();
    } finally {
      setExportando(false);
    }
  }

  const {
    data: movimientos,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["movimientos", almacenId, tipoFiltro],
    queryFn: () =>
      listMovimientos(almacenId, {
        tipo: tipoFiltro === "todos" ? undefined : tipoFiltro,
      }),
    enabled: !!almacenId,
  });

  const { data: gruposPendientes = [] } = useQuery({
    queryKey: ["grupos-solicitud", "pendiente"],
    queryFn: () => listGruposSolicitud({ estado: "pendiente" }),
    enabled: esAdmin,
  });

  // Filtro de búsqueda integral: código, material, ubicación, cantidad, stock crítico, responsable y OT.
  const lista = useMemo(() => {
    const base = movimientos ?? [];
    if (!q.trim()) return base;

    const term = q.trim().toLowerCase();
    const esNumero = !isNaN(Number(term));
    const numTerm = Number(term);

    return base.filter((mov: any) => {
      const campos = [
        mov.material_codigo,
        mov.material_nombre,
        mov.material_ubicacion,
        mov.pieza_codigo,
        mov.pieza_nombre,
        mov.referencia_externa,
        mov.work_order_code,
        mov.responsable_nombre,
        mov.observaciones,
      ];

      // Coincidencia textual en campos
      if (campos.some((campo) => campo?.toString().toLowerCase().includes(term))) {
        return true;
      }

      // Coincidencia en cantidad
      if (
        mov.cantidad?.toString().includes(term) ||
        mov.cantidad_cajas?.toString().includes(term)
      ) {
        return true;
      }

      // Búsqueda por término de stock crítico / bajo
      if (
        term === "critico" ||
        term === "crítico" ||
        term === "stock critico" ||
        term === "stock crítico" ||
        term === "bajo" ||
        term === "stock bajo"
      ) {
        if (
          mov.material_stock_minimo > 0 &&
          mov.material_cantidad_total <= mov.material_stock_minimo
        ) {
          return true;
        }
      }

      // Coincidencia numérica con cantidad o stock crítico
      if (
        esNumero &&
        (mov.cantidad === numTerm ||
          mov.material_stock_minimo === numTerm ||
          mov.material_cantidad_total === numTerm)
      ) {
        return true;
      }

      return false;
    });
  }, [movimientos, q]);

  return (
    <section className="page-container">
      {/* Header */}
      <div
        className="page-header"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}
      >
        <div>
          <p className="breadcrumb">Almacén / Movimientos</p>
          <h1 style={{ margin: 0 }}>Historial de Movimientos</h1>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {esAdmin && (
            <>
              {gruposPendientes.length > 0 && (
                <Link
                  to={`/almacen/${almacenId}/movimientos/solicitudes`}
                  className="button button-secondary"
                  style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                >
                  <ClipboardText size={17} />
                  Solicitudes
                  <span style={{ background: "#f59e0b", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 12, fontWeight: 700 }}>
                    {gruposPendientes.length}
                  </span>
                </Link>
              )}
              <button
                type="button"
                className="button button-secondary"
                onClick={handleExportarExcel}
                disabled={exportando}
                style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
              >
                <FileXls size={17} /> {exportando ? "Exportando…" : "Exportar Excel"}
              </button>
            </>
          )}
          <Link
            to={`/almacen/${almacenId}/movimientos/nuevo`}
            className="button button-primary"
            style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            <Plus size={18} weight="bold" /> Registrar movimiento
          </Link>
        </div>
      </div>

      {/* Controles y Filtros */}
      <div className="filter-bar" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ flex: 1, minWidth: 260, position: "relative" }}>
          <MagnifyingGlass
            size={16}
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}
          />
          <input
            type="search"
            className="input-search"
            placeholder="Buscar por código, material, ubicación, cantidad, stock crítico u OT..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ paddingLeft: 36, width: "100%" }}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Funnel size={16} style={{ color: "var(--muted)" }} />
          <select
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value as TipoMovimiento | "todos")}
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
      <div
        className="table-container"
        style={{ background: "var(--surface)", borderRadius: 8, border: "1px solid var(--border)", overflow: "hidden" }}
      >
        {isLoading ? (
          <div style={{ padding: 32, textAlign: "center", color: "var(--muted)" }}>
            Cargando historial de movimientos...
          </div>
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
                      {mov.fecha ? new Date(mov.fecha).toLocaleString("es-PE") : "—"}
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
                      <div style={{ fontSize: 12, color: "var(--muted)" }}>
                        {mov.material_nombre || mov.pieza_nombre || "—"}
                      </div>
                      {mov.material_ubicacion && (
                        <div style={{ fontSize: 11, color: "var(--primary, #2563eb)", marginTop: 2 }}>
                          📍 {mov.material_ubicacion}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", fontWeight: 600 }}>
                      {mov.cantidad_cajas
                        ? `${mov.cantidad_cajas} emp. (${mov.cantidad} u.)`
                        : `${mov.cantidad ?? 1} u.`}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {mov.responsable_nombre || mov.usuario_nombre || "—"}
                    </td>
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