import {
  ArrowLeft, ArrowRight, Check, CheckCircle, ClipboardText, CloudCheck, CloudSlash,
  DownloadSimple, FileArrowUp, FloppyDisk, Gift, HandCoins, LinkSimple,
  Package, Printer, QrCode, Trash, WarningCircle, Wrench,
} from "@phosphor-icons/react";
import { type ChangeEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  assignableOptions, assigneeTypeLabels, CONDITIONS, CRITICALITIES, emptyAssetEntryDraft,
  entryTypeLabels, locationTaxonomy, taxonomy, type AssetEntryDraft, type EntryType,
  type EvidenceItem, type RegisteredAsset,
} from "@/modules/assets/entryModel";
import {
  loadAssetEntryDraft, registerAsset, saveAssetEntryDraft,
} from "@/modules/assets/assetEntryRepository";
import { type EntryErrors, validateEntryStep } from "@/modules/assets/entryValidation";

const steps = ["Tipo de ingreso", "Datos del bien", "Clasificación", "Asignación", "Evidencias", "Revisión", "Código y QR"];
const entryTypes: Array<{ value: EntryType; title: string; description: string; icon: typeof Package }> = [
  { value: "purchase", title: "Compra", description: "Adquirido a un proveedor.", icon: Package },
  { value: "own_creation", title: "Creación propia", description: "Fabricado o ensamblado internamente.", icon: Wrench },
  { value: "donation", title: "Regalo o donación", description: "Recibido sin contraprestación.", icon: Gift },
  { value: "rental", title: "Alquiler", description: "Recibido mediante contrato temporal.", icon: HandCoins },
];

const stepCopy = [
  ["¿Cómo ingresó el bien?", "El origen determina los datos y documentos obligatorios."],
  ["Identifica el bien", "Registra sus características y una fotografía verificable."],
  ["Clasifica el bien", "Define su taxonomía y necesidades de mantenimiento."],
  ["Ubica y asigna", "Un bien solo puede tener un responsable vigente."],
  ["Verifica las evidencias", "Completa el expediente que sustenta el registro."],
  ["Revisa antes de registrar", "Confirma que la información coincide con el bien físico."],
  ["Registro completado", "El código y el acceso público ya están disponibles."],
];

function Field({ label, error, hint, required, children, wide }: {
  label: string; error?: string; hint?: string; required?: boolean; children: ReactNode; wide?: boolean;
}) {
  return (
    <label className={`field ${wide ? "field-wide" : ""} ${error ? "has-error" : ""}`}>
      <span>{label}{required && <b aria-hidden="true"> *</b>}</span>
      {children}
      {hint && !error && <small>{hint}</small>}
      {error && <small className="field-error"><WarningCircle size={15} />{error}</small>}
    </label>
  );
}

function fileToEvidence(file: File, category: EvidenceItem["category"]): Promise<EvidenceItem> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.onload = () => resolve({
      id: crypto.randomUUID(), name: file.name, category, mimeType: file.type, size: file.size,
      dataUrl: typeof reader.result === "string" ? reader.result : undefined,
    });
    reader.readAsDataURL(file);
  });
}

