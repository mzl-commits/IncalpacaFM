import { CheckCircle, FloppyDisk, Info, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import type { TaxonomyFamilyInput, TaxonomyInput, TaxonomyPartInput, TaxonomyPieceInput } from "../types";
import { CRITICALITIES } from "@/modules/assets/entryModel";

type FormFeedbackProps = { error?: string; helper?: string };

function FormFeedback({ error, helper }: FormFeedbackProps) {
  if (error) return <p className="space-form-feedback is-error" role="alert"><WarningCircle weight="fill" />{error}</p>;
  if (helper) return <p className="space-form-feedback"><Info weight="duotone" />{helper}</p>;
  return null;
}

type TaxonomyFamilyFormProps = {
  initialData?: any;
  busy?: boolean;
  submitLabel: string;
  onSubmit: (input: TaxonomyFamilyInput) => Promise<void> | void;
};

export function TaxonomyFamilyForm({ initialData, busy = false, submitLabel, onSubmit }: TaxonomyFamilyFormProps) {
  const [code, setCode] = useState(initialData?.code ?? "");
  const [name, setName] = useState(initialData?.name ?? "");
  const [active, setActive] = useState(initialData?.active ?? true);
  const [error, setError] = useState("");

  useEffect(() => {
    setCode(initialData?.code ?? "");
    setName(initialData?.name ?? "");
    setActive(initialData?.active ?? true);
    setError("");
  }, [initialData]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!code.trim()) { setError("Ingresa el código de familia."); return; }
    if (!name.trim()) { setError("Ingresa el nombre de la familia."); return; }
    setError("");
    try {
      await onSubmit({ code, name, active });
    } catch (err: any) {
      if (err?.response?.data) {
        if (typeof err.response.data.detail === "string") setError(err.response.data.detail);
        else {
          const firstVal = Object.values(err.response.data)[0];
          if (Array.isArray(firstVal) && typeof firstVal[0] === "string") setError(firstVal[0] as string);
          else setError("No se pudo guardar la familia.");
        }
      } else {
        setError("No se pudo guardar la familia.");
      }
    }
  }

  return (
    <form className="space-form surface-card" onSubmit={submit}>
      <section>
        <header>
          <span>Nivel 1</span>
          <h2>Familia</h2>
        </header>
        <div className="space-form-grid">
          <label>
            <span>Código <b>*</b></span>
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="MOB" required />
          </label>
          <label className="space-form-wide">
            <span>Nombre <b>*</b></span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Mobiliario" required />
          </label>
          {initialData && (
            <label className="space-form-wide switch-row">
              <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
              <span><strong>Familia activa</strong></span>
            </label>
          )}
        </div>
      </section>
      <FormFeedback error={error} />
      <footer className="space-form-actions">
        <button className="button button-primary" type="submit" disabled={busy}><FloppyDisk />{busy ? "Guardando…" : submitLabel}</button>
      </footer>
    </form>
  );
}

type TaxonomyTypeFormProps = {
  familyId: string;
  initialData?: any;
  busy?: boolean;
  submitLabel: string;
  onSubmit: (input: TaxonomyInput) => Promise<void> | void;
};

