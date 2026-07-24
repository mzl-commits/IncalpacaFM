import { Buildings, CheckCircle, MapPin, ShieldCheck, Tag } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPublicAsset } from "@/modules/assets/assetEntryRepository";

type PublicAsset = Awaited<ReturnType<typeof getPublicAsset>>;

export function PublicAssetPage() {
  const { token = "" } = useParams();
  const [asset, setAsset] = useState<PublicAsset | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { getPublicAsset(token).then(setAsset).catch(() => setFailed(true)); }, [token]);

  if (!asset) return <main className="public-page"><section className="public-card public-empty"><span className="public-logo">SG</span><ShieldCheck size={46} /><h1>{failed ? "Enlace no válido" : "Consultando activo…"}</h1><p>{failed ? "El código no corresponde a un bien público disponible." : "Validando el código QR en la base de datos."}</p>{failed && <Link className="button button-primary" to="/">Ir al sistema</Link>}</section></main>;

  return <main className="public-page"><section className="public-card">
    <header><span className="public-logo">SG</span><div><strong>SGTB Incalpaca</strong><small>Identificación pública del activo</small></div><span className="public-verified"><CheckCircle weight="fill" />Verificado</span></header>
    <div className="public-asset-title"><p className="breadcrumb">INFORMACIÓN DEL ACTIVO</p><h1>{asset.name}</h1><code>{asset.code}</code><div className="status-cluster"><span className="status status-success">{asset.administrative_status}</span><span className="status status-neutral">{asset.operational_status}</span></div></div>
    <div className="public-facts">
      <p><Tag size={21} /><span><small>Clasificación</small>{asset.classification}</span></p>
      <p><Buildings size={21} /><span><small>Marca y modelo</small>{asset.brand || "Sin marca"} · {asset.model || "Sin modelo"}</span></p>
      <p><MapPin size={21} /><span><small>Ubicación general</small>{asset.general_location}</span></p>
      <p><ShieldCheck size={21} /><span><small>Condición registrada</small>{asset.condition}</span></p>
    </div>
    <aside className="public-privacy"><ShieldCheck size={20} /><p><strong>Consulta segura</strong><span>Esta página no muestra responsables, costos, documentos, números de serie ni ubicaciones específicas.</span></p></aside>
    <footer>Última actualización: {new Intl.DateTimeFormat("es-PE", { dateStyle: "long" }).format(new Date(asset.updated_at))}</footer>
  </section></main>;
}
