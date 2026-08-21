import {
  ArrowLeft, ArrowRight, CaretDown, ClipboardText, DownloadSimple, FileXls, Package, PencilSimple, Plus, Trash, WarningCircle,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams } from "react-router-dom";

import { StatusBadge } from "@/components/shared/StatusBadge";
import { TrimestreBadge } from "@/components/shared/TrimestreBadge";
import { useAuth } from "@/modules/accounts/AuthContext";
import {
  deleteMaterial, deleteMaterialForzado, getMaterialDetalle,
  exportarHistorialInspeccionesExcel, exportarHistorialInspeccionesPdf,
} from "@/modules/almacen/catalogoRepository";
import { descargarExcelMovimientos, listMovimientos } from "@/modules/almacen/inventarioRepository";
import { listInspecciones } from "@/modules/almacen/inspeccionRepository";
import { STOCK_MINIMO, tipoControlLabels } from "@/modules/almacen/types";
import { AjustarStockPanel } from "@/modules/almacen/components/AjustarStockPanel";
import { PiezaTreeRow } from "@/modules/almacen/components/PiezaTreeRow";

import { useAlmacenActivo } from "@/modules/almacen/AlmacenContext";

/** Tarjeta desplegable reutilizada por los historiales de Movimientos e Inspecciones. */
function AccordionCard({
  headerLeft,
  headerRight,
  children,
  defaultOpen = false,
}: {
  headerLeft: ReactNode;
  headerRight?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="accordion-card">
      <button
        type="button"
        className="accordion-card-header"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span className="accordion-card-header-left">{headerLeft}</span>
        <span className="accordion-card-header-right">
          {headerRight}
          <CaretDown
            size={16}
            style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .15s ease", flexShrink: 0, color: "var(--muted, #94a3b8)" }}
          />
        </span>
      </button>
      {open && <div className="accordion-card-body">{children}</div>}
    </div>
  );
}

function AccordionField({ label, value, full = false }: { label: string; value: ReactNode; full?: boolean }) {
  return (
    <div style={full ? { gridColumn: "1 / -1" } : undefined}>
      <p className="accordion-field-label">{label}</p>
      <p className="accordion-field-value">{value}</p>
    </div>
  );
}

export function MaterialDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { almacenId } = useAlmacenActivo();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const materialId = Number(id);
  const { user } = useAuth();
  const isInspector = user?.role === "INSPECTOR";

  const { data: material, isLoading, error } = useQuery({
    queryKey: ["material", materialId],
    queryFn: () => getMaterialDetalle(materialId),
    enabled: !!materialId,
  });

  const { data: movimientos = [] } = useQuery({
    queryKey: ["movimientos", almacenId, { material: materialId }],
    queryFn: () => listMovimientos(almacenId, { material: materialId }),
    enabled: !!materialId,
  });

  const { data: inspecciones = [] } = useQuery({
    queryKey: ["inspecciones", almacenId, { material: materialId }],
    queryFn: () => listInspecciones(almacenId, { material: materialId }),
    enabled: !!materialId,
  });

  // "idle" | "confirming" | "force_required" | "force_confirming"
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirming" | "force_required" | "force_confirming">("idle");

  const deleteMut = useMutation({
    mutationFn: () => deleteMaterial(materialId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["materiales"] });
      navigate(`/almacen/${almacenId}/catalogo`);
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
      navigate(`/almacen/${almacenId}/catalogo`);
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

  function formatearFrecuencia(valor: number, unidad: "dias" | "meses"): string {
    if (unidad === "meses") return `${valor} ${valor === 1 ? "mes" : "meses"}`;
    return `${valor} ${valor === 1 ? "día" : "días"}`;
  }

  return (
    <section>
      <style>{`
        .mat-detail-header {
          display: flex !important;
          flex-direction: column !important;
          gap: 18px !important;
          margin-bottom: 28px !important;
        }
        .mat-detail-header .back-link {
          display: inline-flex !important;
          align-items: center !important;
          gap: 6px !important;
          align-self: flex-start !important;
        }
        .mat-detail-title-row {
          display: flex !important;
          flex-direction: row !important;
          flex-wrap: wrap !important;
          align-items: flex-start !important;
          justify-content: space-between !important;
          gap: 16px !important;
        }
        .mat-detail-title-block {
          display: flex !important;
          flex-direction: column !important;
          gap: 6px !important;
          min-width: 0 !important;
        }
        .mat-detail-title-block h1 {
          margin: 0 !important;
        }
        .mat-detail-title-block .breadcrumb {
          margin: 0 !important;
        }
        .mat-detail-meta {
          margin: 0 !important;
          padding: 4px 10px !important;
          border-radius: 999px !important;
          background: var(--surface-muted, #f3f4f6) !important;
          color: var(--muted, #6b7280) !important;
          font-size: 13px !important;
          white-space: nowrap !important;
          flex-shrink: 0 !important;
        }
        .mat-detail-actions {
          display: flex !important;
          flex-direction: row !important;
          flex-wrap: wrap !important;
          align-items: center !important;
          gap: 10px !important;
          width: 100% !important;
        }
        .accordion-list {
          display: flex !important;
          flex-direction: column !important;
          gap: 8px !important;
        }
        .accordion-card {
          border: 1px solid var(--border, #e5e7eb) !important;
          border-radius: 10px !important;
          overflow: hidden !important;
          background: var(--surface, #fff) !important;
        }
        .accordion-card-header {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          gap: 10px !important;
          width: 100% !important;
          padding: 12px 14px !important;
          border: none !important;
          background: none !important;
          cursor: pointer !important;
          text-align: left !important;
        }
        .accordion-card-header-left {
          display: flex !important;
          align-items: center !important;
          gap: 10px !important;
          flex-wrap: wrap !important;
          min-width: 0 !important;
        }
        .accordion-card-header-right {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
          flex-shrink: 0 !important;
        }
        .accordion-date {
          font-size: 12px !important;
          color: var(--muted, #64748b) !important;
          white-space: nowrap !important;
        }
        .accordion-card-body {
          display: grid !important;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)) !important;
          gap: 12px !important;
          padding: 4px 14px 14px !important;
          border-top: 1px solid var(--border, #f1f5f9) !important;
          padding-top: 12px !important;
        }
        .accordion-field-label {
          margin: 0 !important;
          font-size: 11px !important;
          text-transform: uppercase !important;
          letter-spacing: .03em !important;
          color: var(--muted, #94a3b8) !important;
        }
        .accordion-field-value {
          margin: 2px 0 0 !important;
          font-size: 13px !important;
          color: var(--text, #0f172a) !important;
        }
      `}</style>

      {/* Cabecera */}
      <div className="mat-detail-header">
        <Link to={`/almacen/${almacenId}/catalogo`} className="back-link">
          <ArrowLeft size={16} /> Catálogo
        </Link>

        <div className="mat-detail-title-row">
          <div className="mat-detail-title-block">
            <p className="breadcrumb">Almacén / Catálogo / {material.codigo}</p>
            <h1>{material.nombre}</h1>
          </div>
          <span className="mat-detail-meta">
            {material.subcategoria_nombre} · {material.categoria_nombre}
          </span>
        </div>

        <div className="mat-detail-actions">
          {!isInspector && (
            <Link className="button button-secondary button-sm" to={`/almacen/${almacenId}/movimientos/nuevo?material=${material.id}`}>
              <ArrowRight size={14} /> Registrar movimiento
            </Link>
          )}
          {material.control_individual && (
            <Link className="button button-secondary button-sm" to={`/almacen/${almacenId}/inspecciones/nueva?material=${material.id}`}>
              <ClipboardText size={14} /> Nueva inspección
            </Link>
          )}
          {!isInspector && (
           <Link className="button button-secondary button-sm" to={`/almacen/${almacenId}/catalogo/${material.id}/editar`}>
            <PencilSimple size={14} /> Editar
          </Link>
          )}
          {!isInspector && (
            <button
              type="button"
              className="button button-danger-subtle button-sm"
              onClick={() => setDeleteStep("confirming")}
            >
              <Trash size={14} /> Eliminar
            </button>
          )}
        </div>
      </div>

      {/* ── Modal de eliminación (2 pasos) ── */}
      {deleteStep !== "idle" && createPortal(
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999,
          padding: 16,
        }}>
          <div style={{
            background: "var(--surface, #fff)", borderRadius: 12, padding: 28,
            maxWidth: 440, width: "100%", boxShadow: "0 10px 40px rgba(0,0,0,.25)",
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
        </div>,
        document.body
      )}

      <div className="wizard-layout">
        {/* Panel principal */}
        <div style={{ display: "grid", gap: 20 }}>
          {/* Ficha del material */}
          <div className="form-panel">
            <div className="form-section-heading" style={{ marginBottom: 16 }}>
              <span>Datos del material</span>
              <h2>{material.codigo}</h2>
              <p style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 600, color: "var(--text)" }}>
                {material.nombre}
              </p>
            </div>

            {material.foto && (
              <img
                src={material.foto}
                alt={`Foto de ${material.nombre}`}
                className="foto-preview"
              />
            )}

            <dl className="review-card dl" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "14px 20px", margin: 0, padding: "16px" }}>
              <div><dt className="dt-label">Marca / Modelo</dt><dd className="dd-value">{[material.marca, material.modelo].filter(Boolean).join(" / ") || "—"}</dd></div>
              {material.medida && (
                <div><dt className="dt-label">Medida</dt><dd className="dd-value">{material.medida}</dd></div>
              )}
              <div><dt className="dt-label">Tipo de control</dt><dd className="dd-value">{tipoControlLabels[material.tipo_control]}</dd></div>
              <div><dt className="dt-label">Control individual</dt><dd className="dd-value">{material.control_individual ? "Sí" : "No"}</dd></div>
              <div><dt className="dt-label">Ubicación física</dt><dd className="dd-value">{material.ubicacion_fisica || "—"}</dd></div>

              <div><dt className="dt-label">Código EKIPU</dt><dd className="dd-value">{material.codigo_quipu || "—"}</dd></div>

              {material.es_inspeccionable && (
                <div>
                  <dt className="dt-label">Frecuencia de inspección</dt>
                  <dd className="dd-value">
                    {formatearFrecuencia(material.periodicidad_valor, material.periodicidad_unidad)}
                  </dd>
                </div>
              )}
              <div>
                <dt className="dt-label">Precio de referencia</dt>
                <dd className="dd-value">
                  {material.precio !== null && material.precio !== undefined && material.precio !== ""
                    ? `${material.moneda === "USD" ? "$" : "S/"} ${Number(material.precio).toLocaleString(
                        material.moneda === "USD" ? "en-US" : "es-PE",
                        { minimumFractionDigits: 2, maximumFractionDigits: 2 }
                      )}`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="dt-label">Cantidad / Piezas</dt>
                <dd className="dd-value">
                  {material.cantidad_total}{" "}
                  {material.control_individual
                    ? material.cantidad_total === 1 ? "pieza" : "piezas"
                    : material.unidad_manejo_permite_conversion_unidad
                      ? (material.unidad_movimiento_base_abreviatura ?? "u.")
                      : "u."}
                  {" "}

                  {!material.control_individual && material.unidad_manejo_requiere_multiplicador && material.unidades_por_caja && (
                    <span style={{ color: "var(--muted)" }}>
                      ({Math.floor(material.cantidad_total / material.unidades_por_caja)} {material.unidad_manejo_nombre?.replace(/^Por /, "").toLowerCase() ?? "empaques"} de {material.unidades_por_caja} u.
                      {material.cantidad_total % material.unidades_por_caja !== 0
                        ? ` + ${material.cantidad_total % material.unidades_por_caja} sueltas`
                        : ""}
                      )
                    </span>
                  )}{" "}
                  {stockAlerta && (
                    <span className="stock-alert-badge">
                      <WarningCircle size={13} /> Stock bajo
                    </span>
                  )}
                </dd>
              </div>
              {!material.control_individual && (
                <div>
                  <dt className="dt-label">Manejo de stock</dt>
                  <dd className="dd-value">
                    {material.unidad_manejo_nombre ?? "—"}
                    {material.unidad_manejo_permite_conversion_unidad && material.unidad_movimiento_base_nombre && (
                      <span style={{ color: "var(--muted)", fontWeight: 400 }}>
                        {" "}· se registra en {material.unidad_movimiento_base_nombre.toLowerCase()}
                      </span>
                    )}
                  </dd>
                </div>
              )}
            </dl>

            {material.medidas && material.medidas.length > 0 && (
              <div style={{ padding: "0 16px 16px", borderTop: "1px solid var(--border, #e5e7eb)" }}>
                <dt className="dt-label" style={{ display: "block", margin: "14px 0 8px" }}>
                  Dimensiones
                </dt>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {material.medidas.map((m) => (
                    <span
                      key={m.id ?? `${m.tipo}-${m.valor}`}
                      style={{
                        fontSize: 13,
                        padding: "4px 10px",
                        borderRadius: 999,
                        background: "var(--surface-muted, #f3f4f6)",
                        border: "1px solid var(--border, #e5e7eb)",
                      }}
                    >
                      <strong>{m.tipo_nombre}:</strong> {m.valor} {m.unidad_medida_abreviatura}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Ajuste de stock (solo materiales sin control individual, no disponible para Inspector) */}
          {!material.control_individual && !isInspector && (
            <AjustarStockPanel material={material} />
          )}

          {/* Árbol de piezas (solo si control_individual=true) */}
          {material.control_individual && (
            <div className="data-panel">
              <div className="table-toolbar">
                <strong style={{ fontSize: 15 }}>Piezas ({material.cantidad_total})</strong>
                {!isInspector && (
                  <Link className="button button-secondary" to={`/almacen/${almacenId}/catalogo/${material.id}/alta-piezas`} style={{ fontSize: 13 }}>
                    <Plus size={14} /> Alta de piezas
                  </Link>
                )}
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
                    periodicidadDias={material.periodicidad_inspeccion_dias}
                    materialId={materialId}
                    isInspector={isInspector}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Historial de movimientos */}
          <div className="data-panel">
            <div className="table-toolbar">
              <strong style={{ fontSize: 15 }}>Movimientos</strong>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  className="button button-sm button-secondary"
                  onClick={() => void descargarExcelMovimientos(material.id)}
                  title="Descargar reporte Excel con el historial y resúmenes de este material"
                >
                  <FileXls size={15} /> Exportar Excel
                </button>
                <Link to={`/almacen/${almacenId}/movimientos?material=${encodeURIComponent(material.codigo)}`} className="table-action" style={{ fontSize: 13 }}>
                  Ver todos
                </Link>
              </div>
            </div>
            <div className="accordion-list">
              {movimientos.slice(0, 5).map((mov) => (
                <AccordionCard
                  key={mov.id}
                  headerLeft={
                    <>
                      <span className="accordion-date">{new Date(mov.fecha).toLocaleDateString("es-PE")}</span>
                      <StatusBadge value={mov.tipo} label={mov.tipo_display} />
                    </>
                  }
                >
                  <AccordionField label="Pieza / Cant." value={mov.pieza_codigo ?? `${mov.cantidad} u.`} />
                  <AccordionField label="Responsable" value={mov.responsable_nombre} />
                  <AccordionField label="Referencia" value={mov.referencia_externa || "—"} />
                </AccordionCard>
              ))}
              {movimientos.length === 0 && <p className="empty-row">Sin movimientos.</p>}
            </div>
          </div>

          {/* Historial de inspecciones */}
          <div className="data-panel">
            <div className="table-toolbar">
              <strong style={{ fontSize: 15 }}>Inspecciones</strong>
              <div style={{ display: "flex", gap: 8 }}>
                {inspecciones.length > 0 && (
                  <>
                    <button
                      type="button"
                      className="button button-sm button-secondary"
                      onClick={() => exportarHistorialInspeccionesExcel(material.id, material.codigo)}
                    >
                      <DownloadSimple size={14} /> Excel
                    </button>
                    <button
                      type="button"
                      className="button button-sm button-secondary"
                      onClick={() => exportarHistorialInspeccionesPdf(material.id, material.codigo)}
                    >
                      <DownloadSimple size={14} /> PDF
                    </button>
                  </>
                )}
                <Link to={`/almacen/${almacenId}/inspecciones/nueva?material=${material.id}`} className="button button-secondary" style={{ fontSize: 13 }}>
                  <Plus size={14} /> Nueva
                </Link>
              </div>
            </div>
            <div className="accordion-list">
              {inspecciones.slice(0, 5).map((insp) => (
                <AccordionCard
                  key={insp.id}
                  headerLeft={
                    <>
                      <span className="accordion-date">{new Date(insp.fecha).toLocaleDateString("es-PE")}</span>
                      <TrimestreBadge
                        fecha={insp.fecha}
                        periodicidadDias={material.periodicidad_inspeccion_dias}
                      />
                      <StatusBadge value={insp.resultado_general} />
                    </>
                  }
                >
                  <AccordionField label="Tipo" value={insp.tipo === "individual" ? "Individual" : "Grupal"} />
                  <AccordionField label="Inspector" value={insp.inspector_nombre} />
                  <AccordionField
                    label="Detalle"
                    full
                    value={
                      <Link
                        to={`/almacen/${almacenId}/inspecciones/${insp.id}`}
                        className="button button-secondary button-sm"
                        style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 4 }}
                      >
                        Ver inspección completa <ArrowRight size={14} />
                      </Link>
                    }
                  />
                </AccordionCard>
              ))}
              {inspecciones.length === 0 && <p className="empty-row">Sin inspecciones.</p>}
            </div>
          </div>
        </div>

        {/* Panel lateral */}
        <div className="help-panel">
          <h2>Resumen</h2>
          <dl style={{ display: "grid", gap: 12, margin: 0 }}>
            <div>
              <dt className="dt-label">Estado</dt>
              <dd style={{ margin: "4px 0 0" }}>
                <StatusBadge value={material.activo ? "Disponible" : "Baja"} label={material.activo ? "Activo" : "Inactivo"} />
              </dd>
            </div>
            <div>
              <dt className="dt-label">Última inspección</dt>
              <dd className="dd-value">
                {ultimaInspeccion ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {new Date(ultimaInspeccion).toLocaleDateString("es-PE")}
                    <TrimestreBadge
                      fecha={ultimaInspeccion}
                      periodicidadDias={material.periodicidad_inspeccion_dias}
                      showLabel
                    />
                  </span>
                ) : "Sin inspecciones"}
              </dd>
            </div>
            <div>
              <dt className="dt-label">Movimientos totales</dt>
              <dd className="dd-value">{movimientos.length}</dd>
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