import { ArrowLeft, IdentificationBadge, Package, UserCircle } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { fetchUserProfile } from "../api/userDashboardApi";

export function UserBetaProfilePage() {
  const { id = "" } = useParams();
  const profileQuery = useQuery({ queryKey: ["user-profile", id], queryFn: () => fetchUserProfile(id), enabled: Boolean(id) });

  if (profileQuery.isLoading) return <section className="user-profile-page"><p className="loading-panel">Cargando perfil…</p></section>;
  if (profileQuery.isError || !profileQuery.data) return <section className="user-profile-page"><div className="dashboard-partial-error" role="alert">No fue posible cargar este perfil. Verifica tus permisos e inténtalo nuevamente.</div><Link className="button button-secondary" to="/mapa"><ArrowLeft /> Volver a ambientes</Link></section>;

  const { profile, assigned_assets: assets } = profileQuery.data;
  return <section className="user-profile-page">
    <header className="page-heading user-profile-heading"><div><p className="breadcrumb">Ambientes / Personas</p><h1>{profile.display_name}</h1><p>Bienes activos bajo su responsabilidad y ambiente de referencia.</p></div><Link className="button button-secondary" to="/mapa"><ArrowLeft /> Volver a ambientes</Link></header>
    <section className="user-profile-summary data-panel" aria-label="Resumen del responsable"><UserCircle size={36} aria-hidden="true" /><div><strong>{profile.display_name}</strong><span><IdentificationBadge size={16} /> {profile.worker_code || "Código no registrado"}</span><span><Package size={16} /> {profile.area_name || "Área no especificada"}</span></div><b>{assets.length} {assets.length === 1 ? "bien asignado" : "bienes asignados"}</b></section>
    <section className="user-profile-assets" aria-labelledby="user-profile-assets-title"><header><h2 id="user-profile-assets-title">Bienes asignados</h2><p>Selecciona un bien para consultar su ficha completa.</p></header>{assets.length ? <div className="user-profile-assets-grid">{assets.map((asset) => <Link key={asset.id} to={`/bienes/${asset.id}`} className="user-profile-asset"><span><strong>{asset.name}</strong><small>{asset.fm_code || asset.code}</small></span><span>{asset.location}</span><em>{asset.repair_status ? `En atención: ${asset.repair_status}` : asset.condition}</em></Link>)}</div> : <div className="empty-state">No tiene bienes activos asignados.</div>}</section>
  </section>;
}
