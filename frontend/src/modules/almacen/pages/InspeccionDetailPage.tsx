import {
  ArrowLeft, DownloadSimple, FileArrowDown,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { StatusBadge } from "@/components/shared/StatusBadge";
import { TrimestreBadge } from "@/components/shared/TrimestreBadge";
import { exportarExcel, exportarPdf, getInspeccion } from "@/modules/almacen/inspeccionRepository";
import { useAlmacenActivo } from "@/modules/almacen/AlmacenContext";
import {
  accionInspeccionLabels,
  resultadoInspeccionLabels,
  valorRespuestaLabels,
} from "@/modules/almacen/types";

export function InspeccionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const inspeccionId = Number(id);
  const { almacenId } = useAlmacenActivo();

  const { data: inspeccion, isLoading, error } = useQuery({
    queryKey: ["inspeccion", inspeccionId],
    queryFn: () => getInspeccion(inspeccionId),
    enabled: !!inspeccionId,
  });

  if (isLoading) return <div className="loading-panel">Cargando inspección…</div>;
  if (error || !inspeccion)
    return (
      <div className="loading-panel">
        No se pudo cargar la inspección.{" "}
        <Link to={`/almacen/${almacenId}/inspecciones`} className="button button-secondary">Volver</Link>
      </div>
    );

  return (
    <section>
      {/* Cabecera */}
      <div className="wizard-heading">
        <Link to={`/almacen/${almacenId}/inspecciones`} className="back-link">
          <ArrowLeft size={16} /> Inspecciones
        </Link>
        <div>
          <p className="breadcrumb">Almacén / Inspecciones / #{inspeccion.id}</p>
          <h1>Inspección #{inspeccion.id}</h1>
          <p>{inspeccion.material_nombre} · {inspeccion.plantilla_nombre}</p>
        </div>
        <div className="export-actions">
        </div>
      </div>

      <div className="wizard-layout">
        {/* Contenido principal */}
        <div style={{ display: "grid", gap: 20 }}>
          {/* Datos generales */}
          <div className="form-panel">
            <div className="form-section-heading" style={{ marginBottom: 16 }}>
              <span>Resumen</span>
              <h2>Datos de la inspección</h2>
            </div>
            <dl style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "14px 20px", margin: 0 }}>
              <div>
                <dt className="dt-label">Fecha</dt>
                <dd className="dd-value" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {new Date(inspeccion.fecha).toLocaleDateString("es-PE", { dateStyle: "long" })}
                  <TrimestreBadge
                    fecha={inspeccion.fecha}
                    periodicidadDias={inspeccion.material_periodicidad_inspeccion_dias ?? 0}
                    showLabel
                  />
                </dd>
              </div>
              <div>
                <dt className="dt-label">Tipo</dt>
                <dd className="dd-value">
                  {inspeccion.tipo === "individual" ? "Individual" : "Grupal"}
                </dd>
              </div>
              <div>
                <dt className="dt-label">Material</dt>
                <dd className="dd-value">
                  <Link to={`/almacen/${almacenId}/catalogo/${inspeccion.material}`} style={{ color: "var(--accent)", fontWeight: 600 }}>
                    {inspeccion.material_codigo} — {inspeccion.material_nombre}
                  </Link>
                </dd>
              </div>
              {inspeccion.pieza_codigo && (
                <div>
                  <dt className="dt-label">Pieza</dt>
                  <dd className="dd-value" style={{ fontFamily: "ui-monospace, monospace" }}>
                    {inspeccion.pieza_codigo}
                  </dd>
                </div>
              )}
              {inspeccion.piezas_lote.length > 0 && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <dt className="dt-label">Piezas del lote</dt>
                  <dd style={{ margin: "4px 0 0", fontSize: 12 }}>
                    {inspeccion.piezas_lote.length} piezas inspeccionadas en lote
                  </dd>
                </div>
              )}
              <div>
                <dt className="dt-label">Inspector</dt>
                <dd className="dd-value">{inspeccion.inspector_nombre}</dd>
              </div>
              <div>
                <dt className="dt-label">Plantilla usada</dt>
                <dd className="dd-value">{inspeccion.plantilla_nombre}</dd>
              </div>
              {inspeccion.proxima_inspeccion && (
                <div>
                  <dt className="dt-label">Próxima inspección</dt>
                  <dd className="dd-value">
                    {new Date(inspeccion.proxima_inspeccion).toLocaleDateString("es-PE")}
                  </dd>
                </div>
              )}

              {/* Cantidades (solo grupal) */}
              {inspeccion.cantidad_inspeccionada !== null && (
                <>
                  <div>
                    <dt className="dt-label">Inspeccionadas</dt>
                    <dd className="dd-value">{inspeccion.cantidad_inspeccionada}</dd>
                  </div>
                  <div>
                    <dt className="dt-label">Aptas / No aptas</dt>
                    <dd className="dd-value">
                      <span style={{ color: "var(--success)" }}>{inspeccion.cantidad_apta} aptas</span>
                      {" / "}
                      <span style={{ color: "var(--error)" }}>{inspeccion.cantidad_no_apta} no aptas</span>
                    </dd>
                  </div>
                </>
              )}

              <div>
                <dt className="dt-label">Resultado general</dt>
                <dd style={{ margin: "4px 0 0" }}>
                  <StatusBadge value={inspeccion.resultado_general} />
                </dd>
              </div>
              <div>
                <dt className="dt-label">Acción tomada</dt>
                <dd className="dd-value">
                  {accionInspeccionLabels[inspeccion.accion_tomada] ?? inspeccion.accion_tomada}
                </dd>
              </div>

              {inspeccion.observaciones && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <dt className="dt-label">Observaciones</dt>
                  <dd className="dd-value" style={{ lineHeight: 1.5 }}>{inspeccion.observaciones}</dd>
                </div>
              )}
            </dl>
          </div>

          {/* Respuestas a criterios */}
          {inspeccion.respuestas.length > 0 && (
            <div className="data-panel">
              <div className="table-toolbar">
                <strong style={{ fontSize: 15 }}>
                  Criterios evaluados ({inspeccion.respuestas.length})
                </strong>
              </div>
              <div className="inspeccion-respuestas">
                {inspeccion.respuestas.map((r) => (
                  <div key={r.id} className="respuesta-row">
                    <span style={{ fontSize: 13 }}>{r.criterio_texto}</span>
                    <span>
                      <StatusBadge
                        value={r.valor}
                        label={valorRespuestaLabels[r.valor] ?? r.valor}
                      />
                    </span>
                    <span className="respuesta-observacion">
                      {r.observacion || "—"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Panel lateral */}
        <div className="help-panel">
          <h2>Exportar informe</h2>
          <p>Descarga el informe completo de esta inspección en el formato que necesites.</p>
          <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
            <button
              className="button button-secondary"
              onClick={() => exportarExcel(inspeccion.id)}
              style={{ width: "100%", justifyContent: "center" }}
            >
              <DownloadSimple size={16} /> Descargar Excel
            </button>
            <button
              className="button button-secondary"
              onClick={() => exportarPdf(inspeccion.id)}
              style={{ width: "100%", justifyContent: "center" }}
            >
              <FileArrowDown size={16} /> Descargar PDF
            </button>
          </div>

          <hr style={{ margin: "20px 0", borderColor: "#dfe6ef" }} />

          <h2>Resultado</h2>
          <div style={{ marginTop: 8 }}>
            <StatusBadge value={inspeccion.resultado_general} label={resultadoInspeccionLabels[inspeccion.resultado_general]} />
          </div>

          <div className="help-note" style={{ marginTop: 16 }}>
            {accionInspeccionLabels[inspeccion.accion_tomada] ?? inspeccion.accion_tomada}
          </div>

          <hr style={{ margin: "20px 0", borderColor: "#dfe6ef" }} />

          <h2>Acciones</h2>
          <Link
            to={`/almacen/${almacenId}/inspecciones/nueva?material=${inspeccion.material}`}
            className="button button-primary"
            style={{ display: "flex", width: "100%", justifyContent: "center", marginTop: 8 }}
          >
            Nueva inspección
          </Link>
          <Link
            to={`/almacen/${almacenId}/catalogo/${inspeccion.material}`}
            className="button button-secondary"
            style={{ display: "flex", width: "100%", justifyContent: "center", marginTop: 8 }}
          >
            Ver ficha del material
          </Link>
        </div>
      </div>
    </section>
  );
}