import {
  ArrowRight,
  CheckCircle,
  ClipboardText,
  Clock,
  MagnifyingGlass,
  XCircle,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAlmacenActivo } from "@/modules/almacen/AlmacenContext";
import { listGruposSolicitud, type GrupoSolicitud } from "@/modules/almacen/inventarioRepository";

const ESTADO_CONFIG = {
  pendiente: {
    label: "Pendiente",
    bg: "#fef3c7",
    color: "#92400e",
    icon: Clock,
  },
  aprobada: {
    label: "Aprobada",
    bg: "#dcfce7",
    color: "#166534",
    icon: CheckCircle,
  },
  rechazada: {
    label: "Rechazada",
    bg: "#fee2e2",
    color: "#991b1b",
    icon: XCircle,
  },
} as const;

export function SolicitudesMovimientoPage() {
  const { almacenId } = useAlmacenActivo();
  const [estadoFiltro, setEstadoFiltro] = useState<"todos" | "pendiente" | "aprobada" | "rechazada">("todos");
  const [q, setQ] = useState("");

  const { data: grupos = [], isLoading } = useQuery({
    queryKey: ["grupos-solicitud", almacenId, estadoFiltro],
    queryFn: () =>
      listGruposSolicitud(estadoFiltro === "todos" ? {} : { estado: estadoFiltro }),
    enabled: !!almacenId,
  });

  const lista = useMemo(() => {
    if (!q.trim()) return grupos;
    const term = q.trim().toLowerCase();
    return grupos.filter(
      (g: GrupoSolicitud) =>
        g.solicitado_por_nombre?.toLowerCase().includes(term) ||
        g.work_order_code?.toLowerCase().includes(term) ||
        g.observaciones?.toLowerCase().includes(term) ||
        String(g.id).includes(term),
    );
  }, [grupos, q]);

  const pendientes = grupos.filter((g) => g.estado === "pendiente").length;

  return (
    <section className="page-container">
      {/* Header */}
      <div
        className="page-header"
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}
      >
        <div>
          <p className="breadcrumb">Almacén / Movimientos / Solicitudes</p>
          <h1 style={{ margin: 0 }}>
            Solicitudes de salida
            {pendientes > 0 && (
              <span
                style={{
                  marginLeft: 10,
                  background: "#fef3c7",
                  color: "#92400e",
                  borderRadius: 12,
                  padding: "2px 10px",
                  fontSize: 14,
                  fontWeight: 700,
                  verticalAlign: "middle",
                }}
              >
                {pendientes} pendiente{pendientes !== 1 ? "s" : ""}
              </span>
            )}
          </h1>
          <p style={{ color: "var(--muted)", fontSize: 14, margin: "4px 0 0" }}>
            Solicitudes enviadas por los almaceneros para aprobación.
          </p>
        </div>
        <Link
          to={`/almacen/${almacenId}/movimientos`}
          className="button button-secondary"
          style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
        >
          ← Volver a movimientos
        </Link>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ flex: 1, minWidth: 240, position: "relative" }}>
          <MagnifyingGlass
            size={16}
            style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--muted)" }}
          />
          <input
            type="search"
            placeholder="Buscar por solicitante, OT o ID..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ paddingLeft: 36, width: "100%", padding: "8px 12px 8px 36px", borderRadius: 6, border: "1px solid var(--border)" }}
          />
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          {(["todos", "pendiente", "aprobada", "rechazada"] as const).map((estado) => (
            <button
              key={estado}
              type="button"
              onClick={() => setEstadoFiltro(estado)}
              style={{
                padding: "6px 14px",
                borderRadius: 6,
                border: `1px solid ${estadoFiltro === estado ? "var(--accent, #6366f1)" : "var(--border)"}`,
                background: estadoFiltro === estado ? "var(--accent, #6366f1)" : "var(--surface)",
                color: estadoFiltro === estado ? "#fff" : "var(--foreground)",
                fontWeight: estadoFiltro === estado ? 700 : 400,
                fontSize: 13,
                cursor: "pointer",
                transition: "all .15s",
              }}
            >
              {estado === "todos" ? "Todos" : ESTADO_CONFIG[estado].label}
            </button>
          ))}
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="loading-panel">Cargando solicitudes…</div>
      ) : lista.length === 0 ? (
        <div className="empty-row">
          <ClipboardText size={20} />
          No hay solicitudes {estadoFiltro !== "todos" ? `con estado "${ESTADO_CONFIG[estadoFiltro as keyof typeof ESTADO_CONFIG]?.label}"` : ""}.
        </div>
      ) : (
        <div
          style={{
            background: "var(--surface)",
            borderRadius: 8,
            border: "1px solid var(--border)",
            overflow: "hidden",
          }}
        >
          <table
            className="data-table"
            style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}
          >
            <thead>
              <tr style={{ background: "var(--surface-subtle)", textAlign: "left", borderBottom: "1px solid var(--border)" }}>
                <th style={{ padding: "12px 16px" }}>#</th>
                <th style={{ padding: "12px 16px" }}>Solicitante</th>
                <th style={{ padding: "12px 16px" }}>OT / Referencia</th>
                <th style={{ padding: "12px 16px", textAlign: "center" }}>Ítems</th>
                <th style={{ padding: "12px 16px" }}>Fecha</th>
                <th style={{ padding: "12px 16px" }}>Estado</th>
                <th style={{ padding: "12px 16px" }}></th>
              </tr>
            </thead>
            <tbody>
              {lista.map((grupo) => {
                const estadoCfg =
                  ESTADO_CONFIG[grupo.estado as keyof typeof ESTADO_CONFIG] ?? ESTADO_CONFIG.pendiente;
                const EstadoIcon = estadoCfg.icon;

                return (
                  <tr
                    key={grupo.id}
                    style={{
                      borderBottom: "1px solid var(--border)",
                      background: grupo.estado === "pendiente" ? "#fffbeb" : undefined,
                    }}
                  >
                    <td style={{ padding: "12px 16px", fontWeight: 700, color: "var(--muted)" }}>
                      #{grupo.id}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      {grupo.solicitado_por_nombre ?? "—"}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 13 }}>
                      {grupo.work_order_code ? (
                        <span>
                          <strong>{grupo.work_order_code}</strong>
                        </span>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>Sin OT</span>
                      )}
                      {grupo.observaciones && (
                        <div style={{ fontSize: 12, color: "var(--muted)", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {grupo.observaciones}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center", fontWeight: 600 }}>
                      {grupo.items?.length ?? 0}
                    </td>
                    <td style={{ padding: "12px 16px", whiteSpace: "nowrap", fontSize: 13, color: "var(--muted)" }}>
                      {new Date(grupo.creado_en).toLocaleString("es-PE", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          background: estadoCfg.bg,
                          color: estadoCfg.color,
                          padding: "3px 9px",
                          borderRadius: 12,
                          fontSize: 12,
                          fontWeight: 700,
                        }}
                      >
                        <EstadoIcon size={12} weight="bold" />
                        {estadoCfg.label}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "right" }}>
                      <Link
                        to={`/almacen/${almacenId}/movimientos/solicitudes/${grupo.id}`}
                        className="button button-secondary"
                        style={{ fontSize: 12, padding: "5px 12px", display: "inline-flex", alignItems: "center", gap: 6 }}
                      >
                        Ver detalle <ArrowRight size={13} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
