import { ArrowLeft, CheckCircle, ShieldCheck, Siren } from "@phosphor-icons/react";
import { type FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "@/services/api";

interface PublicAssetContext {
  displayCode: string;
  name: string;
  photoUrl: string | null;
  generalLocation: string;
}

export function PublicIncidentCreatePage() {
  const { token = "" } = useParams();
  const [asset, setAsset] = useState<PublicAssetContext | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");

  useEffect(() => {
    api.get<PublicAssetContext>(`/public/assets/${token}/report/`)
      .then(({ data }) => setAsset(data))
      .catch(() => setLoadError(true));
  }, [token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const values = new FormData(event.currentTarget);
    try {
      const { data } = await api.post<{ code: string }>(`/public/assets/${token}/report/`, {
        reporterName: values.get("reporterName"),
        reporterEmail: values.get("reporterEmail"),
        reporterDni: values.get("reporterDni"),
        reporterWorkerCode: values.get("reporterWorkerCode"),
        requestType: values.get("requestType"),
        requesterPriority: values.get("requesterPriority"),
        description: values.get("description"),
      });
      setCode(data.code);
    } catch {
      setError("No se pudo enviar el reporte. Revisa los datos e inténtalo nuevamente.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadError) return <main className="public-page"><section className="public-card public-empty"><Siren size={44} /><h1>Enlace no válido</h1><p>No encontramos el bien asociado a este código QR.</p></section></main>;
  if (!asset) return <main className="public-page"><section className="public-card public-empty"><span className="public-logo">SG</span><h1>Preparando el reporte…</h1></section></main>;
  if (code) return <main className="public-page"><section className="public-card public-report-success"><CheckCircle size={54} weight="fill" /><p className="breadcrumb">REPORTE RECIBIDO</p><h1>Gracias por informar</h1><p>Facility Management revisará la incidencia asociada al bien.</p><code>{code}</code><Link className="button button-primary" to={`/q/${token}`}>Volver a la ficha del bien</Link></section></main>;

  return <main className="public-page"><section className="public-card public-report-card">
    <header><span className="public-logo">SG</span><div><strong>Reporte público</strong><small>Facility Management</small></div><span className="public-verified"><ShieldCheck weight="fill" />Seguro</span></header>
    <Link className="public-back" to={`/q/${token}`}><ArrowLeft />Volver a la ficha</Link>
    <div className="public-report-asset">{asset.photoUrl ? <img src={asset.photoUrl} alt="" /> : <span>{asset.displayCode.slice(0, 2)}</span>}<div><small>{asset.displayCode}</small><h1>{asset.name}</h1><p>{asset.generalLocation}</p></div></div>
    <form className="public-report-form" onSubmit={submit}>
      <div className="form-grid">
        <label className="field"><span>Tu nombre <b>*</b></span><input name="reporterName" required maxLength={160} autoComplete="name" /></label>
        <label className="field"><span>Correo para seguimiento</span><input name="reporterEmail" type="email" autoComplete="email" placeholder="Opcional" /></label>
        <label className="field"><span>DNI <b>*</b></span><input name="reporterDni" required inputMode="numeric" pattern="[0-9]{8}" minLength={8} maxLength={8} autoComplete="off" placeholder="8 dígitos" /></label>
        <label className="field"><span>Código de trabajador <b>*</b></span><input name="reporterWorkerCode" required maxLength={40} autoComplete="off" placeholder="Ej. K4F89J" /></label>
        <label className="field"><span>Tipo de incidencia <b>*</b></span><select name="requestType" required defaultValue=""><option value="" disabled>Selecciona una opción</option><option value="FALLA">Falla o avería</option><option value="DANO">Daño visible</option><option value="SEGURIDAD">Riesgo de seguridad</option><option value="OTRO">Otro</option></select></label>
        <label className="field"><span>Prioridad percibida</span><select name="requesterPriority" defaultValue="MEDIA"><option value="BAJA">Baja</option><option value="MEDIA">Media</option><option value="ALTA">Alta</option></select></label>
        <label className="field field-wide"><span>Describe lo ocurrido <b>*</b></span><textarea name="description" required minLength={10} maxLength={3000} rows={5} placeholder="Indica qué observaste y desde cuándo…" /></label>
      </div>
      <p className="public-form-note"><ShieldCheck />Tu reporte se asociará a este bien. No se mostrará públicamente tu información.</p>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-primary" disabled={submitting}>{submitting ? "Enviando…" : "Enviar reporte"}</button>
    </form>
  </section></main>;
}
