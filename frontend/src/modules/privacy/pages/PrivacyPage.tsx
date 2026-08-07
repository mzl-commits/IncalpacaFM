import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { api } from "@/services/api";

type Notice = { version: string; title: string; content: string; effective_from: string };

export function PrivacyPage() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get<Notice[]>("/privacy/notices/active/?context=GENERAL").then(({ data }) => setNotice(data[0] ?? null)).catch(() => setError("No pudimos cargar el aviso de privacidad."));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setError("");
    try {
      await api.post("/privacy/arco/", { requester_name: form.get("name"), requester_email: form.get("email"), requester_document: form.get("document"), request_type: form.get("type"), description: form.get("description") });
      setSent(true);
      event.currentTarget.reset();
    } catch { setError("Revisa los datos e inténtalo nuevamente."); }
  }

  return <main className="public-page privacy-page">
    <header className="public-page-header"><Link to="/login">← Volver</Link><span>FM Incalpaca</span><h1>Privacidad y datos personales</h1><p>Información clara sobre el tratamiento de datos y un canal para ejercer derechos ARCO.</p></header>
    <section className="public-card"><h2>{notice?.title ?? "Aviso de privacidad"}</h2><small>Versión {notice?.version ?? "vigente"} · {notice?.effective_from ?? ""}</small><p>{notice?.content ?? "Tratamos la información necesaria para gestionar bienes, incidencias, mantenimiento, actas y la seguridad del servicio."}</p></section>
    <section className="public-card"><h2>Ejercer derechos ARCO</h2><p>Solicita acceso, rectificación, cancelación u oposición. Verificaremos tu identidad antes de entregar información.</p>{sent && <div className="notice success">Solicitud recibida. Te responderemos al correo indicado.</div>}{error && <div className="notice error">{error}</div>}<form onSubmit={submit} className="form-grid"><label>Nombre completo<input name="name" required /></label><label>Correo de contacto<input name="email" type="email" required /></label><label>Documento o código (opcional)<input name="document" /></label><label>Derecho solicitado<select name="type" defaultValue="ACCESO"><option value="ACCESO">Acceso</option><option value="RECTIFICACION">Rectificación</option><option value="CANCELACION">Cancelación</option><option value="OPOSICION">Oposición</option></select></label><label className="form-full">Detalle de la solicitud<textarea name="description" minLength={10} required /></label><button className="button button-primary">Enviar solicitud</button></form></section>
  </main>;
}
