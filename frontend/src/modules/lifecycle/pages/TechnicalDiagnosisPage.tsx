import {
  ArrowLeft,
  Camera,
  CheckCircle,
  ClipboardText,
  FloppyDisk,
  Package,
  WarningCircle,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { currentUser } from "@/modules/accounts/currentUser";
import { listRegisteredAssets } from "@/modules/assets/assetEntryRepository";
import type { RegisteredAsset } from "@/modules/assets/entryModel";
import {
  getDiagnosisByWorkOrder,
  getRetirementRequestByDiagnosis,
  saveDiagnosis,
} from "@/modules/lifecycle/lifecycleRepository";
import type { ReparabilityResult, TechnicalDiagnosis } from "@/modules/lifecycle/types";
import { getWorkOrderById } from "@/modules/workorders/workOrderRepository";

export function TechnicalDiagnosisPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [workOrder, setWorkOrder] = useState<Awaited<ReturnType<typeof getWorkOrderById>>>();
  const [existing, setExisting] = useState<TechnicalDiagnosis>();
  const [assets, setAssets] = useState<RegisteredAsset[]>([]);
  const [assetId, setAssetId] = useState("");
  const [result, setResult] = useState<ReparabilityResult>("REPARABLE");
  const [description, setDescription] = useState("");
  const [probableCause, setProbableCause] = useState("");
  const [risk, setRisk] = useState("");
  const [components, setComponents] = useState("");
  const [justification, setJustification] = useState("");
  const [repairCost, setRepairCost] = useState(0);
  const [currentValue, setCurrentValue] = useState(0);
  const [evidence, setEvidence] = useState<string[]>([]);
  const [requestExists, setRequestExists] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (id) void getWorkOrderById(id).then(setWorkOrder);
    listRegisteredAssets().then(setAssets).catch(() => setError("No se pudo cargar el inventario de bienes."));
    getDiagnosisByWorkOrder(id).then((diagnosis) => {
      if (!diagnosis) return;
      setExisting(diagnosis); setAssetId(diagnosis.assetId); setResult(diagnosis.result);
      setDescription(diagnosis.description); setProbableCause(diagnosis.probableCause);
      setRisk(diagnosis.operationalRisk); setComponents(diagnosis.affectedComponents);
      setJustification(diagnosis.technicalJustification); setRepairCost(diagnosis.estimatedRepairCost);
      setCurrentValue(diagnosis.estimatedCurrentValue); setEvidence(diagnosis.evidence);
      getRetirementRequestByDiagnosis(diagnosis.id).then((value) => setRequestExists(!!value));
    }).catch(() => setError("No se pudo cargar el diagnóstico."));
  }, [id]);

  const selectedAsset = useMemo(
    () => assets.find((asset) => asset.id === assetId),
    [assets, assetId],
  );
  const eligible = result === "NO_REPARABLE" || result === "REPAIR_NOT_VIABLE";
  const checklist = {
    diagnosis: description.trim().length >= 20,
    result: eligible,
    evidence: evidence.length > 0,
    justification: justification.trim().length >= 20,
  };
  const canDerive = Object.values(checklist).every(Boolean);
  async function persist(derive: boolean) {
    if (!workOrder || !selectedAsset) {
      setError("Selecciona el bien relacionado con la orden.");
      return;
    }
    if (description.trim().length < 20) {
      setError("El diagnóstico debe tener al menos 20 caracteres.");
      return;
    }
    if (derive && !canDerive) {
      setError("Completa todos los requisitos antes de derivar a evaluación de baja.");
      return;
    }
    try {
    const diagnosis = await saveDiagnosis({
      workOrderId: workOrder.id,
      workOrderCode: workOrder.code,
      assetId: selectedAsset.id,
      assetCode: selectedAsset.code,
      assetName: selectedAsset.draft.name,
      evaluatorName: currentUser.fullName,
      result,
      description: description.trim(),
      probableCause,
      operationalRisk: risk,
      affectedComponents: components,
      technicalJustification: justification.trim(),
      estimatedRepairCost: repairCost,
      estimatedCurrentValue: currentValue,
      evidence,
    }, existing?.id);
    navigate(derive ? `/ciclo-vida/bajas/nueva/${diagnosis.id}` : `/ordenes-trabajo/${workOrder.id}`);
    } catch {
      setError("No se pudo guardar el diagnóstico. Revisa los campos obligatorios.");
    }
  }

  if (!workOrder) {
    return <section><h1>Orden de trabajo no encontrada</h1><Link to="/ordenes-trabajo">Volver</Link></section>;
  }

  return (
    <section className="lifecycle-page diagnosis-page">
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Órdenes de trabajo / {workOrder.code} / Diagnóstico</p>
          <h1>Diagnóstico técnico</h1>
          <p>Documenta el estado del bien y determina si corresponde iniciar una evaluación de baja.</p>
        </div>
        <Link className="button button-secondary" to={`/ordenes-trabajo/${workOrder.id}`}>
          <ArrowLeft size={18} /> Volver
        </Link>
      </div>

      <div className="lifecycle-context-strip">
        <ClipboardText size={20} />
        <div><strong>{workOrder.code}</strong><span>Orden en diagnóstico técnico</span></div>
        <span className="status status-neutral">{workOrder.progressPercentage}% de avance</span>
      </div>

      <div className="diagnosis-layout">
        <form className="data-panel lifecycle-form" onSubmit={(event) => { event.preventDefault(); persist(false); }}>
          <div className="lifecycle-section-heading"><Package /><div><h2>Bien y diagnóstico</h2><p>Relaciona la evaluación con un bien registrado.</p></div></div>
          <div className="form-grid">
            <label className="field field-wide"><span>Bien evaluado *</span>
              <select value={assetId} onChange={(event) => setAssetId(event.target.value)}>
                <option value="">Seleccionar bien</option>
                {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.code} — {asset.draft.name}</option>)}
              </select>
            </label>
            <label className="field field-wide"><span>Descripción del diagnóstico *</span>
              <textarea rows={4} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Describe la falla, pruebas realizadas y condición encontrada." />
              <small>Mínimo 20 caracteres.</small>
            </label>
            <label className="field"><span>Causa probable</span><input value={probableCause} onChange={(event) => setProbableCause(event.target.value)} /></label>
            <label className="field"><span>Riesgo operativo</span>
              <select value={risk} onChange={(event) => setRisk(event.target.value)}>
                <option value="">Seleccionar</option><option>BAJO</option><option>MEDIO</option><option>ALTO</option><option>CRÍTICO</option>
              </select>
            </label>
            <label className="field field-wide"><span>Componentes afectados</span><input value={components} onChange={(event) => setComponents(event.target.value)} /></label>
          </div>

          <div className="lifecycle-section-heading"><WarningCircle /><div><h2>Evaluación de reparabilidad</h2><p>La baja solo se habilita para resultados técnicamente sustentados.</p></div></div>
          <div className="form-grid">
            <label className="field field-wide"><span>Resultado *</span>
              <select value={result} onChange={(event) => setResult(event.target.value as ReparabilityResult)}>
                <option value="REPARABLE">Reparable</option>
                <option value="NO_REPARABLE">No reparable</option>
                <option value="REPAIR_NOT_VIABLE">Reparación no viable</option>
              </select>
            </label>
            <label className="field"><span>Costo estimado de reparación (S/)</span><input type="number" min="0" value={repairCost} onChange={(event) => setRepairCost(Number(event.target.value))} /></label>
            <label className="field"><span>Valor actual estimado (S/)</span><input type="number" min="0" value={currentValue} onChange={(event) => setCurrentValue(Number(event.target.value))} /></label>
            <label className="field field-wide"><span>Justificación técnica *</span>
              <textarea rows={4} value={justification} onChange={(event) => setJustification(event.target.value)} placeholder="Explica por qué no es reparable o por qué la reparación no resulta viable." />
            </label>
          </div>

          <div className="lifecycle-section-heading"><Camera /><div><h2>Evidencias</h2><p>Adjunta fotografías, informe técnico o cotizaciones.</p></div></div>
          <label className="upload-box lifecycle-upload"><Camera size={30} /><span><strong>Seleccionar evidencias</strong><small>JPG, PNG o PDF. Las evidencias son obligatorias para derivar.</small></span>
            <input hidden type="file" multiple accept="image/*,.pdf" onChange={(event) => setEvidence(Array.from(event.target.files ?? []).map((file) => file.name))} />
          </label>
          {!!evidence.length && <ul className="selected-files-list">{evidence.map((name) => <li key={name}>{name}</li>)}</ul>}
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="form-actions">
            <button className="button button-secondary" type="submit"><FloppyDisk />Guardar diagnóstico</button>
            <button className="button button-primary" type="button" disabled={!canDerive || requestExists} onClick={() => persist(true)}>
              {requestExists ? "Solicitud de baja ya creada" : "Derivar a evaluación de baja"}
            </button>
          </div>
        </form>

        <aside className="data-panel eligibility-panel">
          <h2>Requisitos para derivar</h2>
          <p>Esta acción crea una solicitud pendiente. No da de baja el bien.</p>
          <ul>
            {[
              ["diagnosis", "Diagnóstico técnico completo"],
              ["result", "Resultado no reparable o no viable"],
              ["evidence", "Evidencias adjuntas"],
              ["justification", "Justificación técnica"],
            ].map(([key, label]) => (
              <li key={key} className={checklist[key as keyof typeof checklist] ? "is-complete" : ""}>
                <CheckCircle weight={checklist[key as keyof typeof checklist] ? "fill" : "regular"} />{label}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}
