import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { fetchUserDashboard } from "../api/userDashboardApi";
import { ReportIncidentModal } from "@/modules/incidents/components/ReportIncidentModal";
import { WarningCircle, Package, IdentificationBadge, Warning, Info, Wrench } from "@phosphor-icons/react";

export default function UserDashboardPage() {
  const navigate = useNavigate();
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [prefilledAssetId, setPrefilledAssetId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["userDashboard"],
    queryFn: fetchUserDashboard,
  });

  const handleReportIssue = (assetId?: string) => {
    setPrefilledAssetId(assetId || null);
    setIsReportModalOpen(true);
  };

  return (
    <section className="dashboard-page">
      <div className="dashboard-heading">
        <div>
          <p className="breadcrumb">Inicio / Mi Perfil</p>
          <h1>Mi Perfil y Bienes Asignados</h1>
          <p>Gestiona los bienes que tienes a tu cargo y reporta incidencias de forma rápida.</p>
        </div>
        <div className="dashboard-heading-actions">
          <button className="button button-primary" onClick={() => handleReportIssue()}>
            <WarningCircle size={18} weight="bold" /> Reportar Falla General
          </button>
        </div>
      </div>

      {isLoading ? (
        <section className="dashboard-overview">
          <div className="data-panel skeleton" style={{ minHeight: "140px", border: "none" }}></div>
        </section>
      ) : isError || !data ? (
        <div className="dashboard-partial-error" role="status">
          <WarningCircle size={20} />
          <span>No se pudo cargar la información del perfil. Inténtalo más tarde.</span>
        </div>
      ) : (
        <>
          <section className="data-panel" style={{ padding: "1.5rem", marginBottom: "1.5rem", display: "flex", alignItems: "center", gap: "1rem" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "50%", backgroundColor: "#e2e8f0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", fontWeight: "bold", color: "#64748b" }}>
              {data.profile.display_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 style={{ fontSize: "1.25rem", margin: "0 0 0.25rem 0" }}>{data.profile.display_name}</h2>
              <div style={{ display: "flex", gap: "1rem", color: "var(--color-text-light)", fontSize: "0.875rem" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><IdentificationBadge size={16} /> {data.profile.worker_code}</span>
                {data.profile.area_name && (
                  <span style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}><Package size={16} /> {data.profile.area_name}</span>
                )}
              </div>
            </div>
          </section>

          <section>
            <header className="dashboard-section-heading" style={{ marginTop: "2rem" }}>
              <div>
                <h2>Mis Bienes Asignados</h2>
                <p>Equipos y activos bajo tu responsabilidad.</p>
              </div>
            </header>

            {data.assigned_assets.length === 0 ? (
              <div className="dashboard-empty-activity data-panel">
                <Package size={28} />
                <strong>No tienes bienes asignados actualmente</strong>
                <p>Cuando te asignen un bien, aparecerá aquí.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1rem" }}>
                {data.assigned_assets.map(asset => (
                  <div key={asset.id} className="data-panel" style={{ padding: "0", display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    {asset.repair_status && (
                      <div style={{ backgroundColor: "#fef3c7", color: "#b45309", padding: "0.5rem 1rem", fontSize: "0.75rem", fontWeight: "bold", display: "flex", alignItems: "center", gap: "0.25rem", borderBottom: "1px solid #fde68a" }}>
                        <Wrench size={14} weight="fill" /> En Reparación: {asset.repair_status}
                      </div>
                    )}
                    <div style={{ padding: "1rem", flex: "1" }}>
                      <h3 style={{ margin: "0 0 0.25rem 0", fontSize: "1rem" }} title={asset.name}>{asset.name}</h3>
                      <p style={{ margin: "0 0 1rem 0", fontSize: "0.75rem", fontFamily: "monospace", color: "var(--color-text-light)" }}>
                        {asset.fm_code || asset.code}
                      </p>
                      <dl style={{ margin: "0", fontSize: "0.875rem", display: "grid", gap: "0.5rem" }}>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <dt style={{ color: "var(--color-text-light)" }}>Categoría</dt>
                          <dd style={{ margin: "0", fontWeight: "500", textAlign: "right" }}>{asset.taxonomy || "N/A"}</dd>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <dt style={{ color: "var(--color-text-light)" }}>Ubicación</dt>
                          <dd style={{ margin: "0", fontWeight: "500", textAlign: "right" }}>{asset.location}</dd>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.5rem", paddingTop: "0.5rem", borderTop: "1px solid var(--color-border)" }}>
                          <dt style={{ color: "var(--color-text-light)" }}>Estado</dt>
                          <dd style={{ margin: "0" }}>
                            <span style={{ padding: "0.125rem 0.5rem", borderRadius: "1rem", fontSize: "0.75rem", backgroundColor: "var(--color-background-soft)", border: "1px solid var(--color-border)" }}>
                              {asset.condition}
                            </span>
                          </dd>
                        </div>
                      </dl>
                    </div>
                    <div style={{ padding: "1rem", borderTop: "1px solid var(--color-border)", display: "flex", gap: "0.5rem" }}>
                      <button className="button button-secondary" style={{ flex: "1", fontSize: "0.75rem", padding: "0.25rem" }} onClick={() => navigate(`/bienes/${asset.id}`)}>
                        Ver Detalle
                      </button>
                      <button className="button button-primary" style={{ flex: "1", fontSize: "0.75rem", padding: "0.25rem", backgroundColor: "#f59e0b", borderColor: "#f59e0b" }} onClick={() => handleReportIssue(asset.id)}>
                        Reportar Falla
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {isReportModalOpen && (
        <ReportIncidentModal
          onClose={() => {
            setIsReportModalOpen(false);
            setPrefilledAssetId(null);
          }}
          prefilledAssetId={prefilledAssetId}
          assignedAssets={data?.assigned_assets}
        />
      )}
    </section>
  );
}
