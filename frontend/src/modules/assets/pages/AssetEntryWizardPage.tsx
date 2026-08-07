import {
  ArrowLeft, ArrowRight, Check, CheckCircle, ClipboardText, CloudCheck, CloudSlash,
  DownloadSimple, FileArrowUp, FloppyDisk, Gift, HandCoins, LinkSimple,
  MapPin, Package, Printer, QrCode, Trash, WarningCircle, Wrench,
} from "@phosphor-icons/react";
import axios from "axios";
import { type ChangeEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  CONDITIONS, CRITICALITIES, emptyAssetEntryDraft,
  entryTypeLabels, type AssetEntryDraft, type EntryType,
  type EvidenceItem, type RegisteredAsset,
} from "@/modules/assets/entryModel";
import {
  loadAssetEntryDraft, registerAsset, saveAssetEntryDraft,
} from "@/modules/assets/assetEntryRepository";
import { type EntryErrors, validateEntryStep } from "@/modules/assets/entryValidation";
import { LocationMarkerPicker } from "@/modules/assets/components/LocationMarkerPicker";
import { useLocations } from "@/modules/assets/locationMapQueries";
import { TaxonomyPicker } from "@/modules/taxonomy/components/TaxonomyPicker";
import type { TaxonomyOption } from "@/modules/taxonomy/types";

