import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { ArrowClockwise, IdentificationBadge, MapPin, Package, ShieldCheck, WarningCircle, Wrench } from "@phosphor-icons/react";

import { ReportIncidentModal } from "@/modules/incidents/components/ReportIncidentModal";
import { getWorkRequestAssetDisplayCode, listWorkRequests } from "@/modules/incidents/incidentRepository";
import { requestStatusLabels, requestTypeLabels } from "@/modules/incidents/incidentModel";
import { fetchUserDashboard } from "../api/userDashboardApi";

export default function UserDashboardPage() {
  const navigate = useNavigate();
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [prefilledAssetId, setPrefilledAssetId] = useState<string | null>(null);
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["userDashboard"],
    queryFn: fetchUserDashboard,
  });
  const reportsQuery = useQuery({ queryKey: ["myReports"], queryFn: listWorkRequests });
  const reports = reportsQuery.data ?? [];
  const activeReports = reports.filter((report) => !["RECHAZADA", "CONVERTIDA_EN_OT"].includes(report.status));
  const pastReports = reports.filter((report) => ["RECHAZADA", "CONVERTIDA_EN_OT"].includes(report.status));

  const handleReportIssue = (assetId?: string) => {
    setPrefilledAssetId(assetId ?? null);
    setIsReportModalOpen(true);
  };

  return (
    <section className="dashboard-page user-dashboard-page">
      <div className="dashboard-heading">
        <div className="dashboard-heading-copy">
          <p className="breadcrumb">Inicio / Mi perfil</p>
          <h1>Mis bienes asignados</h1>
          <p>Consulta lo que tienes a tu cargo y registra una solicitud cuando necesites atención.</p>
        </div>
        <div className="dashboard-heading-actions">
          <button className="button button-primary" type="button" onClick={() => handleReportIssue()}>
            <WarningCircle size={18} weight="bold" /> Nueva solicitud
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="data-panel user-dashboard-skeleton" aria-label="Cargando perfil" />
      ) : isError || !data ? (
        <div className="dashboard-partial-error user-dashboard-error" role="alert">
          <WarningCircle size={20} />
          <span>No se pudo cargar tu perfil y tus bienes asignados.</span>
          <button className="button button-secondary button-sm" type="button" onClick={() => void refetch()} disabled={isFetching}>
            <ArrowClockwise size={16} className={isFetching ? "is-spinning" : ""} /> Reintentar
          </button>
        </div>
      ) : (
        <>
          <section className="data-panel user-profile-panel">
            <div className="user-profile-avatar" aria-hidden="true">{data.profile.display_name.charAt(0).toUpperCase()}</div>
            <div className="user-profile-copy">
              <span className="user-profile-kicker"><ShieldCheck size={15} /> Responsable de bienes</span>
              <h2>{data.profile.display_name}</h2>
              <div className="user-profile-meta">
                <span><IdentificationBadge size={16} /> {data.profile.worker_code || "Código no registrado"}</span>
                {data.profile.area_name && <span><Package size={16} /> {data.profile.area_name}</span>}
              </div>
            </div>
            <div className="user-profile-count"><strong>{data.assigned_assets.length}</strong><span>{data.assigned_assets.length === 1 ? "bien asignado" : "bienes asignados"}</span></div>
          </section>

          <section className="user-assets-section">
            <header className="dashboard-section-heading">
              <div><h2>Mis bienes</h2><p>Equipos y activos bajo tu responsabilidad.</p></div>
              <span className="section-count">{data.assigned_assets.length}</span>
            </header>
            {data.assigned_assets.length === 0 ? (
              <div className="dashboard-empty-activity data-panel"><Package size={28} /><strong>No tienes bienes asignados actualmente</strong><p>Cuando te asignen un bien, aparecerá aquí.</p></div>
            ) : (
              <div className="user-assets-grid">
                {data.assigned_assets.map((asset) => (
                  <article key={asset.id} className="data-panel user-asset-card">
                    {asset.repair_status && <div className="user-asset-repair-note"><Wrench size={14} weight="fill" /> En reparación: {asset.repair_status}</div>}
                    {asset.photo_url && <img className="user-asset-photo" src={asset.photo_url} alt={`Fotografía de ${asset.name}`} />}
                    <div className="user-asset-card-body">
                      <h3 title={asset.name}>{asset.name}</h3>
                      <p className="user-asset-code">{asset.fm_code || asset.code}</p>
                      <dl className="user-asset-facts">
                        <div><dt>Categoría</dt><dd>{asset.taxonomy || "Sin clasificar"}</dd></div>
                        <div><dt>Ubicación</dt><dd><MapPin size={14} /> {asset.location || "Sin ubicación"}</dd></div>
                        <div className="user-asset-status"><dt>Estado</dt><dd>{asset.condition}</dd></div>
                      </dl>
                    </div>
                    <div className="user-asset-card-actions">
                      <button className="button button-secondary button-sm" type="button" onClick={() => navigate(`/bienes/${asset.id}`)}>Ver detalle</button>
                      <button className="button button-primary button-sm" type="button" onClick={() => handleReportIssue(asset.id)}>Nueva solicitud</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="user-reports-section">
            <header className="dashboard-section-heading">
              <div><h2>Mis reportes</h2><p>Consulta el estado de tus solicitudes y su historial.</p></div>
              <button className="button button-secondary button-sm" type="button" onClick={() => handleReportIssue()}>Nuevo reporte</button>
            </header>
            {reportsQuery.isLoading ? <div className="data-panel user-reports-loading">Cargando tus reportes…</div> : reportsQuery.isError ? <div className="dashboard-partial-error" role="alert"><WarningCircle size={18} /><span>No se pudieron cargar tus reportes.</span><button className="button button-secondary button-sm" type="button" onClick={() => void reportsQuery.refetch()}>Reintentar</button></div> : <>
              <div className="user-report-group"><h3>En seguimiento <span>{activeReports.length}</span></h3>{activeReports.length ? activeReports.map((report) => <ReportRow key={report.id} report={report} />) : <div className="data-panel user-report-empty">No tienes reportes activos.</div>}</div>
              <div className="user-report-group"><h3>Reportes pasados <span>{pastReports.length}</span></h3>{pastReports.length ? pastReports.map((report) => <ReportRow key={report.id} report={report} />) : <div className="data-panel user-report-empty">Aquí aparecerán tus reportes cerrados o rechazados.</div>}</div>
            </>}
          </section>
        </>
      )}

      {isReportModalOpen && <ReportIncidentModal onClose={() => { setIsReportModalOpen(false); setPrefilledAssetId(null); }} prefilledAssetId={prefilledAssetId} assignedAssets={data?.assigned_assets} />}
    </section>
  );
}

function ReportRow({ report }: { report: Awaited<ReturnType<typeof listWorkRequests>>[number] }) {
  return <article className="data-panel user-report-row"><div><strong>{report.code}</strong><span>{requestTypeLabels[report.requestType]} · {getWorkRequestAssetDisplayCode(report) || "Sin bien asociado"}</span><small>{report.description}</small></div><div className={`status status-${report.status === "RECHAZADA" ? "error" : report.status === "CONVERTIDA_EN_OT" ? "success" : "warning"}`}>{requestStatusLabels[report.status]}</div><Link className="button button-secondary button-sm" to={`/incidencias/${report.id}`}>Ver reporte</Link></article>;
}