export function TaxonomyTypeForm({ familyId, initialData, busy = false, submitLabel, onSubmit }: TaxonomyTypeFormProps) {
  const [typeCode, setTypeCode] = useState(initialData?.typeCode ?? "");
  const [name, setName] = useState(initialData?.name ?? "");
  const [defaultCriticality, setDefaultCriticality] = useState(initialData?.defaultCriticality ?? "Media");
  const [usefulLifeYears, setUsefulLifeYears] = useState(initialData?.usefulLifeYears ?? "");
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [active, setActive] = useState(initialData?.active ?? true);
  const [error, setError] = useState("");

  useEffect(() => {
    setTypeCode(initialData?.typeCode ?? "");
    setName(initialData?.name ?? "");
    setDefaultCriticality(initialData?.defaultCriticality ?? "Media");
    setUsefulLifeYears(initialData?.usefulLifeYears ?? "");
    setNotes(initialData?.notes ?? "");
    setActive(initialData?.active ?? true);
    setError("");
  }, [initialData]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!typeCode.trim()) { setError("Ingresa el código del tipo."); return; }
    if (!name.trim()) { setError("Ingresa el nombre del tipo."); return; }
    setError("");
    try {
      await onSubmit({
        familyId,
        typeCode,
        name,
        assetType: "",
        category: "",
        subcategory: "",
        specialty: "",
        sequenceDigits: 2,
        defaultCriticality,
        requiresMaintenance: false,
        preventiveFrequencyMonths: null,
        requiresCertification: false,
        usefulLifeYears: usefulLifeYears ? Number(usefulLifeYears) : null,
        aliases: [],
        notes,
        active,
        issuanceEnabled: true,
        reviewStatus: "VALIDATED",
      });
    } catch (err: any) {
      if (err?.response?.data) {
        if (typeof err.response.data.detail === "string") setError(err.response.data.detail);
        else {
          const firstVal = Object.values(err.response.data)[0];
          if (Array.isArray(firstVal) && typeof firstVal[0] === "string") setError(firstVal[0] as string);
          else setError("No se pudo guardar el tipo.");
        }
      } else {
        setError("No se pudo guardar el tipo.");
      }
    }
  }

  return (
    <form className="space-form surface-card" onSubmit={submit}>
      <section>
        <header>
          <span>Nivel 2</span>
          <h2>Tipo de Bien</h2>
        </header>
        <div className="space-form-grid">
          <label>
            <span>Código <b>*</b></span>
            <input value={typeCode} onChange={e => setTypeCode(e.target.value.toUpperCase())} placeholder="SE1" required />
          </label>
          <label className="space-form-wide">
            <span>Nombre <b>*</b></span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Silla ergonómica" required />
          </label>
        </div>
      </section>
      <section>
        <header>
          <h2>Clasificación y Ciclo de vida</h2>
        </header>
        <div className="space-form-grid">
          <label>
            <span>Criticidad</span>
            <select value={defaultCriticality} onChange={e => setDefaultCriticality(e.target.value as any)}>
              {CRITICALITIES.map(x => <option key={x}>{x}</option>)}
            </select>
          </label>
          <label><span>Vida útil (años)</span><input type="number" value={usefulLifeYears} onChange={e => setUsefulLifeYears(e.target.value)} /></label>
        </div>
      </section>
      <section>
        <header><h2>Otros datos</h2></header>
        <div className="space-form-grid">
          <label className="space-form-wide"><span>Observaciones</span><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} /></label>
          {initialData && (
            <label className="space-form-wide switch-row">
              <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
              <span><strong>Tipo activo</strong></span>
            </label>
          )}
        </div>
      </section>
      <FormFeedback error={error} />
      <footer className="space-form-actions">
        <button className="button button-primary" type="submit" disabled={busy}><FloppyDisk />{busy ? "Guardando…" : submitLabel}</button>
      </footer>
    </form>
  );
}

type TaxonomyPartFormProps = {
  typeId: string;
  initialData?: any;
  busy?: boolean;
  submitLabel: string;
  onSubmit: (input: TaxonomyPartInput) => Promise<void> | void;
};

