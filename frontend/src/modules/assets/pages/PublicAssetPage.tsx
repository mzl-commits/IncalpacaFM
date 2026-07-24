import { Buildings, CheckCircle, MapPin, ShieldCheck, Tag } from "@phosphor-icons/react";
import { Link, useParams } from "react-router-dom";
import { listRegisteredAssets } from "@/modules/assets/assetEntryRepository";

export function PublicAssetPage() {
  const { token } = useParams();
  const asset = listRegisteredAssets().find((item) => item.publicToken === token);

  if (!asset) return <main className="public-page"><section className="public-card public-empty"><span className="public-logo">SG</span><ShieldCheck size={46} /><h1>Enlace no válido</h1><p>El código no corresponde a un bien público disponible.</p><Link className="button button-primary" to="/">Ir al sistema</Link></section></main>;

  const classification = asset.draft.classificationPending ? "Por confirmar" : `${asset.draft.assetType} · ${asset.draft.subcategory}`;
  const location = asset.draft.locationPending ? "Por confirmar" : `${asset.draft.building} · ${asset.draft.locationArea}`;

  return <main className="public-page"><section className="public-card">
    <header><span className="public-logo">SG</span><div><strong>SGTB Incalpaca</strong><small>Identificación pública del activo</small></div><span className="public-verified"><CheckCircle weight="fill" />Verificado</span></header>
    <div className="public-asset-title"><p className="breadcrumb">INFORMACIÓN DEL ACTIVO</p><h1>{asset.draft.name}</h1><code>{asset.code}</code><div className="status-cluster"><span className="status status-success">{asset.administrativeStatus}</span><span className="status status-neutral">{asset.operationalStatus}</span></div></div>
    <div className="public-facts">
      <p><Tag size={21} /><span><small>Clasificación</small>{classification}</span></p>
      <p><Buildings size={21} /><span><small>Marca y modelo</small>{asset.draft.brand || "Sin marca"} · {asset.draft.model || "Sin modelo"}</span></p>
      <p><MapPin size={21} /><span><small>Ubicación general</small>{location}</span></p>
      <p><ShieldCheck size={21} /><span><small>Condición registrada</small>{asset.draft.condition}</span></p>
    </div>
    <aside className="public-privacy"><ShieldCheck size={20} /><p><strong>Consulta segura</strong><span>Esta página no muestra responsables, costos, documentos, números de serie ni ubicaciones específicas.</span></p></aside>
    <footer>Última actualización: {new Intl.DateTimeFormat("es-PE", { dateStyle: "long" }).format(new Date(asset.createdAt))}</footer>
  </section></main>;
}