const steps = ["Tipo de ingreso", "Datos del bien", "Clasificación", "Ubicación inicial", "Evidencias", "Revisión", "Código y QR"];
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
  ["Define su ubicación inicial", "Indica dónde quedará almacenado o marca la ubicación como pendiente."],
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
  const locationsQuery = useLocations();
  const [draft, setDraft] = useState<AssetEntryDraft>(emptyAssetEntryDraft);
  const [loaded, setLoaded] = useState(false);
  const [errors, setErrors] = useState<EntryErrors>({});
  const [saving, setSaving] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [registered, setRegistered] = useState<RegisteredAsset | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    loadAssetEntryDraft().then((saved) => {
      if (saved) setDraft({ ...emptyAssetEntryDraft, ...saved, currentStep: Math.min(saved.currentStep, 5), evidence: saved.evidence ?? [] });
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

  useEffect(() => {
    const locations = locationsQuery.data ?? [];
    if (draft.locationPending || !draft.room || !locations.length) return;
    const match = locations.find((item) => item.id === draft.locationId) ?? locations.find(
      (item) => item.zone === draft.zone && item.building === draft.building &&
        item.area === draft.locationArea && item.room === draft.room,
    );
    if (!match) return;
    const nextMapId = match.activeMap?.id ?? "";
    if (draft.locationId === match.id && draft.locationMapId === nextMapId) return;
    setDraft((current) => ({
      ...current,
      locationId: match.id,
      locationMapId: nextMapId,
      locationMarkerX: current.locationMapId === nextMapId ? current.locationMarkerX : null,
      locationMarkerY: current.locationMapId === nextMapId ? current.locationMarkerY : null,
    }));
  }, [
    draft.building,
    draft.locationArea,
    draft.locationId,
    draft.locationMapId,
    draft.locationPending,
    draft.room,
    draft.zone,
    locationsQuery.data,
  ]);

  const setField = <K extends keyof AssetEntryDraft>(key: K, value: AssetEntryDraft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key as string]) return current;
      const next = { ...current }; delete next[key as string]; return next;
    });
  };

  const addFiles = async (event: ChangeEvent<HTMLInputElement>, category: EvidenceItem["category"]) => {
    const files = Array.from(event.target.files ?? []);
    const maxSize = category === "photo" ? 8 * 1024 * 1024 : 5 * 1024 * 1024;
    const accepted = files.filter((file) =>
      file.size <= maxSize && (
        category !== "photo" || ["image/jpeg", "image/png", "image/webp"].includes(file.type)
      ),
    );
    if (files.length && !accepted.length) {
      setErrors((current) => ({
        ...current,
        [category === "photo" ? "photo" : category]: category === "photo"
          ? "Usa una imagen JPG, PNG o WEBP de hasta 8 MB."
          : "El archivo supera el máximo permitido de 5 MB.",
      }));
      event.target.value = "";
      return;
    }
    if (category === "photo" && accepted[0]) {
      try {
        const bitmap = await createImageBitmap(accepted[0]);
        const validDimensions = bitmap.width >= 320 && bitmap.height >= 240;
        bitmap.close();
        if (!validDimensions) {
          setErrors((current) => ({ ...current, photo: "La fotografía debe tener al menos 320 × 240 px." }));
          event.target.value = "";
          return;
        }
      } catch {
        setErrors((current) => ({ ...current, photo: "No se pudo leer la imagen. Selecciona otro archivo." }));
        event.target.value = "";
        return;
      }
    }
    const evidence = await Promise.all(accepted.map((file) => fileToEvidence(file, category)));
    setField(
      "evidence",
      category === "photo"
        ? [...draft.evidence.filter((item) => item.category !== "photo"), ...evidence.slice(0, 1)]
        : [...draft.evidence, ...evidence],
    );
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
      setSubmitError("");
      try {
        const result = await registerAsset({ ...draft, currentStep: 6 });
        setRegistered(result);
        setDraft((current) => ({ ...current, currentStep: 6 }));
      } catch (error) {
        const responseData = axios.isAxiosError(error) && error.response?.data &&
          typeof error.response.data === "object"
          ? error.response.data as Record<string, unknown>
          : null;
        const taxonomyConflict =
          axios.isAxiosError(error) &&
          (error.response?.status === 409 ||
            (error.response?.status === 400 && Boolean(responseData && "taxonomy_id" in responseData)));
        if (taxonomyConflict) {
          setDraft((current) => ({ ...current, currentStep: 2 }));
          setErrors({ taxonomyId: "La taxonomía cambió o ya no permite nuevos códigos. Selecciónala nuevamente." });
          setSubmitError("La clasificación debe revisarse antes de registrar el bien.");
        } else if (
          axios.isAxiosError(error) && error.response?.status === 400 &&
          responseData && ["location_id", "location_map_id", "location_marker"].some((key) => key in responseData)
        ) {
          setDraft((current) => ({ ...current, currentStep: 3 }));
          setErrors({ locationMarker: "La imagen del ambiente cambió o falta ubicar el bien. Revisa el marcador." });
          setSubmitError("La ubicación visual debe revisarse antes de registrar el bien.");
        } else {
          const detail = responseData
            ? Object.entries(responseData)
              .map(([field, value]) => `${field}: ${Array.isArray(value) ? value.join(" ") : String(value)}`)
              .join(" · ")
            : "";
          setSubmitError(detail || "No se pudo registrar el bien. Verifica que el backend esté disponible e inténtalo nuevamente.");
        }
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
    anchor.href = registered.qrDataUrl; anchor.download = `${registered.fmCode ?? registered.code}-QR.png`; anchor.click();
  };

  const applyTaxonomy = (item: TaxonomyOption) => {
    setDraft((current) => ({
      ...current,
      taxonomyId: item.id,
      taxonomyPrefix: item.prefix,
      taxonomyVersion: item.sourceVersion,
      taxonomySnapshot: {
        name: item.name,
        assetType: item.assetType,
        category: item.category,
        subcategory: item.subcategory,
        specialty: item.specialty,
      },
      assetType: item.assetType,
      category: item.category,
      subcategory: item.subcategory,
      technicalSpecialty: item.specialty,
      criticality: item.defaultCriticality,
      usefulLifeYears: item.usefulLifeYears?.toString() ?? "",
      preventiveFrequencyMonths: item.preventiveFrequencyMonths?.toString() ?? "",
      requiresMaintenance: item.requiresMaintenance,
      requiresCertification: item.requiresCertification,
    }));
    setErrors((current) => {
      const next = { ...current };
      ["taxonomyId", "assetType", "category", "subcategory", "technicalSpecialty"].forEach(
        (key) => delete next[key],
      );
      return next;
    });
  };

  const toggleClassificationPending = (pending: boolean) => {
    setDraft((current) => ({
      ...current,
      classificationPending: pending,
      taxonomyId: pending ? "" : current.taxonomyId,
      taxonomyPrefix: pending ? "" : current.taxonomyPrefix,
      taxonomyVersion: pending ? "" : current.taxonomyVersion,
      taxonomySnapshot: pending ? null : current.taxonomySnapshot,
      assetType: pending ? "" : current.assetType,
      category: pending ? "" : current.category,
      subcategory: pending ? "" : current.subcategory,
      technicalSpecialty: pending ? "" : current.technicalSpecialty,
    }));
  };
  const locations = locationsQuery.data ?? [];
  const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es"));
  const zones = unique(locations.map((item) => item.zone));
  const buildings = unique(locations.filter((item) => item.zone === draft.zone).map((item) => item.building));
  const areas = unique(locations.filter((item) => item.zone === draft.zone && item.building === draft.building).map((item) => item.area));
  const roomOptions = locations
    .filter((item) => item.zone === draft.zone && item.building === draft.building && item.area === draft.locationArea)
    .sort((a, b) => a.room.localeCompare(b.room, "es") || a.locationCode.localeCompare(b.locationCode, "es"));
  const selectedLocation = locations.find((item) => item.id === draft.locationId) ?? locations.find(
    (item) => item.zone === draft.zone && item.building === draft.building &&
      item.area === draft.locationArea && item.room === draft.room,
  ) ?? null;
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
      <Field label="Código de factura o boleta" error={errors.voucherNumber}><input value={draft.voucherNumber} onChange={(e) => setField("voucherNumber", e.target.value)} placeholder="Opcional" /></Field>
      <Field label="Centro de costo"><input value={draft.costCenter} onChange={(e) => setField("costCenter", e.target.value)} placeholder="Ej. CC-4201" /></Field>
      <Field label="Fecha de adquisición" error={errors.acquisitionDate} required><input type="date" value={draft.acquisitionDate} onChange={(e) => setField("acquisitionDate", e.target.value)} /></Field>
      <Field label="Costo" error={errors.cost} required><input type="number" min="0" step="0.01" value={draft.cost} onChange={(e) => setField("cost", e.target.value)} placeholder="0.00" /></Field>
      <Field label="Moneda"><select value={draft.currency} onChange={(e) => setField("currency", e.target.value as "PEN" | "USD")}><option value="PEN">PEN — Soles</option><option value="USD">USD — Dólares</option></select></Field>
    </>;
    if (draft.entryType === "own_creation") return <>
      <Field label="?rea productora" error={errors.producingArea} required><input value={draft.producingArea} onChange={(e) => setField("producingArea", e.target.value)} /></Field>
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
      <div><FileArrowUp size={23} /><span><strong>{title}</strong><small>{category === "photo" ? "JPG, PNG o WEBP · mínimo 320 x 240 px · máximo 8 MB" : "PDF, JPG o PNG · máximo 5 MB"}</small></span></div>
      <label className="button button-secondary">{category === "photo" && evidenceByCategory.photo.length ? "Reemplazar fotografía" : "Seleccionar archivo"}<input type="file" accept={category === "photo" ? "image/jpeg,image/png,image/webp" : ".pdf,image/*"} multiple={category !== "photo"} onChange={(e) => addFiles(e, category)} /></label>
      {error && <small className="field-error"><WarningCircle size={15} />{error}</small>}
      {category === "photo" && evidenceByCategory.photo[0]?.dataUrl && <div className="official-photo-preview"><img src={evidenceByCategory.photo[0].dataUrl} alt="Vista previa del bien" /><span>Esta fotografía identificará el bien en su ficha QR pública.</span></div>}
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
      <div className="conditional-fields">{upload("origin", "Documento que sustenta el ingreso (opcional)", errors.originDocument)}</div>
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
      <div className="field-wide">{upload("photo", "Fotografía oficial del bien", errors.photo)}</div>
    </div>;
    if (draft.currentStep === 2) return <div className="section-gap">
      <label className="switch-row"><input type="checkbox" checked={draft.classificationPending} onChange={(e) => toggleClassificationPending(e.target.checked)} /><span><strong>Clasificación por confirmar</strong><small>Úsalo solo cuando se requiera una validación técnica posterior.</small></span></label>
      {draft.classificationPending
        ? <div className="form-grid"><Field label="Justificación" error={errors.classificationPendingReason} required wide><textarea rows={3} value={draft.classificationPendingReason} onChange={(e) => setField("classificationPendingReason", e.target.value)} /></Field></div>
        : <TaxonomyPicker selectedId={draft.taxonomyId} onSelect={applyTaxonomy} error={errors.taxonomyId} />}
      <div className="conditional-fields"><h3>Gestión del ciclo de vida</h3><div className="form-grid">
        <Field label="Criticidad"><select value={draft.criticality} onChange={(e) => setField("criticality", e.target.value as AssetEntryDraft["criticality"])}>{CRITICALITIES.map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Vida útil estimada (años)" error={errors.usefulLifeYears}><input type="number" min="1" value={draft.usefulLifeYears} onChange={(e) => setField("usefulLifeYears", e.target.value)} /></Field>
        <label className="switch-row"><input type="checkbox" checked={draft.requiresMaintenance} onChange={(e) => setField("requiresMaintenance", e.target.checked)} /><span><strong>Requiere mantenimiento</strong><small>Activa la planificación preventiva.</small></span></label>
        <label className="switch-row"><input type="checkbox" checked={draft.requiresCertification} onChange={(e) => setField("requiresCertification", e.target.checked)} /><span><strong>Requiere certificación</strong><small>Controlará su vigencia documental.</small></span></label>
        {draft.requiresMaintenance && <Field label="Frecuencia preventiva (meses)" error={errors.preventiveFrequencyMonths} required><input type="number" min="1" value={draft.preventiveFrequencyMonths} onChange={(e) => setField("preventiveFrequencyMonths", e.target.value)} /></Field>}
      </div></div>
    </div>;
    if (draft.currentStep === 3) return <div className="section-gap">
      <aside className="privacy-notice"><Package size={22} /><p><strong>El bien quedará sin asignar</strong><span>Esta ubicación solo indica dónde se almacena inicialmente. El responsable y el acta de entrega se gestionan después desde el módulo Asignaciones.</span></p></aside>
      <label className="switch-row"><input type="checkbox" checked={draft.locationPending} onChange={(e) => setDraft((current) => ({ ...current, locationPending: e.target.checked, locationId: "", locationMapId: "", locationMarkerX: null, locationMarkerY: null }))} /><span><strong>Ubicación por confirmar</strong><small>El bien quedará marcado como pendiente de ubicación.</small></span></label>
      {draft.locationPending ? <div className="form-grid"><Field label="Justificación" error={errors.locationPendingReason} required wide><textarea rows={3} value={draft.locationPendingReason} onChange={(e) => setField("locationPendingReason", e.target.value)} /></Field></div>
      : <>
        {locationsQuery.isPending ? <div className="loading-panel">Cargando ubicaciones oficiales…</div>
        : locationsQuery.isError ? <div className="location-map-load-error" role="alert"><WarningCircle /><span>No se pudo cargar el catálogo de ubicaciones.</span><button type="button" onClick={() => locationsQuery.refetch()}>Reintentar</button></div>
        : <div className="form-grid">
          <Field label="Zona" error={errors.zone} required><select value={draft.zone} onChange={(e) => setDraft((current) => ({ ...current, zone: e.target.value, building: "", locationArea: "", room: "", locationId: "", locationMapId: "", locationMarkerX: null, locationMarkerY: null }))}><option value="">Seleccionar</option>{zones.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Edificio" error={errors.building} required><select value={draft.building} disabled={!draft.zone} onChange={(e) => setDraft((current) => ({ ...current, building: e.target.value, locationArea: "", room: "", locationId: "", locationMapId: "", locationMarkerX: null, locationMarkerY: null }))}><option value="">Seleccionar</option>{buildings.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="?rea" error={errors.locationArea} required><select value={draft.locationArea} disabled={!draft.building} onChange={(e) => setDraft((current) => ({ ...current, locationArea: e.target.value, room: "", locationId: "", locationMapId: "", locationMarkerX: null, locationMarkerY: null }))}><option value="">Seleccionar</option>{areas.map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Ambiente" error={errors.room} required><select value={draft.locationId} disabled={!draft.locationArea} onChange={(e) => {
            const match = roomOptions.find((item) => item.id === e.target.value);
            setDraft((current) => ({ ...current, room: match?.room ?? "", locationId: match?.id ?? "", locationMapId: match?.activeMap?.id ?? "", locationMarkerX: null, locationMarkerY: null }));
          }}><option value="">Seleccionar</option>{roomOptions.map((item) => <option key={item.id} value={item.id}>{item.locationCode ? `${item.locationCode} · ` : ""}{item.room}{item.requiresReview ? " · Revisar" : ""}</option>)}</select></Field>
          <Field label="Ubicación específica" wide><input value={draft.specificLocation} onChange={(e) => setField("specificLocation", e.target.value)} placeholder="Ej. Estante B, nivel 2" /></Field>
        </div>}
        {selectedLocation?.activeMap ? <LocationMarkerPicker
          locationName={selectedLocation.displayName}
          locationMap={selectedLocation.activeMap}
          markerX={draft.locationMarkerX}
          markerY={draft.locationMarkerY}
          error={errors.locationMarker}
          onChange={(x, y) => {
            setDraft((current) => ({ ...current, locationMarkerX: x, locationMarkerY: y }));
            setErrors((current) => { const nextErrors = { ...current }; delete nextErrors.locationMarker; return nextErrors; });
          }}
        /> : selectedLocation ? <aside className="location-map-unavailable"><MapPin weight="duotone" /><p><strong>Este ambiente aún no tiene imagen referencial.</strong><span>Puedes registrar la ubicación textual. Un administrador podrá agregar la imagen desde Administración.</span></p><Link to="/administracion/mapas-ambientes">Gestionar imágenes</Link></aside> : null}
      </>}
    </div>;
    if (draft.currentStep === 4) return <div className="evidence-grid section-gap">
      {upload("origin", "Documento sustentatorio (opcional)", errors.originDocument)}
      {upload("photo", "Fotografía oficial", errors.photo)}
      {upload("certificate", "Certificados")}
      {upload("manual", "Manuales")}
      {upload("other", "Otros documentos")}
      <aside className="evidence-check"><h3>Expediente</h3><p className={evidenceByCategory.origin.length ? "done" : ""}><CheckCircle /> Documento de origen</p><p className={evidenceByCategory.photo.length ? "done" : ""}><CheckCircle /> Fotografía del bien</p><p className={!draft.requiresCertification || evidenceByCategory.certificate.length ? "done" : ""}><CheckCircle /> Certificación, si aplica</p></aside>
    </div>;
    if (draft.currentStep === 5) return <div className="review-stack section-gap">
      <Review title="Origen" onEdit={() => setField("currentStep", 0)} rows={[["Tipo", entryTypeLabels[draft.entryType]], ["Documento", evidenceByCategory.origin[0]?.name ?? "—"], ["Fecha", draft.acquisitionDate || draft.completionDate || draft.receptionDate || draft.rentalStartDate]]} />
      <Review title="Bien" onEdit={() => setField("currentStep", 1)} rows={[["Nombre", draft.name], ["Marca / modelo", `${draft.brand || "—"} / ${draft.model || "—"}`], ["Serie", draft.serialNumber || "No consignada"], ["Condición", draft.condition]]} />
      <Review title="Clasificación" onEdit={() => setField("currentStep", 2)} rows={[["Taxonomía", draft.classificationPending ? "Por confirmar" : `${draft.taxonomyPrefix} — ${draft.taxonomySnapshot?.name ?? draft.subcategory}`], ["Jerarquía", draft.classificationPending ? "Pendiente" : `${draft.assetType} / ${draft.category} / ${draft.subcategory}`], ["Criticidad", draft.criticality], ["Mantenimiento", draft.requiresMaintenance ? `Cada ${draft.preventiveFrequencyMonths} meses` : "No requerido"]]} />
      <Review title="Ubicación inicial" onEdit={() => setField("currentStep", 3)} rows={[["Almacenamiento", draft.locationPending ? "Por confirmar" : `${draft.zone} / ${draft.building} / ${draft.locationArea} / ${draft.room}`], ["Referencia visual", draft.locationPending ? "Pendiente" : draft.locationMapId ? (draft.locationMarkerX !== null ? "Marcador definido" : "Falta marcador") : "Sin imagen disponible"], ["Estado de asignación", "Sin asignar"], ["Siguiente acción", "Gestionar desde Asignaciones"]]}/>
      <Review title="Evidencias" onEdit={() => setField("currentStep", 4)} rows={[["Archivos", `${draft.evidence.length} adjunto(s)`], ["Fotografías", `${evidenceByCategory.photo.length}`]]} />
      <div className="confirmation-box">
        <label className={errors.confirmInspected ? "has-error" : ""}><input type="checkbox" checked={draft.confirmInspected} onChange={(e) => setField("confirmInspected", e.target.checked)} /><span>Confirmo que verifiqué el bien físico y que sus datos son correctos.{errors.confirmInspected && <small className="field-error">{errors.confirmInspected}</small>}</span></label>
        <label className={errors.confirmAssignment ? "has-error" : ""}><input type="checkbox" checked={draft.confirmAssignment} onChange={(e) => setField("confirmAssignment", e.target.checked)} /><span>Confirmo que la ubicación indicada corresponde al almacenamiento inicial del bien y que aún no tiene responsable asignado.{errors.confirmAssignment && <small className="field-error">{errors.confirmAssignment}</small>}</span></label>
      </div>
    </div>;
    if (!registered) return <div className="loading-panel">Generando código seguro y QR…</div>;
    return <div className="success-panel">
      <div className="success-hero"><CheckCircle size={46} weight="fill" /><h2>Bien registrado correctamente</h2><p>El activo ingresó al sistema de gestión y se generó su identificador único.</p></div>
      <div className="asset-result-stats"><div><small>Código FM</small><strong>{registered.fmCode ?? "Pendiente"}</strong></div><div><small>Identificador técnico</small><strong>{registered.code}</strong></div><div><small>Estado administrativo</small><span className="status status-success">Registrado</span></div><div><small>Asignación</small><strong>{registered.assignmentStatus}</strong></div></div>
      <section className="asset-credentials"><h3>Credenciales del activo</h3><div className="qr-card"><div className="qr-visual"><img src={registered.qrDataUrl} alt={`QR público del bien ${registered.fmCode ?? registered.code}`} /><small>El QR no contiene información personal ni identificadores internos sensibles.</small></div><div className="label-preview"><small>Vista previa de etiqueta</small><div><span>FM INCALPACA</span><strong>{registered.fmCode ?? registered.code}</strong><p>{draft.name}</p><small>{registered.code}</small></div><p>El código FM identifica el bien en operación; el identificador técnico preserva la trazabilidad interna.</p></div></div></section>
      <div className="success-actions">
        <button className="button button-secondary" type="button" onClick={downloadQr}><DownloadSimple /> Descargar PNG</button>
        <button className="button button-secondary" type="button" onClick={() => navigator.clipboard.writeText(registered.publicUrl)}><LinkSimple /> Copiar enlace</button>
        <button className="button button-secondary" type="button" onClick={() => window.print()}><Printer /> Imprimir etiqueta</button>
      </div>
      <div className="form-actions"><button className="button button-secondary" type="button" onClick={() => navigate("/bienes/entradas")}>Volver a entradas</button><button className="button button-primary" type="button" onClick={() => { setRegistered(null); setDraft({ ...emptyAssetEntryDraft }); }}>Registrar otro bien</button></div>
    </div>;
  };

  return <section className={`asset-wizard ${registered ? "is-registered" : ""}`}>
    <div className="wizard-heading"><Link to="/bienes/entradas" className="back-link"><ArrowLeft size={18} /> Volver a entradas</Link><div>
      <div><p className="breadcrumb">Registro de bien</p><h1>Nuevo ingreso</h1></div>
      <span className={`save-state ${!online ? "is-offline" : ""}`}>{online ? <CloudCheck size={17} /> : <CloudSlash size={17} />}{saving ? "Guardando…" : online ? "Borrador guardado" : "Guardado en este dispositivo"}</span>
    </div></div>
    <ol className="stepper" aria-label="Progreso del registro">{steps.map((step, index) => <li key={step} className={index === draft.currentStep ? "is-current" : index < draft.currentStep ? "is-complete" : ""}><span>{index < draft.currentStep ? <Check size={16} weight="bold" /> : index + 1}</span><small>{step}</small></li>)}</ol>
    <div className="wizard-layout">
      <form className="form-panel" onSubmit={(e) => { e.preventDefault(); next(); }}>
        <div className="form-section-heading"><span>Paso {draft.currentStep + 1} de 7</span><h2>{stepCopy[draft.currentStep][0]}</h2><p>{stepCopy[draft.currentStep][1]}</p></div>
        {stepContent()}
        {submitError && <div className="confirmation-box" role="alert"><p className="field-error"><WarningCircle size={18} />{submitError}</p></div>}
        {draft.currentStep < 6 && <div className="form-actions">
          {draft.currentStep > 0 ? <button className="button button-secondary" type="button" onClick={back}><ArrowLeft /> Anterior</button> : <button className="button button-secondary" type="button" onClick={() => navigate("/bienes/entradas")}><FloppyDisk /> Guardar y salir</button>}
          <button className="button button-primary" type="submit" disabled={submitting}>{submitting ? "Registrando…" : draft.currentStep === 5 ? <><QrCode /> Registrar y generar QR</> : <>Continuar <ArrowRight /></>}</button>
        </div>}
      </form>
      {draft.currentStep < 6 && <aside className="help-panel"><h2>Control del registro</h2><p>Los campos marcados con * son obligatorios. El borrador se conserva incluso sin conexión.</p><ul><li><Check size={16} /> Validación por cada etapa</li><li><Check size={16} /> Ubicación inicial de almacenamiento</li><li><Check size={16} /> Evidencia mínima obligatoria</li></ul><p className="help-note">El alta no asigna responsables. El código único y el QR se generan al confirmar el registro; la entrega se realiza después desde Asignaciones.</p></aside>}
    </div>
  </section>;
}

function Review({ title, rows, onEdit }: { title: string; rows: string[][]; onEdit: () => void }) {
  return <article className="review-card"><header><h3>{title}</h3><button type="button" onClick={onEdit}>Editar</button></header><dl>{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || "—"}</dd></div>)}</dl></article>;
}