export function TaxonomyPartForm({ typeId, initialData, busy = false, submitLabel, onSubmit }: TaxonomyPartFormProps) {
  const [partCode, setPartCode] = useState(initialData?.partCode ?? "");
  const [name, setName] = useState(initialData?.name ?? "");
  const [active, setActive] = useState(initialData?.active ?? true);
  const [error, setError] = useState("");

  useEffect(() => {
    setPartCode(initialData?.partCode ?? "");
    setName(initialData?.name ?? "");
    setActive(initialData?.active ?? true);
    setError("");
  }, [initialData]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!partCode.trim()) { setError("Ingresa el código de la parte."); return; }
    if (!name.trim()) { setError("Ingresa el nombre de la parte."); return; }
    setError("");
    try {
      await onSubmit({ typeId, partCode, name, active });
    } catch (err: any) {
      if (err?.response?.data) {
        if (typeof err.response.data.detail === "string") setError(err.response.data.detail);
        else {
          const firstVal = Object.values(err.response.data)[0];
          if (Array.isArray(firstVal) && typeof firstVal[0] === "string") setError(firstVal[0] as string);
          else setError("No se pudo guardar la parte.");
        }
      } else {
        setError("No se pudo guardar la parte.");
      }
    }
  }

  return (
    <form className="space-form surface-card" onSubmit={submit}>
      <section>
        <header>
          <span>Nivel 3</span>
          <h2>Parte</h2>
        </header>
        <div className="space-form-grid">
          <label>
            <span>Código <b>*</b></span>
            <input value={partCode} onChange={e => setPartCode(e.target.value.toUpperCase())} placeholder="BG" required />
          </label>
          <label className="space-form-wide">
            <span>Nombre <b>*</b></span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Base giratoria" required />
          </label>
          {initialData && (
            <label className="space-form-wide switch-row">
              <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
              <span><strong>Parte activa</strong></span>
            </label>
          )}
        </div>
      </section>
      <FormFeedback error={error} />
      <footer className="space-form-actions">
        <button className="button button-primary" type="submit" disabled={busy}><FloppyDisk />{busy ? "Guardando…" : submitLabel}</button>
      </footer>
    </form>
  );
}

type TaxonomyPieceFormProps = {
  partId: string;
  initialData?: any;
  busy?: boolean;
  submitLabel: string;
  onSubmit: (input: TaxonomyPieceInput) => Promise<void> | void;
};

export function TaxonomyPieceForm({ partId, initialData, busy = false, submitLabel, onSubmit }: TaxonomyPieceFormProps) {
  const [pieceCode, setPieceCode] = useState(initialData?.pieceCode ?? "");
  const [name, setName] = useState(initialData?.name ?? "");
  const [active, setActive] = useState(initialData?.active ?? true);
  const [error, setError] = useState("");

  useEffect(() => {
    setPieceCode(initialData?.pieceCode ?? "");
    setName(initialData?.name ?? "");
    setActive(initialData?.active ?? true);
    setError("");
  }, [initialData]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pieceCode.trim()) { setError("Ingresa el código de la pieza."); return; }
    if (!name.trim()) { setError("Ingresa el nombre de la pieza."); return; }
    setError("");
    try {
      await onSubmit({ partId, pieceCode, name, active });
    } catch (err: any) {
      if (err?.response?.data) {
        if (typeof err.response.data.detail === "string") setError(err.response.data.detail);
        else {
          const firstVal = Object.values(err.response.data)[0];
          if (Array.isArray(firstVal) && typeof firstVal[0] === "string") setError(firstVal[0] as string);
          else setError("No se pudo guardar la pieza.");
        }
      } else {
        setError("No se pudo guardar la pieza.");
      }
    }
  }

  return (
    <form className="space-form surface-card" onSubmit={submit}>
      <section>
        <header>
          <span>Nivel 4</span>
          <h2>Pieza</h2>
        </header>
        <div className="space-form-grid">
          <label>
            <span>Código <b>*</b></span>
            <input value={pieceCode} onChange={e => setPieceCode(e.target.value.toUpperCase())} placeholder="GA" required />
          </label>
          <label className="space-form-wide">
            <span>Nombre <b>*</b></span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Garrucha" required />
          </label>
          {initialData && (
            <label className="space-form-wide switch-row">
              <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
              <span><strong>Pieza activa</strong></span>
            </label>
          )}
        </div>
      </section>
      <FormFeedback error={error} />
      <footer className="space-form-actions">
        <button className="button button-primary" type="submit" disabled={busy}><FloppyDisk />{busy ? "Guardando…" : submitLabel}</button>
      </footer>
    </form>
  );
}
