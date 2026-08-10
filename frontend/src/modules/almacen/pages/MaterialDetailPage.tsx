import {
  ArrowLeft, ArrowRight, ClipboardText, Package, PencilSimple, Plus, Trash, WarningCircle,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { StatusBadge } from "@/components/shared/StatusBadge";
import { TrimestreBadge } from "@/components/shared/TrimestreBadge";
import { deleteMaterial, deleteMaterialForzado, deletePieza, desvinculaPieza, getMaterialDetalle, agregarHijaInline } from "@/modules/almacen/catalogoRepository";
import { labelPieza } from "@/utils/pieza";
import { listMovimientos } from "@/modules/almacen/inventarioRepository";
import { listInspecciones } from "@/modules/almacen/inspeccionRepository";
import { STOCK_MINIMO, tipoControlLabels } from "@/modules/almacen/types";
import type { PiezaAnidada, PiezaBase } from "@/modules/almacen/types";
import { AjustarStockPanel } from "@/modules/almacen/components/AjustarStockPanel";

export function MaterialDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const materialId = Number(id);

  const { data: material, isLoading, error } = useQuery({
    queryKey: ["material", materialId],
    queryFn: () => getMaterialDetalle(materialId),
    enabled: !!materialId,
  });

  const { data: movimientos = [] } = useQuery({
    queryKey: ["movimientos", { material: materialId }],
    queryFn: () => listMovimientos({ material: materialId }),
    enabled: !!materialId,
  });

  const { data: inspecciones = [] } = useQuery({
    queryKey: ["inspecciones", { material: materialId }],
    queryFn: () => listInspecciones({ material: materialId }),
    enabled: !!materialId,
  });

  const [confirmDelete, setConfirmDelete] = useState(false); // eslint-disable-line -- kept for safety
  // "idle" | "confirming" | "force_required" | "force_confirming"
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirming" | "force_required" | "force_confirming">("idle");

  const deleteMut = useMutation({
    mutationFn: () => deleteMaterial(materialId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["materiales"] });
      navigate("/almacen/catalogo");
    },
    onError: (err: unknown) => {
      const status = (err as { response?: { status?: number } })?.response?.status;
      // 409 = tiene datos asociados, ofrecer eliminación forzada
      if (status === 409) {
        setDeleteStep("force_required");
      } else {
        setDeleteStep("idle");
        alert("No se pudo eliminar. Intenta de nuevo.");
      }
    },
  });

  const deleteForzadoMut = useMutation({
    mutationFn: () => deleteMaterialForzado(materialId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["materiales"] });
      navigate("/almacen/catalogo");
    },
    onError: () => {
      setDeleteStep("idle");
      alert("Error al eliminar. Intenta de nuevo.");
    },
  });

  const isDeletePending = deleteMut.isPending || deleteForzadoMut.isPending;

  if (isLoading)
    return <div className="loading-panel">Cargando ficha del material…</div>;
  if (error || !material)
    return (
      <div className="loading-panel">
        No se pudo cargar el material.{" "}
        <button className="button button-secondary" onClick={() => navigate(-1)}>
          Volver
        </button>
      </div>
    );

  const stockAlerta =
    !material.control_individual && material.cantidad_total < STOCK_MINIMO;
  const ultimaInspeccion = inspecciones[0]?.fecha ?? null;

  return (
    <section>
      {/* Cabecera */}
      <div className="wizard-heading">
        <Link to="/almacen/catalogo" className="back-link">
          <ArrowLeft size={16} /> Catálogo
        </Link>
        <div>
          <p className="breadcrumb">Almacén / Catálogo / {material.codigo}</p>
          <h1>{material.nombre}</h1>
          <p>{material.subcategoria_nombre} · {material.categoria_nombre}</p>
        </div>
        <div className="material-header-actions">
          {material.control_individual && (
            <Link
              className="button button-primary button-sm"
              to={`/almacen/catalogo/${material.id}/alta-piezas`}
            >
              <Plus size={14} /> Alta de piezas
            </Link>
          )}
          <Link
            className="button button-secondary button-sm"
            to={`/almacen/movimientos/nuevo?material=${material.id}`}
          >
            <ArrowRight size={14} /> Registrar movimiento
          </Link>
          {material.control_individual && (
            <Link
              className="button button-secondary button-sm"
              to={`/almacen/inspecciones/nueva?material=${material.id}`}
            >
              <ClipboardText size={14} /> Nueva inspección
            </Link>
          )}
          <Link
            className="button button-secondary button-sm"
            to={`/almacen/catalogo/${material.id}/editar`}
          >
            <PencilSimple size={14} /> Editar
          </Link>
          <button
            type="button"
            className="button button-danger-subtle button-sm"
            onClick={() => setDeleteStep("confirming")}
          >
            <Trash size={14} /> Eliminar
          </button>
        </div>
      </div>

      {/* ── Modal de eliminación (2 pasos) ── */}
      {deleteStep !== "idle" && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999,
        }}>
          <div style={{
            background: "var(--surface, #fff)", borderRadius: 12, padding: 28,
            maxWidth: 440, width: "92%", boxShadow: "0 8px 40px rgba(0,0,0,.25)",
          }}>

            {/* Paso 1: confirmación normal */}
            {deleteStep === "confirming" && (
              <>
                <h2 style={{ marginTop: 0, fontSize: 18 }}>Eliminar material</h2>
                <p style={{ color: "var(--muted)", marginBottom: 20 }}>
                  ¿Seguro que deseas eliminar{" "}
                  <strong>{material.codigo} — {material.nombre}</strong>?
                </p>
                <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                  <button
                    className="button button-secondary"
                    onClick={() => setDeleteStep("idle")}
                    disabled={isDeletePending}
                  >Cancelar</button>
                  <button
                    className="button"
                    style={{ background: "var(--error, #dc2626)", color: "#fff", borderColor: "transparent" }}
                    onClick={() => deleteMut.mutate()}
                    disabled={isDeletePending}
                  >
                    {deleteMut.isPending ? "Eliminando…" : "Sí, eliminar"}
                  </button>
                </div>
              </>
            )}

            {/* Paso 2: material con datos → ofrecer eliminación forzada */}
            {(deleteStep === "force_required" || deleteStep === "force_confirming") && (
              <>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 16 }}>
                  <WarningCircle size={28} style={{ color: "var(--error, #dc2626)", flexShrink: 0 }} weight="fill" />
                  <div>
                    <h2 style={{ marginTop: 0, fontSize: 17 }}>El material tiene datos asociados</h2>
                    <p style={{ color: "var(--muted)", margin: 0, fontSize: 13 }}>
                      <strong>{material.codigo} — {material.nombre}</strong> tiene piezas, movimientos
                      o inspecciones registradas.
                    </p>
                  </div>
                </div>

                {deleteStep === "force_required" && (
                  <>
                    <div style={{
                      padding: "10px 14px", background: "#fef2f2", borderRadius: 8,
                      border: "1px solid #fca5a5", fontSize: 13, marginBottom: 20,
                    }}>
                      Si deseas eliminarlo, se borrarán también <strong>todas sus piezas, movimientos
                      e inspecciones</strong>. Esta acción es <strong>irreversible</strong>.
                    </div>
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                      <button
                        className="button button-secondary"
                        onClick={() => setDeleteStep("idle")}
                      >Cancelar</button>
                      <button
                        className="button"
                        style={{ background: "var(--error, #dc2626)", color: "#fff", borderColor: "transparent" }}
                        onClick={() => setDeleteStep("force_confirming")}
                      >
                        Eliminar todo igualmente
                      </button>
                    </div>
                  </>
                )}

                {deleteStep === "force_confirming" && (
                  <>
                    <div style={{
                      padding: "12px 14px", background: "#fef2f2", borderRadius: 8,
                      border: "2px solid #dc2626", fontSize: 13, marginBottom: 20,
                    }}>
                      ⚠️ Última confirmación: se eliminarán <strong>permanentemente</strong> el material,
                      todas sus piezas, movimientos e inspecciones.
                    </div>
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                      <button
                        className="button button-secondary"
                        onClick={() => setDeleteStep("idle")}
                        disabled={isDeletePending}
                      >Cancelar</button>
                      <button
                        className="button"
                        style={{ background: "#7f1d1d", color: "#fff", borderColor: "transparent" }}
                        onClick={() => deleteForzadoMut.mutate()}
                        disabled={isDeletePending}
                      >
                        {deleteForzadoMut.isPending ? "Eliminando todo…" : "Confirmar eliminación total"}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <div className="wizard-layout">
        {/* Panel principal */}
        <div style={{ display: "grid", gap: 20 }}>
          {/* Ficha del material */}
          <div className="form-panel">
            <div className="form-section-heading" style={{ marginBottom: 16 }}>
              <span>Datos del material</span>
              <h2>{material.codigo}</h2>
            </div>

            {material.foto && (
              <img
                src={material.foto}
                alt={`Foto de ${material.nombre}`}
                className="foto-preview"
              />
            )}

            <dl className="review-card dl" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "14px 20px", margin: 0 }}>
              <div><dt style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase" }}>Marca / Modelo</dt><dd style={{ margin: "4px 0 0", fontSize: 13 }}>{[material.marca, material.modelo].filter(Boolean).join(" / ") || "—"}</dd></div>
              <div><dt style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase" }}>Medida</dt><dd style={{ margin: "4px 0 0", fontSize: 13 }}>{material.medida || "—"}</dd></div>
              <div><dt style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase" }}>Tipo de control</dt><dd style={{ margin: "4px 0 0", fontSize: 13 }}>{tipoControlLabels[material.tipo_control]}</dd></div>
              <div><dt style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase" }}>Control individual</dt><dd style={{ margin: "4px 0 0", fontSize: 13 }}>{material.control_individual ? "Sí" : "No"}</dd></div>
              <div><dt style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase" }}>Ubicación física</dt><dd style={{ margin: "4px 0 0", fontSize: 13 }}>{material.ubicacion_fisica || "—"}</dd></div>
              <div>
                <dt style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase" }}>Precio de referencia</dt>
                <dd style={{ margin: "4px 0 0", fontSize: 13 }}>
                  {material.precio !== null && material.precio !== undefined && material.precio !== ""
                    ? `S/ ${Number(material.precio).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase" }}>Cantidad / Piezas</dt>
                <dd style={{ margin: "4px 0 0", fontSize: 13 }}>
                  {material.cantidad_total}{" "}
                  {stockAlerta && (
                    <span className="stock-alert-badge">
                      <WarningCircle size={13} /> Stock bajo
                    </span>
                  )}
                </dd>
              </div>
              {material.grosor_mm && <div><dt style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase" }}>Grosor (mm)</dt><dd style={{ margin: "4px 0 0", fontSize: 13 }}>{material.grosor_mm}</dd></div>}
              {material.largo_mm && <div><dt style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase" }}>Largo (mm)</dt><dd style={{ margin: "4px 0 0", fontSize: 13 }}>{material.largo_mm}</dd></div>}
            </dl>
          </div>

          {/* Ajuste de stock (solo materiales sin control individual) */}
          {!material.control_individual && (
            <AjustarStockPanel material={material} />
          )}

          {/* Árbol de piezas (solo si control_individual=true) */}
          {material.control_individual && (
            <div className="data-panel">
              <div className="table-toolbar">
                <strong style={{ fontSize: 15 }}>Piezas ({material.cantidad_total})</strong>
                <Link
                  className="button button-secondary"
                  to={`/almacen/catalogo/${material.id}/alta-piezas`}
                  style={{ fontSize: 13 }}
                >
                  <Plus size={14} /> Alta de piezas
                </Link>
              </div>
              <div className="pieza-tree">
                {material.piezas.length === 0 && (
                  <p className="empty-row">Sin piezas registradas aún.</p>
                )}
                {material.piezas.map((pieza) => (
                  <PiezaTreeRow
                    key={pieza.id}
                    pieza={pieza}
                    mostrarTrimestre={ultimaInspeccion}
                    materialId={materialId}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Historial de movimientos */}
          <div className="data-panel">
            <div className="table-toolbar">
              <strong style={{ fontSize: 15 }}>Movimientos</strong>
              <Link
                to={`/almacen/movimientos?material=${material.id}`}
                className="table-action"
                style={{ fontSize: 13 }}
              >
                Ver todos
              </Link>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Pieza / Cant.</th>
                    <th>Responsable</th>
                    <th>Referencia</th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.slice(0, 10).map((mov) => (
                    <tr key={mov.id}>
                      <td style={{ fontSize: 12 }}>
                        {new Date(mov.fecha).toLocaleDateString("es-PE")}
                      </td>
                      <td>
                        <StatusBadge value={mov.tipo} label={mov.tipo_display} />
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {mov.pieza_codigo ?? `${mov.cantidad} u.`}
                      </td>
                      <td style={{ fontSize: 12 }}>{mov.responsable_nombre}</td>
                      <td style={{ fontSize: 12, color: "var(--muted)" }}>
                        {mov.referencia_externa || "—"}
                      </td>
                    </tr>
                  ))}
                  {movimientos.length === 0 && (
                    <tr>
                      <td colSpan={5} className="empty-row">Sin movimientos.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Historial de inspecciones */}
          <div className="data-panel">
            <div className="table-toolbar">
              <strong style={{ fontSize: 15 }}>Inspecciones</strong>
              <Link
                to={`/almacen/inspecciones/nueva?material=${material.id}`}
                className="button button-secondary"
                style={{ fontSize: 13 }}
              >
                <Plus size={14} /> Nueva
              </Link>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>Resultado</th>
                    <th>Inspector</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {inspecciones.slice(0, 5).map((insp) => (
                    <tr key={insp.id}>
                      <td style={{ fontSize: 12 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {new Date(insp.fecha).toLocaleDateString("es-PE")}
                          <TrimestreBadge fecha={insp.fecha} />
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>{insp.tipo === "individual" ? "Individual" : "Grupal"}</td>
                      <td><StatusBadge value={insp.resultado_general} /></td>
                      <td style={{ fontSize: 12 }}>{insp.inspector_nombre}</td>
                      <td>
                        <Link
                          to={`/almacen/inspecciones/${insp.id}`}
                          className="table-action"
                          aria-label="Ver inspección"
                        >
                          <ArrowRight size={14} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {inspecciones.length === 0 && (
                    <tr>
                      <td colSpan={5} className="empty-row">Sin inspecciones.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Panel lateral */}
        <div className="help-panel">
          <h2>Resumen</h2>
          <dl style={{ display: "grid", gap: 12, margin: 0 }}>
            <div>
              <dt style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase" }}>Estado</dt>
              <dd style={{ margin: "4px 0 0" }}>
                <StatusBadge value={material.activo ? "Disponible" : "Baja"} label={material.activo ? "Activo" : "Inactivo"} />
              </dd>
            </div>
            <div>
              <dt style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase" }}>Última inspección</dt>
              <dd style={{ margin: "4px 0 0", fontSize: 13 }}>
                {ultimaInspeccion ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {new Date(ultimaInspeccion).toLocaleDateString("es-PE")}
                    <TrimestreBadge fecha={ultimaInspeccion} showLabel />
                  </span>
                ) : "Sin inspecciones"}
              </dd>
            </div>
            <div>
              <dt style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase" }}>Movimientos totales</dt>
              <dd style={{ margin: "4px 0 0", fontSize: 13 }}>{movimientos.length}</dd>
            </div>
          </dl>

          <div className="help-note" style={{ marginTop: 20 }}>
            <Package size={16} />
            {material.control_individual
              ? " Este material tiene piezas individuales rastreadas. Cada pieza tiene su propio código y estado."
              : ` Este material es consumible. Solo se registra la cantidad total. Stock mínimo: ${STOCK_MINIMO} unidades.`}
          </div>
        </div>
      </div>
    </section>
  );
}

function PiezaTreeRow({
  pieza,
  mostrarTrimestre,
  materialId,
}: {
  pieza: PiezaAnidada;
  mostrarTrimestre: string | null;
  materialId: number;
}) {
  const qc = useQueryClient();
  const esContenedor = pieza.total_hijas > 0;
  // "idle" | "confirming" | "confirmed"
  const [delStep, setDelStep] = useState<"idle" | "confirming" | "confirmed">("idle");
  // F1: formulario inline para agregar pieza hija
  const [mostrarFormHija, setMostrarFormHija] = useState(false);
  const [hijaNombre, setHijaNombre] = useState("");
  const [hijaMedida, setHijaMedida] = useState("");
  const [hijaCantidad, setHijaCantidad] = useState(1);
  const [hijaError, setHijaError] = useState("");

  const delMut = useMutation({
    mutationFn: () => deletePieza(pieza.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material", materialId] });
      setDelStep("idle");
    },
    onError: () => {
      setDelStep("idle");
      alert("No se pudo eliminar. Intenta de nuevo.");
    },
  });

  const agregarMut = useMutation({
    mutationFn: () => agregarHijaInline(pieza.id, {
      nombre: hijaNombre.trim(),
      medida: hijaMedida.trim() || undefined,
      cantidad: hijaCantidad,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material", materialId] });
      setMostrarFormHija(false);
      setHijaNombre("");
      setHijaMedida("");
      setHijaCantidad(1);
      setHijaError("");
    },
    onError: (e: { response?: { data?: Record<string, string[]> } }) => {
      const data = e?.response?.data;
      setHijaError(data ? Object.values(data).flat().join(" ") : "Error al agregar pieza.");
    },
  });

  return (
    <div>
      <div className={`pieza-tree-row ${esContenedor ? "is-container" : ""}`}>
        <Package size={15} style={{ color: "var(--muted)", flexShrink: 0 }} />
        <span className="pieza-code">{pieza.codigo}</span>
        {pieza.material_nombre && (
          <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 2 }}>
            {pieza.material_nombre}{pieza.material_medida ? ` · ${pieza.material_medida}` : ""}
          </span>
        )}
        <StatusBadge value={pieza.estado} />
        {mostrarTrimestre && pieza.estado !== "Baja" && (
          <TrimestreBadge fecha={mostrarTrimestre} />
        )}

        {/* Contador estuche + botón agregar hija + botón eliminar */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {esContenedor && delStep === "idle" && (
            <small style={{ color: "var(--muted)", fontSize: 11 }}>
              Estuche · {pieza.hijas_disponibles}/{pieza.total_hijas} disponibles
            </small>
          )}

          {/* Botón + Pieza (solo en estuches) */}
          {delStep === "idle" && (
            <button
              type="button"
              title="Agregar item a este estuche"
              style={{
                background: "transparent", border: 0,
                color: "var(--accent, #6366f1)", cursor: "pointer",
                padding: 2, display: "flex", alignItems: "center", gap: 3,
                fontSize: 11, opacity: 0.8,
              }}
              onClick={() => { setMostrarFormHija((v) => !v); setHijaError(""); }}
            >
              <Plus size={13} /> Item
            </button>
          )}

          {delStep === "idle" && (
            <button
              title={esContenedor ? "Eliminar estuche y todas sus piezas" : "Eliminar pieza"}
              style={{
                background: "transparent", border: 0,
                color: "var(--muted)", cursor: "pointer",
                padding: 2, display: "flex", alignItems: "center",
                opacity: 0.55,
              }}
              onClick={() => setDelStep("confirming")}
            >
              <Trash size={14} />
            </button>
          )}

          {delStep === "confirming" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                {esContenedor
                  ? `¿Eliminar estuche + ${pieza.total_hijas} items?`
                  : "¿Eliminar pieza?"}
              </span>
              {esContenedor && (
                <button
                  style={{
                    fontSize: 11, padding: "2px 8px", borderRadius: 4,
                    background: "var(--error, #dc2626)", color: "#fff",
                    border: "none", cursor: "pointer",
                  }}
                  onClick={() => setDelStep("confirmed")}
                >
                  Ver aviso
                </button>
              )}
              {!esContenedor && (
                <button
                  style={{
                    fontSize: 11, padding: "2px 8px", borderRadius: 4,
                    background: "var(--error, #dc2626)", color: "#fff",
                    border: "none", cursor: "pointer",
                  }}
                  onClick={() => delMut.mutate()}
                  disabled={delMut.isPending}
                >
                  {delMut.isPending ? "…" : "Sí"}
                </button>
              )}
              <button
                style={{
                  fontSize: 11, padding: "2px 8px", borderRadius: 4,
                  background: "transparent", border: "1px solid var(--border, #d1d5db)",
                  cursor: "pointer",
                }}
                onClick={() => setDelStep("idle")}
                disabled={delMut.isPending}
              >
                No
              </button>
            </div>
          )}

          {delStep === "confirmed" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "#dc2626", fontWeight: 600 }}>
                ⚠️ Se borrarán {pieza.total_hijas} items también.
              </span>
              <button
                style={{
                  fontSize: 11, padding: "2px 8px", borderRadius: 4,
                  background: "#7f1d1d", color: "#fff",
                  border: "none", cursor: "pointer",
                }}
                onClick={() => delMut.mutate()}
                disabled={delMut.isPending}
              >
                {delMut.isPending ? "Eliminando…" : "Confirmar"}
              </button>
              <button
                style={{
                  fontSize: 11, padding: "2px 8px", borderRadius: 4,
                  background: "transparent", border: "1px solid var(--border, #d1d5db)",
                  cursor: "pointer",
                }}
                onClick={() => setDelStep("idle")}
                disabled={delMut.isPending}
              >
                No
              </button>
            </div>
          )}
        </div>
      </div>

      {/* F1: formulario inline para agregar pieza hija */}
      {mostrarFormHija && (
        <div style={{
          marginLeft: 24, marginTop: 6, padding: "10px 14px",
          background: "var(--surface-2, rgba(99,102,241,.06))",
          borderRadius: 8, border: "1px dashed var(--accent, #6366f1)",
        }}>
          <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: "var(--accent, #6366f1)" }}>
            + Agregar item al estuche
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "end" }}>
            <label style={{ fontSize: 12 }}>
              Nombre *
              <input
                type="text"
                value={hijaNombre}
                onChange={(e) => setHijaNombre(e.target.value)}
                placeholder="Ej. Llave allen 5mm"
                style={{ display: "block", width: "100%", marginTop: 3, padding: "4px 8px", fontSize: 13, borderRadius: 6, border: "1px solid var(--border, #d1d5db)" }}
              />
            </label>
            <label style={{ fontSize: 12 }}>
              Medida (opcional)
              <input
                type="text"
                value={hijaMedida}
                onChange={(e) => setHijaMedida(e.target.value)}
                placeholder="Ej. 5mm"
                style={{ display: "block", width: "100%", marginTop: 3, padding: "4px 8px", fontSize: 13, borderRadius: 6, border: "1px solid var(--border, #d1d5db)" }}
              />
            </label>
            <label style={{ fontSize: 12 }}>
              Cant.
              <input
                type="number"
                min={1}
                value={hijaCantidad}
                onChange={(e) => setHijaCantidad(Number(e.target.value))}
                style={{ display: "block", width: 56, marginTop: 3, padding: "4px 8px", fontSize: 13, borderRadius: 6, border: "1px solid var(--border, #d1d5db)" }}
              />
            </label>
          </div>
          {hijaError && (
            <p style={{ fontSize: 12, color: "#dc2626", marginTop: 6 }}>{hijaError}</p>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className="button button-primary"
              style={{ fontSize: 12, padding: "4px 14px" }}
              onClick={() => { setHijaError(""); agregarMut.mutate(); }}
              disabled={agregarMut.isPending || !hijaNombre.trim()}
            >
              {agregarMut.isPending ? "Agregando…" : "Agregar"}
            </button>
            <button
              type="button"
              className="button button-secondary"
              style={{ fontSize: 12, padding: "4px 14px" }}
              onClick={() => { setMostrarFormHija(false); setHijaError(""); }}
              disabled={agregarMut.isPending}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {pieza.piezas_hijas.length > 0 && (
        <div className="pieza-tree-children">
          {pieza.piezas_hijas.map((hija) => (
            <PiezaHijaRow key={hija.id} pieza={hija} materialId={materialId} />
          ))}
        </div>
      )}
    </div>
  );
}

function PiezaHijaRow({
  pieza,
  materialId,
}: {
  pieza: PiezaBase & { material_nombre?: string; material_medida?: string };
  materialId: number;
}) {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);

  const desvinMut = useMutation({
    mutationFn: () => desvinculaPieza(pieza.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material", materialId] });
      setConfirm(false);
    },
  });

  return (
    <div className="pieza-tree-hija" style={{ alignItems: "center" }}>
      <Package size={12} style={{ color: "var(--muted)", flexShrink: 0 }} />
      <span className="pieza-code">{labelPieza(pieza)}</span>
      {(pieza.material_nombre || pieza.material_medida) && (
        <span style={{ fontSize: 11, color: "var(--muted)" }}>
          {[pieza.material_nombre, pieza.material_medida].filter(Boolean).join(" · ")}
        </span>
      )}
      <StatusBadge value={pieza.estado} />
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
        {confirm ? (
          <>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>¿Quitar del estuche?</span>
            <button
              style={{
                fontSize: 11, padding: "2px 8px", borderRadius: 4,
                background: "var(--error, #dc2626)", color: "#fff",
                border: "none", cursor: "pointer",
              }}
              onClick={() => desvinMut.mutate()}
              disabled={desvinMut.isPending}
            >
              {desvinMut.isPending ? "…" : "Sí"}
            </button>
            <button
              style={{
                fontSize: 11, padding: "2px 8px", borderRadius: 4,
                background: "transparent", border: "1px solid var(--border, #d1d5db)",
                cursor: "pointer",
              }}
              onClick={() => setConfirm(false)}
              disabled={desvinMut.isPending}
            >
              No
            </button>
          </>
        ) : (
          <button
            title="Quitar del estuche"
            style={{
              background: "transparent", border: 0,
              color: "var(--muted)", cursor: "pointer",
              padding: 2, display: "flex", alignItems: "center",
              opacity: 0.6,
            }}
            onClick={() => setConfirm(true)}
          >
            <Trash size={13} />
          </button>
        )}
      </div>
    </div>
  );
}
