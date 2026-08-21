import { ArrowLeft, Check, CheckCircle, WarningCircle, XCircle } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAlmacenActivo } from "@/modules/almacen/AlmacenContext";
import {
  aprobarTodosGrupoSolicitud,
  getGrupoSolicitud,
  resolverParcialGrupoSolicitud,
  type ItemDecisionInput,
} from "@/modules/almacen/inventarioRepository";

export function SolicitudGrupoDetailPage() {
  const { almacenId } = useAlmacenActivo();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const grupoId = Number(id);

  const { data: grupo, isLoading, isError } = useQuery({
    queryKey: ["grupo-solicitud", grupoId],
    queryFn: () => getGrupoSolicitud(grupoId),
    enabled: !isNaN(grupoId),
  });

  // Estado local para decisiones por item (map de solicitudId -> { aprobado: boolean, motivo: string })
  const [decisiones, setDecisiones] = useState<Record<number, { aprobado: boolean; motivo: string }>>({});
  const [errorMsg, setErrorMsg] = useState("");
  const [erroresList, setErroresList] = useState<string[]>([]);
  const [exitoMsg, setExitoMsg] = useState("");

  // Inicializa mapa de decisiones cuando carga los items
  const items = grupo?.items ?? [];
  const itemsPendientes = items.filter((i) => i.estado === "pendiente");

  // Si todas las decisiones están marcadas o ninguna (o por defecto todo aprobado true)
  const allSelected = itemsPendientes.every((i) => (decisiones[i.id]?.aprobado ?? true) === true);
  const anyUnselected = itemsPendientes.some((i) => (decisiones[i.id]?.aprobado ?? true) === false);

  function toggleMaster(checked: boolean) {
    const next: Record<number, { aprobado: boolean; motivo: string }> = {};
    for (const item of itemsPendientes) {
      next[item.id] = {
        aprobado: checked,
        motivo: decisiones[item.id]?.motivo ?? "",
      };
    }
    setDecisiones(next);
  }

  function toggleItem(itemId: number, checked: boolean) {
    setDecisiones((prev) => ({
      ...prev,
      [itemId]: {
        aprobado: checked,
        motivo: prev[itemId]?.motivo ?? "",
      },
    }));
  }

  function setMotivo(itemId: number, motivo: string) {
    setDecisiones((prev) => ({
      ...prev,
      [itemId]: {
        aprobado: prev[itemId]?.aprobado ?? false,
        motivo,
      },
    }));
  }

  // Verificar si hay algún item desmarcado sin motivo
  const invalidoPorFaltaMotivo = itemsPendientes.some((item) => {
    const dec = decisiones[item.id];
    const estaAprobado = dec ? dec.aprobado : true;
    if (!estaAprobado && (!dec?.motivo || !dec.motivo.trim())) {
      return true;
    }
    return false;
  });

  const mutAprobarTodos = useMutation({
    mutationFn: () => aprobarTodosGrupoSolicitud(grupoId),
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["grupo-solicitud", grupoId] });
      qc.invalidateQueries({ queryKey: ["grupos-solicitud"] });
      qc.invalidateQueries({ queryKey: ["movimientos"] });
      setExitoMsg(res?.mensaje || "Se aprobó la solicitud.");
      if (res?.errores && Array.isArray(res.errores) && res.errores.length > 0) {
        setErrorMsg("Algunos items no se pudieron aprobar:");
        setErroresList(res.errores);
      } else {
        setErrorMsg("");
        setErroresList([]);
      }
    },
    onError: (err: any) => {
      const data = err?.response?.data;
      const mainMsg = data?.detail || err?.message || "No se pudo procesar la aprobación.";
      setErrorMsg(mainMsg);
      if (data?.errores && Array.isArray(data.errores)) {
        setErroresList(data.errores);
      } else {
        setErroresList([]);
      }
    },
  });

  const mutResolverParcial = useMutation({
    mutationFn: () => {
      const itemsPayload: ItemDecisionInput[] = itemsPendientes.map((item) => {
        const dec = decisiones[item.id];
        const aprobado = dec ? dec.aprobado : true;
        return {
          solicitud_id: item.id,
          aprobado,
          motivo_no_entrega: aprobado ? "" : dec?.motivo ?? "",
        };
      });
      return resolverParcialGrupoSolicitud(grupoId, itemsPayload);
    },
    onSuccess: (res: any) => {
      qc.invalidateQueries({ queryKey: ["grupo-solicitud", grupoId] });
      qc.invalidateQueries({ queryKey: ["grupos-solicitud"] });
      qc.invalidateQueries({ queryKey: ["movimientos"] });
      setExitoMsg(res?.mensaje || "Se procesó la solicitud.");
      if (res?.errores && Array.isArray(res.errores) && res.errores.length > 0) {
        setErrorMsg("Algunos items no se pudieron procesar:");
        setErroresList(res.errores);
      } else {
        setErrorMsg("");
        setErroresList([]);
      }
    },
    onError: (err: any) => {
      const data = err?.response?.data;
      const mainMsg = data?.detail || err?.message || "No se pudo procesar la solicitud.";
      setErrorMsg(mainMsg);
      if (data?.errores && Array.isArray(data.errores)) {
        setErroresList(data.errores);
      } else {
        setErroresList([]);
      }
    },
  });

  if (isLoading) {
    return (
      <section style={{ padding: 24 }}>
        <p>Cargando detalle del grupo de solicitudes…</p>
      </section>
    );
  }

  if (isError || !grupo) {
    return (
      <section style={{ padding: 24 }}>
        <div className="alert-banner alert-banner-error">
          <WarningCircle size={20} />
          <span>No se encontró el grupo de solicitudes especificado.</span>
        </div>
        <Link to={`/almacen/${almacenId}/movimientos`} className="button button-secondary" style={{ marginTop: 16 }}>
          <ArrowLeft size={16} /> Volver a movimientos
        </Link>
      </section>
    );
  }

  const otDetail = grupo.work_order_detail;

  return (
    <section style={{ maxWidth: 960, margin: "0 auto", paddingBottom: 40 }}>
      <div className="page-heading">
        <div>
          <p className="breadcrumb">
            <Link to={`/almacen/${almacenId}/movimientos`}>Movimientos</Link> / Solicitud de Grupo #{grupo.id}
          </p>
          <h1>Solicitud de salida #{grupo.id}</h1>
          <p>
            Solicitada por <strong>{grupo.solicitado_por_nombre}</strong> el{" "}
            {new Date(grupo.creado_en).toLocaleString("es-PE")}
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link to={`/almacen/${almacenId}/movimientos`} className="button button-secondary">
            <ArrowLeft size={16} /> Volver
          </Link>
        </div>
      </div>

      {exitoMsg && (
        <div className="alert-banner alert-banner-success" style={{ marginBottom: 20 }}>
          <CheckCircle size={20} />
          <span>{exitoMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="alert-banner alert-banner-error" style={{ marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 10 }}>
          <WarningCircle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>{errorMsg}</strong>
            {erroresList.length > 0 && (
              <ul style={{ margin: "6px 0 0 0", paddingLeft: 18, fontSize: 13 }}>
                {erroresList.map((errItem, idx) => (
                  <li key={idx}>{errItem}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* TARJETA RESUMEN DE ORDEN DE TRABAJO (SI TIENE OT) */}
      {otDetail ? (
        <div
          className="form-panel"
          style={{
            marginBottom: 24,
            borderLeft: "4px solid var(--accent-600, #2563eb)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <span style={{ fontSize: 12, textTransform: "uppercase", fontWeight: 700, color: "var(--accent-600, #2563eb)" }}>
                Orden de Trabajo Vinculada
              </span>
              <h2 style={{ fontSize: 18, margin: "4px 0 8px" }}>{otDetail.code}</h2>
              <p style={{ fontSize: 13, margin: 0, color: "var(--muted)" }}>
                Estado OT: <strong>{otDetail.status_display}</strong>
              </p>
            </div>
            <Link to={`/ordenes-trabajo/${otDetail.id}`} className="button button-secondary button-sm" target="_blank">
              Ver OT en pestaña nueva
            </Link>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border, #e5e7eb)" }}>
            <div>
              <small style={{ fontSize: 11, color: "var(--muted)", display: "block" }}>TÉCNICO PRINCIPAL</small>
              <strong style={{ fontSize: 13 }}>{otDetail.technician_name}</strong>
            </div>

            <div>
              <small style={{ fontSize: 11, color: "var(--muted)", display: "block" }}>TÉCNICOS DE APOYO</small>
              <strong style={{ fontSize: 13 }}>
                {otDetail.supporting_technicians.length > 0
                  ? otDetail.supporting_technicians.join(", ")
                  : "Ninguno"}
              </strong>
            </div>

            <div>
              <small style={{ fontSize: 11, color: "var(--muted)", display: "block" }}>ALMACENERO SOLICITANTE</small>
              <strong style={{ fontSize: 13 }}>{grupo.solicitado_por_nombre}</strong>
            </div>
          </div>
        </div>
      ) : (
        <div className="form-panel" style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
            Esta solicitud no está vinculada a ninguna Orden de Trabajo directa. Solicitada por: <strong>{grupo.solicitado_por_nombre}</strong>.
          </p>
        </div>
      )}

      {grupo.observaciones && (
        <div style={{ marginBottom: 20, padding: 12, background: "var(--surface-subtle, #f9fafb)", borderRadius: 8, border: "1px solid var(--border, #e5e7eb)" }}>
          <small style={{ fontSize: 11, color: "var(--muted)", display: "block" }}>OBSERVACIONES DEL ALMACENERO</small>
          <span style={{ fontSize: 13 }}>{grupo.observaciones}</span>
        </div>
      )}

      {/* TABLA CHECKLIST DE MATERIALES SOLICITADOS */}
      <div className="data-panel" style={{ padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, margin: 0 }}>Materiales Solicitados ({items.length})</h2>
          {itemsPendientes.length > 0 && (
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => toggleMaster(e.target.checked)}
              />
              Aceptar todos los materiales
            </label>
          )}
        </div>

        <div className="table-scroll">
          <table className="tabla-detalle-mobile">
            <thead>
              <tr>
                <th style={{ width: 40 }}>Aprobar</th>
                <th>Código</th>
                <th>Material / Pieza</th>
                <th>Cantidad</th>
                <th>Estado</th>
                <th>Motivo no entrega / Observación</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const dec = decisiones[item.id];
                const estaAprobado = dec ? dec.aprobado : true;
                const esPendiente = item.estado === "pendiente";

                return (
                  <tr key={item.id} style={{ background: !estaAprobado && esPendiente ? "#fff1f2" : undefined }}>
                    <td style={{ textAlign: "center" }}>
                      {esPendiente ? (
                        <input
                          type="checkbox"
                          checked={estaAprobado}
                          onChange={(e) => toggleItem(item.id, e.target.checked)}
                        />
                      ) : item.estado === "aprobada" ? (
                        <Check size={18} style={{ color: "var(--success, #16a34a)" }} />
                      ) : (
                        <XCircle size={18} style={{ color: "var(--error, #dc2626)" }} />
                      )}
                    </td>
                    {/* Código: usa pieza_codigo si no hay material_codigo */}
                    <td style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap" }}>
                      {item.material_codigo ?? item.pieza_codigo ?? "—"}
                    </td>
                    {/* Nombre: usa pieza_nombre + detalle si no hay material_nombre */}
                    <td style={{ fontSize: 13 }}>
                      {item.material_nombre ?? (
                        item.pieza_nombre
                          ? <span>{item.pieza_nombre}{item.pieza_detalle ? <span style={{ fontSize: 11, color: "var(--muted)", display: "block" }}>{item.pieza_detalle}</span> : null}</span>
                          : "—"
                      )}
                    </td>
                    <td style={{ fontSize: 13, fontWeight: 600 }}>
                      {item.pieza
                        ? "1 u." /* las piezas son unitarias */
                        : item.cantidad_cajas
                          ? `${item.cantidad_cajas} emp. (${item.cantidad} u.)`
                          : `${item.cantidad} u.`}
                    </td>
                    <td>
                      <span
                        className={`status-badge status-${item.estado}`}
                        style={{
                          fontSize: 11,
                          padding: "2px 8px",
                          borderRadius: 12,
                          background: item.estado === "aprobada" ? "#dcfce7" : item.estado === "rechazada" ? "#fee2e2" : "#fef3c7",
                          color: item.estado === "aprobada" ? "#166534" : item.estado === "rechazada" ? "#991b1b" : "#92400e",
                          fontWeight: 600,
                        }}
                      >
                        {item.estado_display}
                      </span>
                    </td>
                    <td>
                      {esPendiente ? (
                        !estaAprobado ? (
                          <input
                            type="text"
                            placeholder="Motivo de no entrega (obligatorio) *"
                            value={dec?.motivo ?? ""}
                            onChange={(e) => setMotivo(item.id, e.target.value)}
                            style={{
                              width: "100%",
                              padding: "4px 8px",
                              fontSize: 12,
                              borderColor: !dec?.motivo?.trim() ? "var(--error, #dc2626)" : undefined,
                            }}
                          />
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--muted)" }}>—</span>
                        )
                      ) : (
                        <span style={{ fontSize: 12, color: "var(--muted)" }}>
                          {item.motivo_no_entrega || item.motivo_rechazo || "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* BOTONES DE ACCIÓN SI HAY PENDIENTES */}
        {itemsPendientes.length > 0 && (
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid var(--border, #e5e7eb)", display: "flex", gap: 12, justifyContent: "flex-end" }}>
            {anyUnselected && (
              <button
                type="button"
                className="button button-primary"
                disabled={invalidoPorFaltaMotivo || mutResolverParcial.isPending}
                onClick={() => mutResolverParcial.mutate()}
                style={{ background: "var(--accent-600, #2563eb)" }}
              >
                {mutResolverParcial.isPending ? "Guardando…" : "Guardar aprobación parcial"}
              </button>
            )}

            <button
              type="button"
              className="button button-primary"
              disabled={mutAprobarTodos.isPending}
              onClick={() => mutAprobarTodos.mutate()}
            >
              {mutAprobarTodos.isPending ? "Procesando…" : "Conceder permiso a todos"}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
