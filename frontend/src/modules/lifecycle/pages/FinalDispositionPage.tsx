import { ArrowLeft, CheckCircle, FileText, Recycle, Warning } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getRetirementRequest, updateRetirementRequest } from "@/modules/lifecycle/lifecycleRepository";
import { disposalLabels } from "@/modules/lifecycle/types";
import type { RetirementRequest } from "@/modules/lifecycle/types";

export function FinalDispositionPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [request, setRequest] = useState<RetirementRequest>();
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState("");
  const [certificate, setCertificate] = useState("");
  const [organization, setOrganization] = useState("");
  const [taxId, setTaxId] = useState("");
  const [value, setValue] = useState(0);
  const [evidence, setEvidence] = useState<string[]>([]);
  const [checks, setChecks] = useState({ qr: false, assignments: false, inventory: false });
  const [error, setError] = useState("");

  useEffect(() => {
    getRetirementRequest(id)
      .then(setRequest)
      .catch(() => setError("No se pudo cargar la solicitud."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <section><p>Cargando disposición…</p></section>;
  if (!request) return <section><h1>Solicitud no encontrada</h1></section>;
  if (request.status === "CERRADA") return <section className="lifecycle-success"><CheckCircle weight="fill" /><h1>Ciclo de vida cerrado</h1><p>{request.assetCode} fue dado de baja y su disposición final quedó registrada.</p><Link className="button button-primary" to={`/bienes/ciclo-vida/bajas/${request.id}`}>Ver expediente</Link><Link className="button button-secondary" to="/bienes/ciclo-vida/bajas">Volver al listado</Link></section>;
  if (request.status !== "PENDIENTE_DISPOSICION") return <section><h1>Disposición no habilitada</h1><p>La solicitud debe estar aprobada antes de registrar el cierre.</p><Link to={`/bienes/ciclo-vida/bajas/${request.id}`}>Volver</Link></section>;

  async function submit() {
    if (!date || !certificate.trim() || !organization.trim() || !evidence.length || !Object.values(checks).every(Boolean)) {
      setError("Completa los datos, adjunta evidencia y confirma toda la lista de cierre.");
      return;
    }
    try {
    const updated = await updateRetirementRequest(request!.id, {
      status: "CERRADA",
      disposal: {
        effectiveDate: date, certificateNumber: certificate.trim(), organization: organization.trim(),
        taxId: taxId.trim(), recoveredValue: value, evidence,
        qrDestroyed: checks.qr, assignmentsClosed: checks.assignments, inventoryUpdated: checks.inventory,
      },
    });
    setRequest(updated);
    navigate(`/bienes/ciclo-vida/bajas/${request!.id}/disposicion`, { replace: true });
    } catch {
      setError("No se pudo cerrar el ciclo de vida. Revisa el acta y las verificaciones.");
    }
  }

  return (
    <section className="lifecycle-page disposition-page">
      <div className="page-heading"><div><p className="breadcrumb">Bienes / Ciclo de vida / Disposición final</p><h1>Registrar disposición final</h1><p>Documenta la ejecución autorizada para cerrar el ciclo de vida del bien.</p></div><Link className="button button-secondary" to={`/bienes/ciclo-vida/bajas/${request.id}`}><ArrowLeft />Volver</Link></div>
      <div className="disposition-layout">
        <aside className="data-panel disposition-summary"><Recycle /><h2>{request.assetName}</h2><Link to={`/bienes/${request.assetId}`}><strong>{request.assetCode}</strong></Link><dl><div><dt>Solicitud</dt><dd><Link to={`/bienes/ciclo-vida/bajas/${request.id}`}>{request.code}</Link></dd></div><div><dt>Método aprobado</dt><dd>{disposalLabels[request.approvedMethod ?? request.recommendation]}</dd></div></dl><div className="consequence-note"><Warning /><p>Al confirmar, el bien quedará cerrado y su QR administrativo deberá quedar inactivo.</p></div></aside>
        <form className="data-panel lifecycle-form" onSubmit={(event) => { event.preventDefault(); submit(); }}>
          <div className="lifecycle-section-heading"><FileText /><div><h2>Datos de la disposición</h2><p>Todos los campos obligatorios forman parte del acta de cierre.</p></div></div>
          <div className="form-grid">
            <label className="field"><span>Fecha efectiva *</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
            <label className="field"><span>N.º de acta o certificado *</span><input value={certificate} onChange={(event) => setCertificate(event.target.value)} /></label>
            <label className="field"><span>Entidad gestora o destinatario *</span><input value={organization} onChange={(event) => setOrganization(event.target.value)} /></label>
            <label className="field"><span>RUC / identificación</span><input value={taxId} onChange={(event) => setTaxId(event.target.value)} /></label>
            <label className="field"><span>Valor recuperado (S/)</span><input type="number" min="0" value={value} onChange={(event) => setValue(Number(event.target.value))} /></label>
          </div>
          <label className="upload-box lifecycle-upload"><FileText size={30} /><span><strong>Adjuntar acta y evidencias *</strong><small>PDF, JPG o PNG.</small></span><input hidden type="file" multiple accept="image/*,.pdf" onChange={(event) => setEvidence(Array.from(event.target.files ?? []).map((file) => file.name))} /></label>
          {!!evidence.length && <ul className="selected-files-list">{evidence.map((name) => <li key={name}>{name}</li>)}</ul>}
          <fieldset className="closure-checklist"><legend>Lista de verificación de cierre *</legend>
            <label><input type="checkbox" checked={checks.qr} onChange={(event) => setChecks({ ...checks, qr: event.target.checked })} />Se confirmó el retiro o destrucción de la etiqueta QR.</label>
            <label><input type="checkbox" checked={checks.assignments} onChange={(event) => setChecks({ ...checks, assignments: event.target.checked })} />No existen asignaciones activas pendientes.</label>
            <label><input type="checkbox" checked={checks.inventory} onChange={(event) => setChecks({ ...checks, inventory: event.target.checked })} />Se completó la actualización del inventario.</label>
          </fieldset>
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="form-actions"><Link className="button button-secondary" to={`/bienes/ciclo-vida/bajas/${request.id}`}>Guardar para después</Link><button className="button button-danger" type="submit"><CheckCircle />Confirmar disposición y cerrar bien</button></div>
        </form>
      </div>
    </section>
  );
}
