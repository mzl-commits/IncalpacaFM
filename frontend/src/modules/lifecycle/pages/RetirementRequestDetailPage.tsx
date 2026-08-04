import { ArrowLeft, CheckCircle, FileText, Package, ShieldCheck, Warning } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { currentUser } from "@/modules/accounts/currentUser";
import { getRetirementRequest, updateRetirementRequest } from "@/modules/lifecycle/lifecycleRepository";
import { disposalLabels, retirementStatusLabels, type DisposalMethod, type RetirementRequest } from "@/modules/lifecycle/types";

export function RetirementRequestDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [request, setRequest] = useState<RetirementRequest>();
  const [loading, setLoading] = useState(true);
  const [decision, setDecision] = useState<"APROBAR" | "RECHAZAR" | "SUBSANAR">("APROBAR");
  const [method, setMethod] = useState<DisposalMethod>("RECICLAJE");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getRetirementRequest(id)
      .then((item) => { setRequest(item); setMethod(item.recommendation); })
      .catch(() => setError("No se pudo cargar la solicitud."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <section><p>Cargando solicitud…</p></section>;
  if (!request) return <section><h1>Solicitud no encontrada</h1><Link to="/bienes/ciclo-vida/bajas">Volver</Link></section>;
  const canDecide = ["PENDIENTE", "EN_EVALUACION", "SUBSANACION"].includes(request.status);
  const critical = request.estimatedRepairCost > request.estimatedCurrentValue;

  async function saveDecision() {
    if (!confirmed) {
      setError("Confirma que revisaste el sustento técnico.");
      return;
    }
    if (reason.trim().length < 10) {
      setError("Registra una justificación de al menos 10 caracteres.");
      return;
    }
    const status = decision === "APROBAR" ? "PENDIENTE_DISPOSICION" : decision === "RECHAZAR" ? "RECHAZADA" : "SUBSANACION";
    try {
    const updated = await updateRetirementRequest(request!.id, {
      status,
      decisionReason: reason.trim(),
      decisionBy: currentUser.fullName,
      decisionAt: new Date().toISOString(),
      approvedMethod: decision === "APROBAR" ? method : undefined,
    });
    setRequest(updated);
    setError("");
    if (decision === "APROBAR") navigate(`/bienes/ciclo-vida/bajas/${updated.id}/disposicion`);
    } catch {
      setError("No se pudo registrar la decisión. Revisa los datos obligatorios.");
    }
  }

  return (
    <section className="lifecycle-page decision-page">
      <div className="page-heading">
        <div><p className="breadcrumb">Ciclo de vida / Solicitudes de baja / Detalle</p><h1>Evaluación de baja</h1><p>{request.code}</p></div>
        <Link className="button button-secondary" to="/bienes/ciclo-vida/bajas"><ArrowLeft />Volver</Link>
      </div>
      {critical && <div className="criticality-banner"><Warning weight="fill" /><p><strong>Revisión prioritaria</strong><span>El costo estimado de reparación supera el valor actual del bien. Verifica cuidadosamente el sustento antes de decidir.</span></p></div>}
      <div className="decision-layout">
        <div className="decision-evidence">
          <article className="data-panel lifecycle-detail-panel">
            <div className="lifecycle-section-heading"><Package /><div><h2>Resumen del bien</h2><p>Estado y valoración del activo evaluado.</p></div></div>
            <dl className="lifecycle-summary-grid"><div><dt>Código</dt><dd>{request.assetCode}</dd></div><div><dt>Nombre</dt><dd>{request.assetName}</dd></div><div><dt>Estado de solicitud</dt><dd>{retirementStatusLabels[request.status]}</dd></div><div><dt>Orden relacionada</dt><dd>{request.workOrderCode}</dd></div><div><dt>Costo reparación</dt><dd>S/ {request.estimatedRepairCost.toFixed(2)}</dd></div><div><dt>Valor actual</dt><dd>S/ {request.estimatedCurrentValue.toFixed(2)}</dd></div></dl>
          </article>
          <article className="data-panel lifecycle-detail-panel">
            <div className="lifecycle-section-heading"><FileText /><div><h2>Sustento técnico</h2><p>Diagnóstico, evidencia y recomendación del equipo técnico.</p></div></div>
            <div className="technical-summary"><strong>{request.diagnosisResult === "NO_REPARABLE" ? "No reparable" : "Reparación no viable"}</strong><p>{request.technicalJustification}</p></div>
            <div className="evidence-chips">{request.evidence.map((name) => <span key={name}><FileText />{name}</span>)}</div>
          </article>
        </div>
        <aside className="data-panel decision-panel">
          <div className="lifecycle-section-heading"><ShieldCheck /><div><h2>Decisión de FM</h2><p>La aprobación habilita la disposición, pero aún no cierra el bien.</p></div></div>
          {!canDecide ? <div className="decision-locked"><CheckCircle /><strong>Decisión registrada</strong><p>{request.decisionReason}</p>{request.status === "PENDIENTE_DISPOSICION" && <Link className="button button-primary" to={`/bienes/ciclo-vida/bajas/${request.id}/disposicion`}>Registrar disposición</Link>}</div> : <>
            <div className="decision-tabs">{(["APROBAR", "RECHAZAR", "SUBSANAR"] as const).map((value) => <button type="button" className={decision === value ? "is-active" : ""} onClick={() => setDecision(value)} key={value}>{value === "APROBAR" ? "Aprobar" : value === "RECHAZAR" ? "Rechazar" : "Subsanar"}</button>)}</div>
            {decision === "APROBAR" && <label className="field"><span>Disposición autorizada *</span><select value={method} onChange={(event) => setMethod(event.target.value as DisposalMethod)}>{(Object.keys(disposalLabels) as DisposalMethod[]).map((value) => <option value={value} key={value}>{disposalLabels[value]}</option>)}</select></label>}
            <label className="field"><span>Justificación de la decisión *</span><textarea rows={5} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Fundamenta la decisión administrativa." /></label>
            <label className="confirmation-check"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>Confirmo que revisé diagnóstico, costos y evidencias.</span></label>
            {error && <div className="form-error" role="alert">{error}</div>}
            <button className={`button ${decision === "APROBAR" ? "button-primary" : "button-danger"}`} type="button" onClick={saveDecision}>{decision === "APROBAR" ? "Aprobar y programar" : "Registrar decisión"}</button>
          </>}
        </aside>
      </div>
    </section>
  );
}