export function AssetEntryWizardPage() {
  const navigate = useNavigate();
  const [draft, setDraft] = useState<AssetEntryDraft>(emptyAssetEntryDraft);
  const [loaded, setLoaded] = useState(false);
  const [errors, setErrors] = useState<EntryErrors>({});
  const [saving, setSaving] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [registered, setRegistered] = useState<RegisteredAsset | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadAssetEntryDraft().then((saved) => {
      if (saved) setDraft({ ...emptyAssetEntryDraft, ...saved, evidence: saved.evidence ?? [] });
      setLoaded(true);
    });
  }, []);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", sync); };
  }, []);

  useEffect(() => {
    if (!loaded || registered) return;
    setSaving(true);
    const timer = window.setTimeout(() => {
      saveAssetEntryDraft(draft).finally(() => setSaving(false));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [draft, loaded, registered]);

  const setField = <K extends keyof AssetEntryDraft>(key: K, value: AssetEntryDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key as string]) return current;
      const next = { ...current }; delete next[key as string]; return next;
    });
  };

  const addFiles = async (event: ChangeEvent<HTMLInputElement>, category: EvidenceItem["category"]) => {
    const files = Array.from(event.target.files ?? []);
    const accepted = files.filter((file) => file.size <= 5 * 1024 * 1024);
    const evidence = await Promise.all(accepted.map((file) => fileToEvidence(file, category)));
    setField("evidence", [...draft.evidence, ...evidence]);
    event.target.value = "";
  };

  const next = async () => {
    const validation = validateEntryStep(draft.currentStep, draft);
    if (Object.keys(validation).length) {
      setErrors(validation);
      document.querySelector(".has-error")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setErrors({});
    if (draft.currentStep === 5) {
      setSubmitting(true);
      try {
        const result = await registerAsset({ ...draft, currentStep: 6 });
        setRegistered(result);
        setDraft((current) => ({ ...current, currentStep: 6 }));
      } finally { setSubmitting(false); }
      return;
    }
    setField("currentStep", Math.min(5, draft.currentStep + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const back = () => {
    setErrors({});
    setField("currentStep", Math.max(0, draft.currentStep - 1));
  };

  const downloadQr = () => {
    if (!registered) return;
    const anchor = document.createElement("a");
    anchor.href = registered.qrDataUrl; anchor.download = `${registered.code}-QR.png`; anchor.click();
  };

  const types = Object.keys(taxonomy) as Array<keyof typeof taxonomy>;
  const categories = draft.assetType ? Object.keys(taxonomy[draft.assetType as keyof typeof taxonomy] ?? {}) : [];
  const subcategories = draft.assetType && draft.category
    ? ((taxonomy[draft.assetType as keyof typeof taxonomy] as unknown as Record<string, readonly string[]>)[draft.category] ?? [])
    : [];
  const zones = Object.keys(locationTaxonomy) as Array<keyof typeof locationTaxonomy>;
  const buildings = draft.zone ? Object.keys(locationTaxonomy[draft.zone as keyof typeof locationTaxonomy] ?? {}) : [];
  const areas = draft.zone && draft.building
    ? Object.keys((locationTaxonomy[draft.zone as keyof typeof locationTaxonomy] as unknown as Record<string, Record<string, readonly string[]>>)[draft.building] ?? {})
    : [];
  const rooms = draft.zone && draft.building && draft.locationArea
    ? ((locationTaxonomy[draft.zone as keyof typeof locationTaxonomy] as unknown as Record<string, Record<string, readonly string[]>>)[draft.building]?.[draft.locationArea] ?? [])
    : [];
  const evidenceByCategory = useMemo(() => ({
    origin: draft.evidence.filter((item) => item.category === "origin"),
    photo: draft.evidence.filter((item) => item.category === "photo"),
    certificate: draft.evidence.filter((item) => item.category === "certificate"),
    manual: draft.evidence.filter((item) => item.category === "manual"),
    other: draft.evidence.filter((item) => item.category === "other"),
  }), [draft.evidence]);

  if (!loaded) return <div className="loading-panel">Recuperando borrador…</div>;

  const originFields = () => {
    if (draft.entryType === "purchase") return <>
      <Field label="Orden de compra" error={errors.purchaseOrder} required><input value={draft.purchaseOrder} onChange={(e) => setField("purchaseOrder", e.target.value)} placeholder="Ej. OC-2026-00128" /></Field>
      <Field label="Proveedor" error={errors.supplier} required><input value={draft.supplier} onChange={(e) => setField("supplier", e.target.value)} placeholder="Razón social" /></Field>
      <Field label="Comprobante" error={errors.voucherNumber} required><input value={draft.voucherNumber} onChange={(e) => setField("voucherNumber", e.target.value)} placeholder="Factura o boleta" /></Field>
      <Field label="Fecha de adquisición" error={errors.acquisitionDate} required><input type="date" value={draft.acquisitionDate} onChange={(e) => setField("acquisitionDate", e.target.value)} /></Field>
      <Field label="Costo" error={errors.cost} required><input type="number" min="0" step="0.01" value={draft.cost} onChange={(e) => setField("cost", e.target.value)} placeholder="0.00" /></Field>
      <Field label="Moneda"><select value={draft.currency} onChange={(e) => setField("currency", e.target.value as "PEN" | "USD")}><option value="PEN">PEN — Soles</option><option value="USD">USD — Dólares</option></select></Field>
    </>;
    if (draft.entryType === "own_creation") return <>
      <Field label="Área productora" error={errors.producingArea} required><input value={draft.producingArea} onChange={(e) => setField("producingArea", e.target.value)} /></Field>
      <Field label="Proyecto u orden interna" error={errors.internalOrder} required><input value={draft.internalOrder} onChange={(e) => setField("internalOrder", e.target.value)} /></Field>
      <Field label="Fecha de finalización" error={errors.completionDate} required><input type="date" value={draft.completionDate} onChange={(e) => setField("completionDate", e.target.value)} /></Field>
    </>;
    if (draft.entryType === "donation") return <>
      <Field label="Donante" error={errors.donor} required><input value={draft.donor} onChange={(e) => setField("donor", e.target.value)} /></Field>
      <Field label="Documento de donación" error={errors.donationDocument} required><input value={draft.donationDocument} onChange={(e) => setField("donationDocument", e.target.value)} /></Field>
      <Field label="Fecha de recepción" error={errors.receptionDate} required><input type="date" value={draft.receptionDate} onChange={(e) => setField("receptionDate", e.target.value)} /></Field>
    </>;
    return <>
      <Field label="Proveedor / arrendador" error={errors.supplier} required><input value={draft.supplier} onChange={(e) => setField("supplier", e.target.value)} /></Field>
      <Field label="Número de contrato" error={errors.contractNumber} required><input value={draft.contractNumber} onChange={(e) => setField("contractNumber", e.target.value)} /></Field>
      <Field label="Inicio del alquiler" error={errors.rentalStartDate} required><input type="date" value={draft.rentalStartDate} onChange={(e) => setField("rentalStartDate", e.target.value)} /></Field>
      <Field label="Término del alquiler" error={errors.rentalEndDate} required><input type="date" value={draft.rentalEndDate} onChange={(e) => setField("rentalEndDate", e.target.value)} /></Field>
    </>;
  };

  const upload = (category: EvidenceItem["category"], title: string, error?: string) => (
    <div className={`upload-block ${error ? "has-error" : ""}`}>
      <div><FileArrowUp size={23} /><span><strong>{title}</strong><small>PDF, JPG o PNG · máximo 5 MB</small></span></div>
      <label className="button button-secondary">Seleccionar archivo<input type="file" accept=".pdf,image/*" multiple onChange={(e) => addFiles(e, category)} /></label>
      {error && <small className="field-error"><WarningCircle size={15} />{error}</small>}
      {evidenceByCategory[category].map((file) => <div className="file-row" key={file.id}>
        <span><ClipboardText size={18} />{file.name}<small>{(file.size / 1024).toFixed(0)} KB</small></span>
        <button type="button" aria-label={`Eliminar ${file.name}`} onClick={() => setField("evidence", draft.evidence.filter((item) => item.id !== file.id))}><Trash size={17} /></button>
      </div>)}
    </div>
  );

  const stepContent = () => {
    if (draft.currentStep === 0) return <>
      <fieldset className="entry-type-grid"><legend className="sr-only">Tipo de ingreso</legend>
        {entryTypes.map(({ value, title, description, icon: Icon }) => <label className={`selection-card ${draft.entryType === value ? "is-selected" : ""}`} key={value}>
          <input type="radio" name="entryType" checked={draft.entryType === value} onChange={() => setField("entryType", value)} />
          <Icon size={28} weight="duotone" /><span><strong>{title}</strong><small>{description}</small></span>
        </label>)}
      </fieldset>
      <div className="conditional-fields"><h3>Información del origen</h3><div className="form-grid">{originFields()}</div></div>
      <div className="conditional-fields">{upload("origin", "Documento que sustenta el ingreso", errors.originDocument)}</div>
    </>;
    if (draft.currentStep === 1) return <div className="form-grid section-gap">
      <Field label="Nombre corto" error={errors.name} required><input value={draft.name} onChange={(e) => setField("name", e.target.value)} placeholder="Ej. Laptop Lenovo ThinkPad T14" /></Field>
      <Field label="Fecha efectiva de ingreso" error={errors.effectiveEntryDate} required><input type="date" value={draft.effectiveEntryDate} onChange={(e) => setField("effectiveEntryDate", e.target.value)} /></Field>
      <Field label="Descripción detallada" error={errors.description} required wide><textarea value={draft.description} onChange={(e) => setField("description", e.target.value)} rows={3} /></Field>
      <Field label="Marca"><input value={draft.brand} onChange={(e) => setField("brand", e.target.value)} /></Field>
      <Field label="Modelo"><input value={draft.model} onChange={(e) => setField("model", e.target.value)} /></Field>
      <Field label="Número de serie" error={errors.serialNumber} hint="Se verificará que no exista otro bien con el mismo número."><input value={draft.serialNumber} onChange={(e) => setField("serialNumber", e.target.value)} /></Field>
      <Field label="Color"><input value={draft.color} onChange={(e) => setField("color", e.target.value)} /></Field>
      <Field label="Año de fabricación" error={errors.manufactureYear}><input type="number" value={draft.manufactureYear} onChange={(e) => setField("manufactureYear", e.target.value)} /></Field>
      <Field label="Condición de ingreso"><select value={draft.condition} onChange={(e) => setField("condition", e.target.value as AssetEntryDraft["condition"])}>{CONDITIONS.map((x) => <option key={x}>{x}</option>)}</select></Field>
      <Field label="Observaciones" wide><textarea value={draft.observations} onChange={(e) => setField("observations", e.target.value)} rows={3} /></Field>
      <div className="field-wide">{upload("photo", "Fotografías del bien", errors.photo)}</div>
    </div>;
    if (draft.currentStep === 2) return <div className="section-gap">
      <label className="switch-row"><input type="checkbox" checked={draft.classificationPending} onChange={(e) => setField("classificationPending", e.target.checked)} /><span><strong>Clasificación por confirmar</strong><small>Úsalo solo cuando se requiera una validación técnica posterior.</small></span></label>
      {draft.classificationPending
        ? <div className="form-grid"><Field label="Justificación" error={errors.classificationPendingReason} required wide><textarea rows={3} value={draft.classificationPendingReason} onChange={(e) => setField("classificationPendingReason", e.target.value)} /></Field></div>
        : <div className="form-grid">
          <Field label="Tipo de bien" error={errors.assetType} required><select value={draft.assetType} onChange={(e) => { setField("assetType", e.target.value); setField("category", ""); setField("subcategory", ""); }}><option value="">Seleccionar</option>{types.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Categoría" error={errors.category} required><select value={draft.category} disabled={!draft.assetType} onChange={(e) => { setField("category", e.target.value); setField("subcategory", ""); }}><option value="">Seleccionar</option>{categories.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Subcategoría" error={errors.subcategory} required><select value={draft.subcategory} disabled={!draft.category} onChange={(e) => setField("subcategory", e.target.value)}><option value="">Seleccionar</option>{subcategories.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Especialidad técnica" error={errors.technicalSpecialty} required><select value={draft.technicalSpecialty} onChange={(e) => setField("technicalSpecialty", e.target.value)}><option value="">Seleccionar</option><option>Eléctrica</option><option>Mecánica</option><option>TI</option><option>Infraestructura</option><option>No aplica</option></select></Field>
        </div>}
      <div className="conditional-fields"><h3>Gestión del ciclo de vida</h3><div className="form-grid">
        <Field label="Criticidad"><select value={draft.criticality} onChange={(e) => setField("criticality", e.target.value as AssetEntryDraft["criticality"])}>{CRITICALITIES.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Vida útil estimada (años)" error={errors.usefulLifeYears}><input type="number" min="1" value={draft.usefulLifeYears} onChange={(e) => setField("usefulLifeYears", e.target.value)} /></Field>
        <label className="switch-row"><input type="checkbox" checked={draft.requiresMaintenance} onChange={(e) => setField("requiresMaintenance", e.target.checked)} /><span><strong>Requiere mantenimiento</strong><small>Activa la planificación preventiva.</small></span></label>
        <label className="switch-row"><input type="checkbox" checked={draft.requiresCertification} onChange={(e) => setField("requiresCertification", e.target.checked)} /><span><strong>Requiere certificación</strong><small>Controlará su vigencia documental.</small></span></label>
        {draft.requiresMaintenance && <Field label="Frecuencia preventiva (meses)" error={errors.preventiveFrequencyMonths} required><input type="number" min="1" value={draft.preventiveFrequencyMonths} onChange={(e) => setField("preventiveFrequencyMonths", e.target.value)} /></Field>}
      </div></div>
    </div>;
    if (draft.currentStep === 3) return <div className="section-gap">
      <label className="switch-row"><input type="checkbox" checked={draft.locationPending} onChange={(e) => setField("locationPending", e.target.checked)} /><span><strong>Ubicación por confirmar</strong><small>El bien quedará marcado como pendiente de ubicación.</small></span></label>
      {draft.locationPending ? <div className="form-grid"><Field label="Justificación" error={errors.locationPendingReason} required wide><textarea rows={3} value={draft.locationPendingReason} onChange={(e) => setField("locationPendingReason", e.target.value)} /></Field></div>
      : <div className="form-grid">
        <Field label="Zona" error={errors.zone} required><select value={draft.zone} onChange={(e) => { setField("zone", e.target.value); setField("building", ""); setField("locationArea", ""); setField("room", ""); }}><option value="">Seleccionar</option>{zones.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Edificio" error={errors.building} required><select value={draft.building} disabled={!draft.zone} onChange={(e) => { setField("building", e.target.value); setField("locationArea", ""); setField("room", ""); }}><option value="">Seleccionar</option>{buildings.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Área" error={errors.locationArea} required><select value={draft.locationArea} disabled={!draft.building} onChange={(e) => { setField("locationArea", e.target.value); setField("room", ""); }}><option value="">Seleccionar</option>{areas.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Ambiente" error={errors.room} required><select value={draft.room} disabled={!draft.locationArea} onChange={(e) => setField("room", e.target.value)}><option value="">Seleccionar</option>{rooms.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Ubicación específica" wide><input value={draft.specificLocation} onChange={(e) => setField("specificLocation", e.target.value)} placeholder="Ej. Estante B, nivel 2" /></Field>
      </div>}
      <div className="conditional-fields"><h3>Responsable inicial</h3>
        <div className="segmented-control">{(Object.keys(assignableOptions) as Array<keyof typeof assignableOptions>).map((type) => <button type="button" className={draft.assigneeType === type ? "is-active" : ""} onClick={() => { setField("assigneeType", type); setField("assigneeId", ""); setField("assigneeName", ""); }} key={type}>{assigneeTypeLabels[type]}</button>)}</div>
        <div className="form-grid">
          <Field label="Responsable asignable" error={errors.assigneeId} required wide><select value={draft.assigneeId} onChange={(e) => { const option = assignableOptions[draft.assigneeType].find((x) => x.id === e.target.value); setField("assigneeId", e.target.value); setField("assigneeName", option?.name ?? ""); }}><option value="">Seleccionar</option>{assignableOptions[draft.assigneeType].map((x) => <option value={x.id} key={x.id}>{x.name} — {x.detail}</option>)}</select></Field>
          <Field label="Fecha de asignación" error={errors.assignmentDate} required><input type="date" value={draft.assignmentDate} onChange={(e) => setField("assignmentDate", e.target.value)} /></Field>
          <Field label="Centro de costo"><input value={draft.costCenter} onChange={(e) => setField("costCenter", e.target.value)} /></Field>
          <Field label="Motivo" error={errors.assignmentReason} required wide><input value={draft.assignmentReason} onChange={(e) => setField("assignmentReason", e.target.value)} placeholder="Ej. Asignación inicial por ingreso" /></Field>
          <Field label="Observaciones de asignación" wide><textarea rows={3} value={draft.assignmentObservations} onChange={(e) => setField("assignmentObservations", e.target.value)} /></Field>
        </div>
      </div>
    </div>;
    if (draft.currentStep === 4) return <div className="evidence-grid section-gap">
      {upload("origin", "Documento de origen", errors.originDocument)}
      {upload("photo", "Fotografías", errors.photo)}
      {upload("certificate", "Certificados")}
      {upload("manual", "Manuales")}
      {upload("other", "Otros documentos")}
      <aside className="evidence-check"><h3>Expediente</h3><p className={evidenceByCategory.origin.length ? "done" : ""}><CheckCircle /> Documento de origen</p><p className={evidenceByCategory.photo.length ? "done" : ""}><CheckCircle /> Fotografía del bien</p><p className={!draft.requiresCertification || evidenceByCategory.certificate.length ? "done" : ""}><CheckCircle /> Certificación, si aplica</p></aside>
    </div>;
    if (draft.currentStep === 5) return <div className="review-stack section-gap">
      <Review title="Origen" onEdit={() => setField("currentStep", 0)} rows={[["Tipo", entryTypeLabels[draft.entryType]], ["Documento", evidenceByCategory.origin[0]?.name ?? "—"], ["Fecha", draft.acquisitionDate || draft.completionDate || draft.receptionDate || draft.rentalStartDate]]} />
      <Review title="Bien" onEdit={() => setField("currentStep", 1)} rows={[["Nombre", draft.name], ["Marca / modelo", `${draft.brand || "—"} / ${draft.model || "—"}`], ["Serie", draft.serialNumber || "No consignada"], ["Condición", draft.condition]]} />
      <Review title="Clasificación" onEdit={() => setField("currentStep", 2)} rows={[["Taxonomía", draft.classificationPending ? "Por confirmar" : `${draft.assetType} / ${draft.category} / ${draft.subcategory}`], ["Criticidad", draft.criticality], ["Mantenimiento", draft.requiresMaintenance ? `Cada ${draft.preventiveFrequencyMonths} meses` : "No requerido"]]} />
      <Review title="Ubicación y responsable" onEdit={() => setField("currentStep", 3)} rows={[["Ubicación", draft.locationPending ? "Por confirmar" : `${draft.zone} / ${draft.building} / ${draft.locationArea} / ${draft.room}`], ["Responsable", draft.assigneeName], ["Fecha", draft.assignmentDate]]} />
      <Review title="Evidencias" onEdit={() => setField("currentStep", 4)} rows={[["Archivos", `${draft.evidence.length} adjunto(s)`], ["Fotografías", `${evidenceByCategory.photo.length}`]]} />
      <div className="confirmation-box">
        <label className={errors.confirmInspected ? "has-error" : ""}><input type="checkbox" checked={draft.confirmInspected} onChange={(e) => setField("confirmInspected", e.target.checked)} /><span>Confirmo que verifiqué el bien físico y que sus datos son correctos.{errors.confirmInspected && <small className="field-error">{errors.confirmInspected}</small>}</span></label>
        <label className={errors.confirmAssignment ? "has-error" : ""}><input type="checkbox" checked={draft.confirmAssignment} onChange={(e) => setField("confirmAssignment", e.target.checked)} /><span>Confirmo que la ubicación y el responsable corresponden a la asignación inicial.{errors.confirmAssignment && <small className="field-error">{errors.confirmAssignment}</small>}</span></label>
      </div>
    </div>;
    if (!registered) return <div className="loading-panel">Generando código seguro y QR…</div>;
    return <div className="success-panel">
      <CheckCircle size={56} weight="fill" /><p className="breadcrumb">REGISTRO COMPLETADO</p><h2>{registered.code}</h2>
      <p>El bien quedó registrado, asignado y listo para su evaluación operativa.</p>
      <div className="status-cluster"><span className="status status-success">Registrado</span><span className="status status-neutral">No evaluado</span><span className={`status ${registered.assignmentStatus === "Asignado" ? "status-success" : "status-warning"}`}>{registered.assignmentStatus}</span></div>
      <div className="qr-card"><img src={registered.qrDataUrl} alt={`QR público del bien ${registered.code}`} /><div><h3>Etiqueta del bien</h3><strong>{draft.name}</strong><small>{registered.code}</small><p>El QR contiene una URL pública con token aleatorio. No expone identificadores internos ni datos personales.</p></div></div>
      <div className="success-actions">
        <button className="button button-secondary" type="button" onClick={downloadQr}><DownloadSimple /> Descargar PNG</button>
        <button className="button button-secondary" type="button" onClick={() => navigator.clipboard.writeText(registered.publicUrl)}><LinkSimple /> Copiar enlace</button>
        <button className="button button-secondary" type="button" onClick={() => window.print()}><Printer /> Imprimir etiqueta</button>
      </div>
      <div className="form-actions"><button className="button button-secondary" type="button" onClick={() => navigate("/bienes/entradas")}>Volver a entradas</button><button className="button button-primary" type="button" onClick={() => { setRegistered(null); setDraft({ ...emptyAssetEntryDraft }); }}>Registrar otro bien</button></div>
    </div>;
  };

  return <section>
    <div className="wizard-heading"><Link to="/bienes/entradas" className="back-link"><ArrowLeft size={18} /> Volver a entradas</Link><div>
      <div><p className="breadcrumb">Registro de bien</p><h1>Nuevo ingreso</h1></div>
      <span className={`save-state ${!online ? "is-offline" : ""}`}>{online ? <CloudCheck size={17} /> : <CloudSlash size={17} />}{saving ? "Guardando…" : online ? "Borrador guardado" : "Guardado en este dispositivo"}</span>
    </div></div>
    <ol className="stepper" aria-label="Progreso del registro">{steps.map((step, index) => <li key={step} className={index === draft.currentStep ? "is-current" : index < draft.currentStep ? "is-complete" : ""}><span>{index < draft.currentStep ? <Check size={16} weight="bold" /> : index + 1}</span><small>{step}</small></li>)}</ol>
    <div className="wizard-layout">
      <form className="form-panel" onSubmit={(e) => { e.preventDefault(); next(); }}>
        <div className="form-section-heading"><span>Paso {draft.currentStep + 1} de 7</span><h2>{stepCopy[draft.currentStep][0]}</h2><p>{stepCopy[draft.currentStep][1]}</p></div>
        {stepContent()}
        {draft.currentStep < 6 && <div className="form-actions">
          {draft.currentStep > 0 ? <button className="button button-secondary" type="button" onClick={back}><ArrowLeft /> Anterior</button> : <button className="button button-secondary" type="button" onClick={() => navigate("/bienes/entradas")}><FloppyDisk /> Guardar y salir</button>}
          <button className="button button-primary" type="submit" disabled={submitting}>{submitting ? "Registrando…" : draft.currentStep === 5 ? <><QrCode /> Registrar y generar QR</> : <>Continuar <ArrowRight /></>}</button>
        </div>}
      </form>
      {draft.currentStep < 6 && <aside className="help-panel"><h2>Control del registro</h2><p>Los campos marcados con * son obligatorios. El borrador se conserva incluso sin conexión.</p><ul><li><Check size={16} /> Validación por cada etapa</li><li><Check size={16} /> Un responsable vigente</li><li><Check size={16} /> Evidencia mínima obligatoria</li></ul><p className="help-note">El código único y el QR solo se generan después de confirmar el registro en el paso 6.</p></aside>}
    </div>
  </section>;
}

function Review({ title, rows, onEdit }: { title: string; rows: string[][]; onEdit: () => void }) {
  return <article className="review-card"><header><h3>{title}</h3><button type="button" onClick={onEdit}>Editar</button></header><dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "—"}</dd></div>)}</dl></article>;
}
