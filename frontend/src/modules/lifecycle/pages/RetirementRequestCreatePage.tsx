import { ArrowLeft, ArrowRight, Check, FileText, Package, ShieldCheck } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { currentUser } from "@/modules/accounts/currentUser";
import {
  createRetirementRequest,
  getRetirementRequestByDiagnosis,
  listDiagnoses,
} from "@/modules/lifecycle/lifecycleRepository";
import { disposalLabels, type DisposalMethod, type RetirementRequest, type TechnicalDiagnosis } from "@/modules/lifecycle/types";

const steps = ["Bien", "Sustento", "Recomendación", "Confirmación"];

export function RetirementRequestCreatePage() {
  const { diagnosisId = "" } = useParams();
  const navigate = useNavigate();
  const [diagnosis, setDiagnosis] = useState<TechnicalDiagnosis>();
  const [existing, setExisting] = useState<RetirementRequest>();
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [recommendation, setRecommendation] = useState<DisposalMethod>("RECICLAJE");
  const [supervisor, setSupervisor] = useState("Rosa Medina");
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    listDiagnoses()
      .then(async (items) => {
        const found = items.find((item) => item.id === diagnosisId);
        setDiagnosis(found);
        if (found) setExisting(await getRetirementRequestByDiagnosis(found.id));
      })
      .catch(() => setError("No se pudo cargar el diagnóstico."))
      .finally(() => setLoading(false));
  }, [diagnosisId]);

  if (loading) return <section><p>Cargando expediente técnico…</p></section>;
  if (!diagnosis) {
    return <section><div className="page-heading"><div><h1>Diagnóstico no encontrado</h1><p>Registra primero un diagnóstico técnico válido.</p></div><Link className="button button-secondary" to="/ordenes-trabajo">Volver</Link></div></section>;
  }
  if (existing) {
    return <section><div className="page-heading"><div><h1>Solicitud ya registrada</h1><p>{existing.code} ya fue creada desde este diagnóstico.</p></div><Link className="button button-primary" to={`/bienes/ciclo-vida/bajas/${existing.id}`}>Ver solicitud</Link></div></section>;
  }

  async function submit() {
    if (!confirmed) {
      setError("Confirma que revisaste el sustento antes de enviar.");
      return;
    }
    try {
      const request = await createRetirementRequest(diagnosis!, {
        recommendation,
        supervisorName: supervisor,
        requestedBy: currentUser.fullName,
      });
      navigate(`/bienes/ciclo-vida/bajas/${request.id}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo crear la solicitud.");
    }
  }

  return (
    <section className="lifecycle-page retirement-wizard">
      <div className="page-heading">
        <div><p className="breadcrumb">Ciclo de vida / Bajas / Nueva solicitud</p><h1>Solicitud de evaluación de baja</h1><p>Prepara el expediente que Facility Management revisará antes de decidir.</p></div>
        <Link className="button button-secondary" to={`/ordenes-trabajo/${diagnosis.workOrderId}/diagnostico`}><ArrowLeft />Volver</Link>
      </div>
      <ol className="lifecycle-stepper" aria-label="Progreso de la solicitud">
        {steps.map((label, index) => <li key={label} className={index === step ? "is-current" : index < step ? "is-complete" : ""}><span>{index < step ? <Check /> : index + 1}</span><small>{label}</small></li>)}
      </ol>

      <div className="data-panel lifecycle-wizard-panel">
        {step === 0 && <div className="wizard-content">
          <div className="lifecycle-section-heading"><Package /><div><h2>Bien relacionado</h2><p>Verifica que el diagnóstico corresponde al bien correcto.</p></div></div>
          <dl className="lifecycle-summary-grid"><div><dt>Código</dt><dd>{diagnosis.assetCode}</dd></div><div><dt>Bien</dt><dd>{diagnosis.assetName}</dd></div><div><dt>Orden de trabajo</dt><dd>{diagnosis.workOrderCode}</dd></div><div><dt>Evaluador</dt><dd>{diagnosis.evaluatorName}</dd></div></dl>
        </div>}
        {step === 1 && <div className="wizard-content">
          <div className="lifecycle-section-heading"><FileText /><div><h2>Sustento técnico</h2><p>Esta información queda bloqueada al enviar el expediente.</p></div></div>
          <div className="technical-summary"><strong>{diagnosis.result === "NO_REPARABLE" ? "No reparable" : "Reparación no viable"}</strong><p>{diagnosis.technicalJustification}</p></div>
          <dl className="lifecycle-summary-grid"><div><dt>Costo de reparación</dt><dd>S/ {diagnosis.estimatedRepairCost.toFixed(2)}</dd></div><div><dt>Valor actual</dt><dd>S/ {diagnosis.estimatedCurrentValue.toFixed(2)}</dd></div><div><dt>Evidencias</dt><dd>{diagnosis.evidence.length} archivo(s)</dd></div></dl>
        </div>}
        {step === 2 && <div className="wizard-content">
          <div className="lifecycle-section-heading"><ShieldCheck /><div><h2>Recomendación</h2><p>La recomendación no reemplaza la decisión final de FM.</p></div></div>
          <div className="disposal-options">{(Object.keys(disposalLabels) as DisposalMethod[]).map((method) => <label key={method} className={recommendation === method ? "is-selected" : ""}><input type="radio" name="method" checked={recommendation === method} onChange={() => setRecommendation(method)} /><strong>{disposalLabels[method]}</strong></label>)}</div>
          <label className="field"><span>Supervisor que valida el expediente *</span><input value={supervisor} onChange={(event) => setSupervisor(event.target.value)} /></label>
        </div>}
        {step === 3 && <div className="wizard-content">
          <div className="lifecycle-section-heading"><Check /><div><h2>Confirmar solicitud</h2><p>Se creará en estado Pendiente; el bien seguirá activo.</p></div></div>
          <div className="lifecycle-notice"><ShieldCheck /><p><strong>Esta acción no da de baja el bien.</strong><span>Facility Management deberá aprobar o rechazar la solicitud en una pantalla independiente.</span></p></div>
          <dl className="lifecycle-summary-grid"><div><dt>Bien</dt><dd>{diagnosis.assetCode}</dd></div><div><dt>Resultado</dt><dd>{diagnosis.result === "NO_REPARABLE" ? "No reparable" : "Reparación no viable"}</dd></div><div><dt>Recomendación</dt><dd>{disposalLabels[recommendation]}</dd></div><div><dt>Supervisor</dt><dd>{supervisor}</dd></div></dl>
          <label className="confirmation-check"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>Confirmo que revisé el diagnóstico, evidencias y justificación técnica.</span></label>
        </div>}
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="form-actions">
          <button className="button button-secondary" type="button" disabled={step === 0} onClick={() => setStep((value) => value - 1)}><ArrowLeft />Anterior</button>
          {step < 3 ? <button className="button button-primary" type="button" onClick={() => setStep((value) => value + 1)}>Continuar<ArrowRight /></button> : <button className="button button-primary" type="button" onClick={submit}><Check />Enviar solicitud</button>}
        </div>
      </div>
    </section>
  );
}
