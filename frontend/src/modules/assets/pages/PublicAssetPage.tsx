import {
  Buildings,
  Camera,
  CheckCircle,
  ClockCounterClockwise,
  MapPin,
  ShieldCheck,
  Siren,
  Tag,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getPublicAsset } from "@/modules/assets/assetEntryRepository";

type PublicAsset = Awaited<ReturnType<typeof getPublicAsset>>;

export function PublicAssetPage() {
  const { token = "" } = useParams();
  const [asset, setAsset] = useState<PublicAsset | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getPublicAsset(token).then(setAsset).catch(() => setFailed(true));
  }, [token]);

  if (!asset) {
    return <main className="public-page"><section className="public-card public-empty"><span className="public-logo">SG</span><ShieldCheck size={46} /><h1>{failed ? "Enlace no válido" : "Consultando activo…"}</h1><p>{failed ? "El código no corresponde a un bien público disponible." : "Validando el código QR en la base de datos."}</p>{failed && <Link className="button button-primary" to="/">Ir al sistema</Link>}</section></main>;
  }

  const visibleCode = asset.display_code || asset.fm_code || asset.code;
  const internalCode = asset.internal_code || asset.code;

  return <main className="public-page"><section className="public-card">
    <header><img src="/logo-incalpaca.png" alt="Incalpaca Logo" style={{ maxHeight: "32px", width: "auto" }} /><div><strong style={{ fontFamily: "var(--font-heading)" }}>FM Incalpaca</strong><small>Identificación pública del activo</small></div><span className="public-verified"><CheckCircle weight="fill" />Verificado</span></header>
    <div className="public-asset-photo">{asset.photo_url ? <img src={asset.photo_url} alt={`Fotografía registrada de ${asset.name}`} /> : <div><Camera size={40} weight="duotone" /><span>Fotografía pendiente</span></div>}</div>
    <div className="public-asset-title"><p className="breadcrumb">INFORMACIÓN DEL ACTIVO</p><h1>{asset.name}</h1><code>{visibleCode}</code>{visibleCode !== internalCode && <small>ID técnico: {internalCode}</small>}<div className="status-cluster"><span className="status status-success">{asset.administrative_status}</span><span className="status status-neutral">{asset.operational_status}</span></div></div>
    <div className="public-facts"><p><Tag size={21} /><span><small>Clasificación</small>{asset.classification}</span></p><p><Buildings size={21} /><span><small>Marca y modelo</small>{asset.brand || "Sin marca"} · {asset.model || "Sin modelo"}</span></p><p><MapPin size={21} /><span><small>Ubicación general</small>{asset.general_location}</span></p><p><ShieldCheck size={21} /><span><small>Condición registrada</small>{asset.condition}</span></p></div>
    {asset.service_tracking && <section className="public-tracking" aria-labelledby="public-tracking-title"><div className="public-tracking-heading"><ClockCounterClockwise size={21} /><div><h2 id="public-tracking-title">Seguimiento de tu reporte</h2><p>Estado actual: <strong>{asset.service_tracking.current_label}</strong></p></div></div><ol className="public-tracking-steps">{asset.service_tracking.steps.map((step) => <li className={`is-${step.state}`} key={step.id}><span aria-hidden="true">{step.state === "complete" ? "✓" : ""}</span><div><strong>{step.label}</strong>{step.at && <small>{new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(step.at))}</small>}</div></li>)}</ol><small className="public-tracking-note">Aquí puedes ver el avance general. No compartimos datos personales ni notas internas.</small>{asset.service_tracking.satisfaction?.available && <Link className="button button-secondary" to={asset.service_tracking.satisfaction.url}><CheckCircle size={18} /> Evaluar atención (opcional)</Link>}{asset.service_tracking.satisfaction?.completed && <small className="public-tracking-note">Gracias, tu evaluación del servicio fue registrada.</small>}</section>}
    <aside className="public-privacy"><ShieldCheck size={20} /><p><strong>Consulta segura</strong><span>Esta página no muestra responsables, costos, documentos, números de serie ni ubicaciones específicas.</span></p></aside>
    <div className="public-actions"><Link className="button button-primary" to={`/solicitud-trabajo?asset=${encodeURIComponent(token)}`}><Siren size={19} />Reportar una incidencia</Link><small>No necesitas iniciar sesión. El reporte quedará asociado a este bien.</small></div>
    <footer>Última actualización: {new Intl.DateTimeFormat("es-PE", { dateStyle: "long" }).format(new Date(asset.updated_at))}</footer>
  </section></main>;
}
