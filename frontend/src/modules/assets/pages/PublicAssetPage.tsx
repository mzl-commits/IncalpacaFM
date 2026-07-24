import { Buildings, CheckCircle, MapPin, ShieldCheck } from "@phosphor-icons/react";
import { Link, useParams } from "react-router-dom";
import { listRegisteredAssets } from "@/modules/assets/assetEntryRepository";

export function PublicAssetPage() {
  const { token } = useParams();
  const asset = listRegisteredAssets().find((item) => item.publicToken === token);
  if (!asset) return <main className="public-page"><section className="public-card public-empty"><ShieldCheck size={48} /><h1>Enlace no válido</h1><p>El código no corresponde a un bien público disponible.</p><Link className="button button-primary" to="/">Ir al sistema</Link></section></main>;
  return <main className="public-page"><section className="public-card">
    <header><span className="brand-mark">FM</span><div><strong>Incalpaca</strong><small>Identificación pública de bien</small></div></header>
    <CheckCircle className="public-check" size={52} weight="fill" /><p className="breadcrumb">BIEN VERIFICADO</p><h1>{asset.draft.name}</h1><code>{asset.code}</code>
    <div className="public-facts">
      <p><Buildings size={21} /><span><small>Clasificación</small>{asset.draft.classificationPending ? "Por confirmar" : `${asset.draft.assetType} · ${asset.draft.subcategory}`}</span></p>
      <p><MapPin size={21} /><span><small>Ubicación</small>{asset.draft.locationPending ? "Por confirmar" : `${asset.draft.building} · ${asset.draft.room}`}</span></p>
      <p><ShieldCheck size={21} /><span><small>Estado</small>{asset.administrativeStatus} · {asset.operationalStatus}</span></p>
    </div><footer>Esta vista no muestra responsables, documentos ni información sensible.</footer>
  </section></main>;
}
