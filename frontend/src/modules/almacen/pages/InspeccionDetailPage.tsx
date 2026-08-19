import {
  ArrowLeft, CaretDown, CaretUp, DownloadSimple, FileArrowDown, FileDoc, FilePdf, FileXls, File as FileIcon,
  Plus, Trash, UploadSimple, X,
} from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { StatusBadge } from "@/components/shared/StatusBadge";
import { TrimestreBadge } from "@/components/shared/TrimestreBadge";
import {
  deleteDocumentoInspeccion,
  exportarExcel,
  exportarPdf,
  getInspeccion,
  listDocumentosInspeccion,
  listInspecciones,
  subirDocumentoInspeccion,
} from "@/modules/almacen/inspeccionRepository";
import { useAlmacenActivo } from "@/modules/almacen/AlmacenContext";
import {
  accionInspeccionLabels,
  resultadoInspeccionLabels,
  tipoDocumentoLabels,
  valorRespuestaLabels,
  type TipoDocumentoInspeccion,
} from "@/modules/almacen/types";

const ICONO_POR_TIPO: Record<TipoDocumentoInspeccion, typeof FileIcon> = {
  pdf: FilePdf,
  excel: FileXls,
  word: FileDoc,
  otro: FileIcon,
};

export function InspeccionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const inspeccionId = Number(id);
  const { almacenId } = useAlmacenActivo();
  const [descargandoExcel, setDescargandoExcel] = useState(false);
  const [descargandoPdf, setDescargandoPdf] = useState(false);
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errorDocumentos, setErrorDocumentos] = useState("");
  const [criteriosAbiertos, setCriteriosAbiertos] = useState(false);

  const { data: inspeccion, isLoading, error } = useQuery({
    queryKey: ["inspeccion", inspeccionId],
    queryFn: () => getInspeccion(inspeccionId),
    enabled: !!inspeccionId,
  });

  // Historial de inspecciones de ESTE material específico, para poder
  // mostrar "Inspección #N" relativo al material (no el ID global de la tabla).
  const { data: historialMaterial = [] } = useQuery({
    queryKey: ["inspecciones-material", almacenId, inspeccion?.material],
    queryFn: () => listInspecciones(almacenId, { material: inspeccion!.material }),
    enabled: !!inspeccion,
  });

  const numeroSecuencial = useMemo(() => {
    if (!inspeccion || historialMaterial.length === 0) return null;
    const ordenadas = [...historialMaterial].sort(
      (a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime() || a.id - b.id,
    );
    const idx = ordenadas.findIndex((i) => i.id === inspeccion.id);
    return idx >= 0 ? idx + 1 : null;
  }, [historialMaterial, inspeccion]);

  // ── Documentos adjuntos ──────────────────────────────────────────────────
  const { data: documentos = [] } = useQuery({
    queryKey: ["documentos-inspeccion", inspeccionId],
    queryFn: () => listDocumentosInspeccion(inspeccionId),
    enabled: !!inspeccionId,
  });

  // Archivos seleccionados que aún NO se han subido — el usuario puede
  // seguir agregando o quitando antes de confirmar con "Subir".
  const [pendientes, setPendientes] = useState<File[]>([]);

  const subirMut = useMutation({
    mutationFn: async (archivos: File[]) => {
      setErrorDocumentos("");
      // Se suben uno por uno porque el endpoint espera multipart de a un archivo.
      for (const archivo of archivos) {
        await subirDocumentoInspeccion(inspeccionId, archivo);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documentos-inspeccion", inspeccionId] });
      setPendientes([]);
    },
    onError: () => setErrorDocumentos("No se pudo subir uno o más documentos. Intenta de nuevo."),
  });

  const eliminarDocMut = useMutation({
    mutationFn: deleteDocumentoInspeccion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documentos-inspeccion", inspeccionId] });
    },
    onError: () => setErrorDocumentos("No se pudo eliminar el documento."),
  });

  function handleSeleccionArchivos(files: FileList | null) {
    if (!files || files.length === 0) return;
    setErrorDocumentos("");
    // Importante: convertir a array YA, antes de tocar el input. FileList es un
    // objeto "vivo" ligado al <input> — si reseteamos su value primero (o el
    // array se lee luego, dentro del updater de setState), la lista queda vacía
    // y no se agrega nada a la cola de pendientes.
    const seleccionados = Array.from(files);
    setPendientes((actual) => {
      const nuevos = seleccionados.filter(
        (f) => !actual.some((p) => p.name === f.name && p.size === f.size),
      );
      return [...actual, ...nuevos];
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function quitarPendiente(index: number) {
    setPendientes((actual) => actual.filter((_, i) => i !== index));
  }

  function formatearTamano(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

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
          <h1>
            Inspección {numeroSecuencial ? `#${numeroSecuencial}` : `#${inspeccion.id}`}
            {numeroSecuencial && (
              <span style={{ fontSize: 13, fontWeight: 400, color: "var(--muted)", marginLeft: 8 }}>
                (ID #{inspeccion.id})
              </span>
            )}
          </h1>
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
              <button
                type="button"
                onClick={() => setCriteriosAbiertos((v) => !v)}
                aria-expanded={criteriosAbiertos}
                className="table-toolbar"
                style={{
                  width: "100%",
                  border: "none",
                  background: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <strong style={{ fontSize: 15 }}>
                  Criterios evaluados ({inspeccion.respuestas.length})
                </strong>
                {criteriosAbiertos ? <CaretUp size={18} /> : <CaretDown size={18} />}
              </button>
              {criteriosAbiertos && (
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
              )}
            </div>
          )}

          {/* Documentos adjuntos */}
          <div className="data-panel">
            <div className="table-toolbar">
              <strong style={{ fontSize: 15 }}>Documentos adjuntos ({documentos.length})</strong>
            </div>

            {documentos.length === 0 ? (
              <p className="empty-row" style={{ padding: "0 16px" }}>Aún no hay documentos adjuntos a esta inspección.</p>
            ) : (
              <div className="inspeccion-respuestas">
                {documentos.map((doc) => {
                  const Icono = ICONO_POR_TIPO[doc.tipo] ?? FileIcon;
                  return (
                    <div key={doc.id} className="respuesta-row" style={{ gridTemplateColumns: "auto 1fr auto auto auto" }}>
                      <Icono size={20} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{doc.nombre}</span>
                      <span className="respuesta-observacion" style={{ fontSize: 12 }}>
                        {tipoDocumentoLabels[doc.tipo]} · {new Date(doc.fecha_subida).toLocaleDateString("es-PE")}
                        {doc.subido_por_nombre ? ` · ${doc.subido_por_nombre}` : ""}
                      </span>
                      <a
                        href={doc.archivo}
                        target="_blank"
                        rel="noreferrer"
                        download={doc.nombre}
                        className="table-action"
                        aria-label={`Descargar ${doc.nombre}`}
                        title="Descargar"
                      >
                        <DownloadSimple size={16} />
                      </a>
                      <button
                        type="button"
                        className="icon-button-danger"
                        aria-label={`Eliminar ${doc.nombre}`}
                        onClick={() => {
                          if (window.confirm(`¿Eliminar "${doc.nombre}"?`)) eliminarDocMut.mutate(doc.id);
                        }}
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Panel lateral */}
        <div className="help-panel">
          <h2>Exportar informe</h2>
          <p>Descarga el informe completo de esta inspección en el formato que necesites.</p>
          {errorDescarga && (
            <p style={{ color: "#c0392b", fontSize: 12, marginTop: 8 }}>{errorDescarga}</p>
          )}
          <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
            <button
              className="button button-secondary"
              disabled={descargandoExcel}
              onClick={async () => {
                setErrorDescarga(null);
                setDescargandoExcel(true);
                try { await exportarExcel(inspeccion.id); }
                catch { setErrorDescarga("No se pudo generar el Excel. Intenta de nuevo."); }
                finally { setDescargandoExcel(false); }
              }}
              style={{ width: "100%", justifyContent: "center" }}
            >
              <DownloadSimple size={16} /> {descargandoExcel ? "Generando…" : "Descargar Excel"}
            </button>
            <button
              className="button button-secondary"
              disabled={descargandoPdf}
              onClick={async () => {
                setErrorDescarga(null);
                setDescargandoPdf(true);
                try { await exportarPdf(inspeccion.id); }
                catch { setErrorDescarga("No se pudo generar el PDF. Intenta de nuevo."); }
                finally { setDescargandoPdf(false); }
              }}
              style={{ width: "100%", justifyContent: "center" }}
            >
              <FileArrowDown size={16} /> {descargandoPdf ? "Generando…" : "Descargar PDF"}
            </button>
          </div>

          <hr style={{ margin: "20px 0", borderColor: "#dfe6ef" }} />

          {/* Subir documentos — debajo de los descargables, visible sin scroll */}
          <h2>Cargar archivos</h2>
          <p>Adjunta PDF, Excel o Word como evidencia de esta inspección.</p>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.xls,.xlsx,.doc,.docx"
            style={{ display: "none" }}
            onChange={(e) => handleSeleccionArchivos(e.target.files)}
          />

          <button
            type="button"
            className="button button-secondary"
            onClick={() => fileInputRef.current?.click()}
            style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
          >
            <UploadSimple size={16} /> Elegir archivos
          </button>

          {errorDocumentos && (
            <p style={{ fontSize: 13, color: "var(--error)", marginTop: 8 }}>{errorDocumentos}</p>
          )}

          {pendientes.length > 0 && (
            <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
              <strong style={{ fontSize: 12, color: "var(--muted)" }}>
                {pendientes.length} archivo(s) listo(s) para subir
              </strong>
              {pendientes.map((archivo, i) => (
                <div
                  key={`${archivo.name}-${archivo.size}-${i}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    border: "1px solid var(--border, #e2e8f0)",
                    borderRadius: 8,
                    background: "#fff",
                  }}
                >
                  <FileIcon size={16} style={{ color: "var(--muted)", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {archivo.name}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted)" }}>{formatearTamano(archivo.size)}</div>
                  </div>
                  <button
                    type="button"
                    className="icon-button-danger"
                    aria-label={`Quitar ${archivo.name}`}
                    onClick={() => quitarPendiente(i)}
                    disabled={subirMut.isPending}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}

              <button
                type="button"
                className="button button-primary"
                onClick={() => subirMut.mutate(pendientes)}
                disabled={subirMut.isPending}
                style={{ width: "100%", justifyContent: "center", marginTop: 2 }}
              >
                <UploadSimple size={16} />
                {subirMut.isPending ? "Subiendo…" : `Subir ${pendientes.length} documento(s)`}
              </button>
            </div>
          )}

          <hr style={{ margin: "20px 0", borderColor: "#dfe6ef" }} />

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