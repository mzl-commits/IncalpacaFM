import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { 
  Plus, 
  Eye, 
  FilePdf, 
  Printer, 
  X,
  CaretLeft,
  CaretRight,
  MagnifyingGlass,
  ArrowRight
} from "@phosphor-icons/react";
import { useAuth } from "@/modules/accounts/useAuth";
import { useWorkRequests } from "../useWorkRequests";
import { 
  requestPriorityLabels, 
  requestStatusLabels, 
  requestTypeLabels 
} from "../incidentValidation";
import { getWorkRequestAssetDisplayCode } from "../incidentRepository";
import { generateWorkRequestPdf } from "../utils/workRequestPdf";
import type { WorkRequest } from "../types";

export function IncidentListPage() {
  const { user } = useAuth();
  const {
    requests: filteredRequests,
    allRequests,
    values,
    setValue,
    clearFilters,
    statusOptions,
    priorityOptions,
    typeOptions,
    buildingOptions,
  } = useWorkRequests();

  // ESTADOS DE DETALLE EN MODAL Y PAGINACIÓN
  const [selectedRequest, setSelectedRequest] = useState<WorkRequest | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // 1. KPI COUNTS (4 TARJETAS SIMPLIFICADAS)
  const pendingCount = useMemo(
    () => allRequests.filter((r) => r.status === "PENDIENTE").length,
    [allRequests]
  );
  const evaluatingCount = useMemo(
    () => allRequests.filter((r) => r.status === "EN_EVALUACION").length,
    [allRequests]
  );
  const urgentCount = useMemo(
    () =>
      allRequests.filter(
        (r) => r.requesterPriority === "URGENTE" || r.requesterPriority === "EMERGENCIA"
      ).length,
    [allRequests]
  );
  const approvedCount = useMemo(
    () =>
      allRequests.filter(
        (r) => r.status === "APROBADA" || r.status === "CONVERTIDA_EN_OT"
      ).length,
    [allRequests]
  );

  // PAGINACIÓN DINÁMICA
  const totalPages = Math.ceil(filteredRequests.length / pageSize) || 1;
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, currentPage, pageSize]);

  function handlePageChange(newPage: number) {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  }

  function handleQuickPrint(request: WorkRequest, event?: React.MouseEvent) {
    event?.stopPropagation();
    void generateWorkRequestPdf({ request, action: "print" });
  }

  function handleQuickDownload(request: WorkRequest, event?: React.MouseEvent) {
    event?.stopPropagation();
    void generateWorkRequestPdf({ request, action: "download" });
  }

  function getStatusBadgeClass(status: string) {
    switch (status) {
      case "PENDIENTE":
        return "status-pendiente";
      case "EN_EVALUACION":
        return "status-evaluacion";
      case "APROBADA":
      case "CONVERTIDA_EN_OT":
        return "status-aprobada";
      case "RECHAZADA":
      case "CANCELADA":
        return "status-rechazada";
      default:
        return "status-pendiente";
    }
  }

  function getPriorityBadgeClass(priority: string) {
    switch (priority) {
      case "EMERGENCIA":
        return "p-emergencia";
      case "URGENTE":
        return "p-urgente";
      case "ALTA":
        return "p-alta";
      default:
        return "p-normal";
    }
  }

  return (
    <section className="incidents-list-page">
      {/* CABECERA PRINCIPAL */}
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Mantenimiento / Solicitudes</p>
          <h1>Solicitudes de trabajo</h1>
          <p style={{ fontSize: "13px", color: "#555555" }}>
            Registra, consulta y realiza seguimiento a las solicitudes de mantenimiento.
          </p>
        </div>
        <Link className="button button-primary" to="/incidencias/nueva" style={{ background: "#000000", color: "#FFFFFF" }}>
          <Plus size={16} weight="bold" />
          Nueva solicitud
        </Link>
      </div>

      {/* 4 TARJETAS KPI SIMPLIFICADAS */}
      <div className="incidents-kpi-grid">
        <div 
          className="incidents-kpi-card"
          style={{ cursor: "pointer" }}
          onClick={() => { setValue("status", values.status === "PENDIENTE" ? "" : "PENDIENTE"); setCurrentPage(1); }}
        >
          <span className="kpi-label">Pendientes</span>
          <span className="kpi-number">{pendingCount}</span>
        </div>

        <div 
          className="incidents-kpi-card"
          style={{ cursor: "pointer" }}
          onClick={() => { setValue("status", values.status === "EN_EVALUACION" ? "" : "EN_EVALUACION"); setCurrentPage(1); }}
        >
          <span className="kpi-label">En evaluación</span>
          <span className="kpi-number">{evaluatingCount}</span>
        </div>

        <div 
          className="incidents-kpi-card"
          style={{ cursor: "pointer" }}
          onClick={() => { setValue("priority", values.priority === "URGENTE" ? "" : "URGENTE"); setCurrentPage(1); }}
        >
          <span className="kpi-label">Urgentes</span>
          <span className="kpi-number">{urgentCount}</span>
        </div>

        <div 
          className="incidents-kpi-card"
          style={{ cursor: "pointer" }}
          onClick={() => { setValue("status", values.status === "APROBADA" ? "" : "APROBADA"); setCurrentPage(1); }}
        >
          <span className="kpi-label">Aprobadas</span>
          <span className="kpi-number">{approvedCount}</span>
        </div>
      </div>

      {/* BÚSQUEDA Y FILTROS COMPACTOS */}
      <div style={{ background: "#FFFFFF", border: "1px solid #000000", padding: "16px", marginBottom: "16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "12px", marginBottom: "12px", alignItems: "center" }}>
          <div style={{ position: "relative" }}>
            <MagnifyingGlass size={18} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#666666" }} />
            <input
              type="text"
              value={values.q}
              onChange={(e) => { setValue("q", e.target.value); setCurrentPage(1); }}
              placeholder="Buscar por código, solicitante, bien, ubicación o requerimiento..."
              style={{
                width: "100%",
                padding: "9px 12px 9px 38px",
                border: "1px solid #000000",
                fontSize: "13px",
                background: "#FAFAFA",
                fontFamily: "system-ui, sans-serif"
              }}
            />
          </div>

          <button
            type="button"
            onClick={() => { clearFilters(); setCurrentPage(1); }}
            style={{
              padding: "9px 14px",
              border: "1px solid #000000",
              background: "#FFFFFF",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer"
            }}
          >
            Limpiar filtros
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "10px" }}>
          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", marginBottom: "3px" }}>Estado</label>
            <select
              value={values.status}
              onChange={(e) => { setValue("status", e.target.value); setCurrentPage(1); }}
              style={{ width: "100%", padding: "7px 8px", border: "1px solid #CCCCCC", fontSize: "12.5px" }}
            >
              <option value="">Todos los estados</option>
              {statusOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", marginBottom: "3px" }}>Prioridad</label>
            <select
              value={values.priority}
              onChange={(e) => { setValue("priority", e.target.value); setCurrentPage(1); }}
              style={{ width: "100%", padding: "7px 8px", border: "1px solid #CCCCCC", fontSize: "12.5px" }}
            >
              <option value="">Todas las prioridades</option>
              {priorityOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", marginBottom: "3px" }}>Tipo de Solicitud</label>
            <select
              value={values.type}
              onChange={(e) => { setValue("type", e.target.value); setCurrentPage(1); }}
              style={{ width: "100%", padding: "7px 8px", border: "1px solid #CCCCCC", fontSize: "12.5px" }}
            >
              <option value="">Todos los tipos</option>
              {typeOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", marginBottom: "3px" }}>Ubicación / Edificio</label>
            <select
              value={values.building}
              onChange={(e) => { setValue("building", e.target.value); setCurrentPage(1); }}
              style={{ width: "100%", padding: "7px 8px", border: "1px solid #CCCCCC", fontSize: "12.5px" }}
            >
              <option value="">Todos los edificios</option>
              {buildingOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", marginBottom: "3px" }}>Reportada Desde</label>
            <input
              type="date"
              value={values.from}
              onChange={(e) => { setValue("from", e.target.value); setCurrentPage(1); }}
              style={{ width: "100%", padding: "6.5px 8px", border: "1px solid #CCCCCC", fontSize: "12.5px" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", marginBottom: "3px" }}>Reportada Hasta</label>
            <input
              type="date"
              value={values.to}
              onChange={(e) => { setValue("to", e.target.value); setCurrentPage(1); }}
              style={{ width: "100%", padding: "6.5px 8px", border: "1px solid #CCCCCC", fontSize: "12.5px" }}
            />
          </div>
        </div>
      </div>

      {/* TABLA PRINCIPAL ESTRUCTURADA */}
      <div className="incidents-table-container">
        <div className="incidents-table-scroll">
          <table className="incidents-table">
            <thead>
              <tr>
                <th style={{ width: "120px" }}>Código</th>
                <th style={{ minWidth: "220px" }}>Solicitud</th>
                <th style={{ minWidth: "160px" }}>Usuario</th>
                <th style={{ minWidth: "150px" }}>Ubicación</th>
                <th style={{ width: "110px" }}>Prioridad</th>
                <th style={{ width: "110px" }}>Fecha</th>
                <th style={{ width: "140px" }}>Estado</th>
                <th style={{ width: "210px", textAlign: "right" }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRequests.map((req) => (
                <tr key={req.id} style={{ cursor: "pointer" }} onClick={() => setSelectedRequest(req)}>
                  <td>
                    <strong style={{ fontFamily: "monospace", fontSize: "13px" }}>{req.code}</strong>
                  </td>
                  <td>
                    <div style={{ fontWeight: 700, color: "#000000" }}>
                      {requestTypeLabels[req.requestType] || req.requestType}
                    </div>
                    <div style={{ fontSize: "12px", color: "#444444", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "260px" }}>
                      {req.description}
                    </div>
                    {getWorkRequestAssetDisplayCode(req) && (
                      <div style={{ fontSize: "11px", color: "#666666" }}>
                        Bien: {getWorkRequestAssetDisplayCode(req)}
                      </div>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{req.requesterName}</div>
                    {req.requesterEmail && (
                      <div style={{ fontSize: "11px", color: "#666666" }}>{req.requesterEmail}</div>
                    )}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{req.building || "—"}</div>
                    <div style={{ fontSize: "11.5px", color: "#555555" }}>
                      {[req.area, req.room].filter(Boolean).join(" / ") || "—"}
                    </div>
                  </td>
                  <td>
                    <span className={`badge-priority ${getPriorityBadgeClass(req.requesterPriority)}`}>
                      {requestPriorityLabels[req.requesterPriority] || req.requesterPriority}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: "12px", whiteSpace: "nowrap" }}>
                      {new Intl.DateTimeFormat("es-PE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      }).format(new Date(req.reportedAt))}
                    </span>
                  </td>
                  <td>
                    <span className={`badge-status ${getStatusBadgeClass(req.status)}`}>
                      {requestStatusLabels[req.status] || req.status}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                    <div className="action-btn-group" style={{ justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        className="action-btn-icon"
                        onClick={() => setSelectedRequest(req)}
                        title="Ver detalle"
                      >
                        <Eye size={14} /> Detalle
                      </button>

                      <button
                        type="button"
                        className="action-btn-icon"
                        onClick={(e) => handleQuickDownload(req, e)}
                        title="Generar PDF"
                      >
                        <FilePdf size={14} /> PDF
                      </button>

                      <button
                        type="button"
                        className="action-btn-icon"
                        onClick={(e) => handleQuickPrint(req, e)}
                        title="Imprimir"
                      >
                        <Printer size={14} /> Imprimir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!paginatedRequests.length && (
                <tr>
                  <td colSpan={8} style={{ padding: "30px", textAlign: "center", color: "#666666", fontSize: "13.5px" }}>
                    No se encontraron solicitudes que coincidan con los criterios seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINACIÓN ESTRUCTURADA */}
        <div className="pagination-container">
          <div>
            Mostrando <strong>{paginatedRequests.length ? (currentPage - 1) * pageSize + 1 : 0}</strong> a{" "}
            <strong>{Math.min(currentPage * pageSize, filteredRequests.length)}</strong> de{" "}
            <strong>{filteredRequests.length}</strong> solicitudes
          </div>

          <div className="pagination-controls">
            <label style={{ fontSize: "12px", marginRight: "8px" }}>
              Mostrar:
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
                style={{ marginLeft: "4px", padding: "2px 6px", border: "1px solid #CCCCCC" }}
              >
                <option value={10}>10 por página</option>
                <option value={20}>20 por página</option>
                <option value={50}>50 por página</option>
              </select>
            </label>

            <button
              type="button"
              className="pagination-btn"
              disabled={currentPage <= 1}
              onClick={() => handlePageChange(currentPage - 1)}
            >
              <CaretLeft size={12} style={{ display: "inline" }} /> Anterior
            </button>

            <span style={{ fontWeight: 700, padding: "0 6px" }}>
              Página {currentPage} de {totalPages}
            </span>

            <button
              type="button"
              className="pagination-btn"
              disabled={currentPage >= totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
            >
              Siguiente <CaretRight size={12} style={{ display: "inline" }} />
            </button>
          </div>
        </div>
      </div>

      {/* MODAL DOCUMENTAL DE DETALLE DE SOLICITUD */}
      {selectedRequest && (
        <div 
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px"
          }}
          onClick={() => setSelectedRequest(null)}
        >
          <div 
            style={{
              background: "#FFFFFF",
              border: "2px solid #000000",
              width: "100%",
              maxWidth: "800px",
              maxHeight: "90vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 8px 24px rgba(0,0,0,0.3)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ background: "#000000", color: "#FFFFFF", padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontFamily: "Times New Roman, serif", fontSize: "16px", fontWeight: "bold", margin: 0 }}>
                DETALLE OFICIAL DE SOLICITUD DE TRABAJO — {selectedRequest.code}
              </h3>
              <button 
                type="button" 
                onClick={() => setSelectedRequest(null)}
                style={{ background: "transparent", border: "none", color: "#FFFFFF", cursor: "pointer" }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: "24px", overflowY: "auto", flex: 1, fontSize: "13px" }}>
              <div style={{ borderBottom: "1.5px solid #000000", paddingBottom: "10px", marginBottom: "16px", display: "flex", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#666666", textTransform: "uppercase" }}>SOLICITANTE</div>
                  <div style={{ fontSize: "15px", fontWeight: "bold" }}>{selectedRequest.requesterName}</div>
                  <div style={{ fontSize: "12px", color: "#555555" }}>{selectedRequest.requesterEmail || "Sin correo"}</div>
                </div>

                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#666666", textTransform: "uppercase" }}>ESTADO & PRIORIDAD</div>
                  <div style={{ marginTop: "4px", display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                    <span className={`badge-status ${getStatusBadgeClass(selectedRequest.status)}`}>
                      {requestStatusLabels[selectedRequest.status] || selectedRequest.status}
                    </span>
                    <span className={`badge-priority ${getPriorityBadgeClass(selectedRequest.requesterPriority)}`}>
                      {requestPriorityLabels[selectedRequest.requesterPriority] || selectedRequest.requesterPriority}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px", background: "#FAFAFA", border: "1px solid #E2E8F0", padding: "12px" }}>
                <div><strong>Tipo de Solicitud:</strong> {requestTypeLabels[selectedRequest.requestType] || selectedRequest.requestType}</div>
                <div><strong>Fecha de Registro:</strong> {new Date(selectedRequest.reportedAt).toLocaleString("es-PE")}</div>
                <div><strong>Edificio / Sector:</strong> {selectedRequest.building || "—"}</div>
                <div><strong>Ambiente / Área:</strong> {[selectedRequest.area, selectedRequest.room].filter(Boolean).join(" / ") || "—"}</div>
              </div>

              {selectedRequest.assetName || selectedRequest.assetCode ? (
                <div style={{ border: "1px solid #000000", padding: "12px", marginBottom: "16px" }}>
                  <div style={{ fontWeight: "bold", textTransform: "uppercase", fontSize: "12px", borderBottom: "1px solid #000", paddingBottom: "4px", marginBottom: "8px" }}>
                    BIEN / ACTIVO AFECTADO
                  </div>
                  <div><strong>Nombre del Bien:</strong> {selectedRequest.assetName || "Bien no especificado"}</div>
                  {selectedRequest.assetCode && <div><strong>Identificador Técnico:</strong> <code>{selectedRequest.assetCode}</code></div>}
                </div>
              ) : null}

              <div style={{ marginBottom: "16px" }}>
                <div style={{ fontWeight: "bold", textTransform: "uppercase", fontSize: "12px", borderBottom: "1px solid #000", paddingBottom: "4px", marginBottom: "8px" }}>
                  DESCRIPCIÓN DEL REQUERIMIENTO
                </div>
                <p style={{ background: "#FFFFFF", border: "1px solid #CCCCCC", padding: "10px", lineHeight: "1.5" }}>
                  {selectedRequest.description}
                </p>
                {selectedRequest.observations && (
                  <p style={{ marginTop: "6px", fontSize: "12px", color: "#555555" }}>
                    <strong>Observaciones:</strong> {selectedRequest.observations}
                  </p>
                )}
              </div>

              {selectedRequest.photoUrl && (
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ fontWeight: "bold", textTransform: "uppercase", fontSize: "12px", borderBottom: "1px solid #000", paddingBottom: "4px", marginBottom: "8px" }}>
                    EVIDENCIA FOTOGRÁFICA
                  </div>
                  <div style={{ border: "1px solid #CCCCCC", padding: "8px", textAlign: "center", background: "#FAFAFA" }}>
                    <img 
                      src={selectedRequest.photoUrl} 
                      alt="Evidencia fotográfica" 
                      style={{ maxHeight: "200px", margin: "0 auto", objectFit: "contain" }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div style={{ background: "#FAFAFA", borderTop: "1px solid #000000", padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  className="action-btn-icon"
                  onClick={() => handleQuickDownload(selectedRequest)}
                >
                  <FilePdf size={16} /> Descargar PDF
                </button>
                <button
                  type="button"
                  className="action-btn-icon"
                  onClick={() => handleQuickPrint(selectedRequest)}
                >
                  <Printer size={16} /> Imprimir
                </button>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                {user?.role === "ADMINISTRADOR" && selectedRequest.status === "PENDIENTE" && (
                  <Link
                    to={`/ordenes-trabajo/nueva/${selectedRequest.id}`}
                    className="action-btn-icon"
                    style={{ background: "#000000", color: "#FFFFFF" }}
                  >
                    Convertir en OT <ArrowRight size={14} />
                  </Link>
                )}

                <button
                  type="button"
                  className="action-btn-icon"
                  onClick={() => setSelectedRequest(null)}
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
