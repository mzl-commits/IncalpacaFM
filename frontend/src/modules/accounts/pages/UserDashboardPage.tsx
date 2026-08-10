import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowClockwise, IdentificationBadge, MapPin, Package, ShieldCheck, WarningCircle, Wrench } from "@phosphor-icons/react";

import { ReportIncidentModal } from "@/modules/incidents/components/ReportIncidentModal";
import { fetchUserDashboard } from "../api/userDashboardApi";

export default function UserDashboardPage() {
  const navigate = useNavigate();
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [prefilledAssetId, setPrefilledAssetId] = useState<string | null>(null);
  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ["userDashboard"],
    queryFn: fetchUserDashboard,
  });

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
          <p>Consulta lo que tienes a tu cargo y reporta una incidencia con la información necesaria.</p>
        </div>
        <div className="dashboard-heading-actions">
          <button className="button button-primary" type="button" onClick={() => handleReportIssue()}>
            <WarningCircle size={18} weight="bold" /> Reportar falla general
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
                      <button className="button button-primary button-sm" type="button" onClick={() => handleReportIssue(asset.id)}>Reportar falla</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {isReportModalOpen && <ReportIncidentModal onClose={() => { setIsReportModalOpen(false); setPrefilledAssetId(null); }} prefilledAssetId={prefilledAssetId} assignedAssets={data?.assigned_assets} />}
    </section>
  );
}
