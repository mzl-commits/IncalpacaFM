import {
  ArrowLeft, ArrowRight, CaretDown, ClipboardText, Package, PencilSimple, Plus, Trash, WarningCircle,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { StatusBadge } from "@/components/shared/StatusBadge";
import { TrimestreBadge } from "@/components/shared/TrimestreBadge";
import { deleteMaterial, deleteMaterialForzado, getMaterialDetalle } from "@/modules/almacen/catalogoRepository";
import { listMovimientos } from "@/modules/almacen/inventarioRepository";
import { listInspecciones } from "@/modules/almacen/inspeccionRepository";
import { STOCK_MINIMO, tipoControlLabels, unidadMedidaAbrev } from "@/modules/almacen/types";
import { AjustarStockPanel } from "@/modules/almacen/components/AjustarStockPanel";
import { PiezaTreeRow } from "@/modules/almacen/components/PiezaTreeRow";


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

  // "idle" | "confirming" | "force_required" | "force_confirming"
  const [deleteStep, setDeleteStep] = useState<"idle" | "confirming" | "force_required" | "force_confirming">("idle");
  const [menuOpen, setMenuOpen] = useState(false);

  const deleteMut = useMutation({
    mutationFn: () => deleteMaterial(materialId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["materiales"] });
      navigate("/almacen/catalogo");
    },
    onError: (err: any) => {
      // 409 = tiene datos asociados, ofrecer eliminación forzada
      if (err?.response?.status === 409) {
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
      `}</style>

      {/* Cabecera */}
      <div className="mat-detail-header">
        <Link to="/almacen/catalogo" className="back-link">
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
              <div><dt className="dt-label">Marca / Modelo</dt><dd className="dd-value">{[material.marca, material.modelo].filter(Boolean).join(" / ") || "—"}</dd></div>
              <div><dt className="dt-label">Medida</dt><dd className="dd-value">{material.medida || "—"}</dd></div>
              <div><dt className="dt-label">Tipo de control</dt><dd className="dd-value">{tipoControlLabels[material.tipo_control]}</dd></div>
              <div><dt className="dt-label">Control individual</dt><dd className="dd-value">{material.control_individual ? "Sí" : "No"}</dd></div>
              <div><dt className="dt-label">Ubicación física</dt><dd className="dd-value">{material.ubicacion_fisica || "—"}</dd></div>
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
                    ? `S/ ${Number(material.precio).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="dt-label">Cantidad / Piezas</dt>
                <dd className="dd-value">
                  {material.cantidad_total}{" "}
                  {!material.control_individual && material.unidad_manejo === "caja" && material.unidades_por_caja && (
                    <span style={{ color: "var(--muted)" }}>
                      ({Math.floor(material.cantidad_total / material.unidades_por_caja)} cajas de {material.unidades_por_caja} u.
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
              {material.grosor && (
                <div>
                  <dt className="dt-label">Grosor / Diámetro</dt>
                  <dd className="dd-value">{material.grosor} {unidadMedidaAbrev[material.unidad_medida]}</dd>
                </div>
              )}
              {material.largo && (
                <div>
                  <dt className="dt-label">Largo</dt>
                  <dd className="dd-value">{material.largo} {unidadMedidaAbrev[material.unidad_medida]}</dd>
                </div>
              )}
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
                    periodicidadDias={material.periodicidad_inspeccion_dias}
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
                to={`/almacen/movimientos?material=${encodeURIComponent(material.codigo)}`}
                className="table-action"
                style={{ fontSize: 13 }}
              >
                Ver todos
              </Link>
            </div>
            <div className="table-scroll">
              <table className="tabla-detalle-mobile">
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
                  {movimientos.slice(0, 5).map((mov) => (
                    <tr key={mov.id}>
                      <td className="col-fecha" style={{ fontSize: 12 }}>
                        {new Date(mov.fecha).toLocaleDateString("es-PE")}
                      </td>
                      <td className="col-tipo">
                        <StatusBadge value={mov.tipo} label={mov.tipo_display} />
                      </td>
                      <td className="col-detalle" data-label="Pieza/Cant." style={{ fontSize: 12 }}>
                        {mov.pieza_codigo ?? `${mov.cantidad} u.`}
                      </td>
                      <td className="col-detalle" data-label="Responsable" style={{ fontSize: 12 }}>
                        {mov.responsable_nombre}
                      </td>
                      <td className="col-detalle" data-label="Referencia" style={{ fontSize: 12, color: "var(--muted)" }}>
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
              <table className="tabla-detalle-mobile">
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
                      <td className="col-fecha" style={{ fontSize: 12 }}>
                        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {new Date(insp.fecha).toLocaleDateString("es-PE")}
                          <TrimestreBadge
                            fecha={insp.fecha}
                            periodicidadDias={material.periodicidad_inspeccion_dias}
                          />
                        </span>
                      </td>
                      <td className="col-detalle" data-label="Tipo" style={{ fontSize: 12 }}>
                        {insp.tipo === "individual" ? "Individual" : "Grupal"}
                      </td>
                      <td className="col-tipo"><StatusBadge value={insp.resultado_general} /></td>
                      <td className="col-detalle" data-label="Inspector" style={{ fontSize: 12 }}>
                        {insp.inspector_nombre}
                      </td>
                      <td className="col-action">
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