import { CheckCircle, FloppyDisk, Info, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { useSpaceOptions, useSites } from "../spacesQueries";
import type { SpaceNode, SpaceNodeInput, SpaceSite, SpaceSiteInput } from "../types";
import {
  spaceKindCodeHints,
  spaceKindDescriptions,
  spaceKindLabels,
  type SpaceNodeType,
} from "../types";

const blankAddress = {
  addressLine: "",
  district: "",
  province: "",
  department: "",
  country: "Perú",
};

function decimalValue(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

type FormFeedbackProps = { error?: string; helper?: string };

function FormFeedback({ error, helper }: FormFeedbackProps) {
  if (error) return <p className="space-form-feedback is-error" role="alert"><WarningCircle weight="fill" />{error}</p>;
  if (helper) return <p className="space-form-feedback"><Info weight="duotone" />{helper}</p>;
  return null;
}

type SpaceSiteFormProps = {
  site?: SpaceSite;
  busy?: boolean;
  submitLabel: string;
  onSubmit: (input: SpaceSiteInput) => Promise<void> | void;
};

export function SpaceSiteForm({ site, busy = false, submitLabel, onSubmit }: SpaceSiteFormProps) {
  const [code, setCode] = useState(site?.code ?? "");
  const [name, setName] = useState(site?.name ?? "");
  const [address, setAddress] = useState(site?.address ?? blankAddress);
  const [error, setError] = useState("");

  useEffect(() => {
    setCode(site?.code ?? "");
    setName(site?.name ?? "");
    setAddress(site?.address ?? blankAddress);
    setError("");
  }, [site]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedCode = code.trim().toUpperCase();
    if (!/^[A-Z]{3}\d$/.test(normalizedCode)) {
      setError("El código de sede debe tener tres letras y un número, por ejemplo INC1.");
      return;
    }
    if (!name.trim()) {
      setError("Ingresa el nombre de la sede.");
      return;
    }
    setError("");
    await onSubmit({ code: normalizedCode, name: name.trim(), address });
  }

  return (
    <form className="space-form surface-card" onSubmit={(event) => void submit(event)}>
      <section>
        <header>
          <span>Sede</span>
          <h2>{site ? "Datos de la sede" : "Nueva sede"}</h2>
          <p>La sede es la raíz de su propia estructura espacial. No pertenece a la taxonomía de bienes.</p>
        </header>
        <div className="space-form-grid">
          <label>
            <span>Código de sede <b>*</b></span>
            <input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="INC1" maxLength={4} autoComplete="off" required />
            <small>Formato fijo: tres letras y un número.</small>
          </label>
          <label className="space-form-wide">
            <span>Nombre de la sede <b>*</b></span>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Incalpaca – sede principal" required />
          </label>
        </div>
      </section>

      <section>
        <header>
          <span>Ubicación geográfica</span>
          <h2>Dirección de referencia</h2>
          <p>Esta información se usa para identificar la sede; los espacios internos se organizan debajo de ella.</p>
        </header>
        <div className="space-form-grid">
          <label className="space-form-full"><span>Dirección</span><input value={address.addressLine} onChange={(event) => setAddress((current) => ({ ...current, addressLine: event.target.value }))} placeholder="Calle, número y referencia" /></label>
          <label><span>Distrito</span><input value={address.district} onChange={(event) => setAddress((current) => ({ ...current, district: event.target.value }))} /></label>
          <label><span>Provincia</span><input value={address.province} onChange={(event) => setAddress((current) => ({ ...current, province: event.target.value }))} /></label>
          <label><span>Departamento</span><input value={address.department} onChange={(event) => setAddress((current) => ({ ...current, department: event.target.value }))} /></label>
          <label><span>País</span><input value={address.country} onChange={(event) => setAddress((current) => ({ ...current, country: event.target.value }))} /></label>
        </div>
      </section>
      <FormFeedback error={error} helper="Los cambios quedan auditados y no modifican los bienes existentes." />
      <footer className="space-form-actions">
        <button className="button button-primary" type="submit" disabled={busy}><FloppyDisk />{busy ? "Guardando…" : submitLabel}</button>
      </footer>
    </form>
  );
}

type SpaceNodeFormProps = {
  node?: SpaceNode;
  defaultSiteId?: string;
  defaultParentId?: string | null;
  defaultNodeType?: SpaceNodeType;
  busy?: boolean;
  submitLabel: string;
  onSubmit: (input: SpaceNodeInput) => Promise<void> | void;
};

export function SpaceNodeForm({
  node,
  defaultSiteId = "",
  defaultParentId = null,
  defaultNodeType,
  busy = false,
  submitLabel,
  onSubmit,
}: SpaceNodeFormProps) {
  // New/moved nodes only offer active sites. For an archived record, include
  // its current site just long enough to explain why it cannot be saved there.
  const sitesQuery = useSites(node ? "" : "true");
  const [siteId, setSiteId] = useState(node?.siteId ?? defaultSiteId);
  const [parentId, setParentId] = useState<string | null>(node?.parentId ?? defaultParentId);
  const optionsQuery = useSpaceOptions(siteId || undefined, parentId || undefined);
  const [nodeType, setNodeType] = useState<SpaceNodeType>(node?.nodeType ?? defaultNodeType ?? "AREA");
  const [codeSegment, setCodeSegment] = useState(node?.codeSegment ?? "");
  const [name, setName] = useState(node?.name ?? "");
  const [squareMeters, setSquareMeters] = useState(node?.squareMeters == null ? "" : String(node.squareMeters));
  const [headcount, setHeadcount] = useState(node?.headcount == null ? "" : String(node.headcount));
  const [commonSpace, setCommonSpace] = useState(node?.commonSpace ?? false);
  const [error, setError] = useState("");

  const sites = useMemo(
    () => (sitesQuery.data ?? optionsQuery.data?.sites ?? []).filter((site) => site.active || site.id === node?.siteId),
    [node?.siteId, optionsQuery.data?.sites, sitesQuery.data],
  );
  const allowedNodeTypes = useMemo(() => optionsQuery.data?.allowedNodeTypes ?? [], [optionsQuery.data?.allowedNodeTypes]);
  const parentOptions = useMemo(() => optionsQuery.data?.nodes ?? [], [optionsQuery.data?.nodes]);
  const selectedType = nodeType;
  const selectedSite = sites.find((site) => site.id === siteId) ?? null;
  const selectedSiteArchived = Boolean(selectedSite && !selectedSite.active);

  useEffect(() => {
    if (node) {
      setSiteId(node.siteId);
      setParentId(node.parentId);
      setNodeType(node.nodeType);
      setCodeSegment(node.codeSegment);
      setName(node.name);
      setSquareMeters(node.squareMeters == null ? "" : String(node.squareMeters));
      setHeadcount(node.headcount == null ? "" : String(node.headcount));
      setCommonSpace(node.commonSpace);
      setError("");
    }
  }, [node]);

  useEffect(() => {
    if (!allowedNodeTypes.length || allowedNodeTypes.some((option) => option.value === nodeType)) return;
    setNodeType(allowedNodeTypes[0].value);
  }, [allowedNodeTypes, nodeType]);

  const chosenParent = useMemo(() => parentOptions.find((item) => item.id === parentId) ?? null, [parentId, parentOptions]);

  function changeSite(value: string) {
    setSiteId(value);
    setParentId(null);
    setError("");
  }

  function changeParent(value: string) {
    setParentId(value || null);
    setError("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const area = decimalValue(squareMeters);
    const capacity = decimalValue(headcount);
    const normalizedCode = codeSegment.trim().toUpperCase();
    if (!siteId) {
      setError("Selecciona la sede a la que pertenece el espacio.");
      return;
    }
    if (!allowedNodeTypes.some((option) => option.value === nodeType)) {
      setError("Selecciona un tipo permitido para esta posición dentro del árbol.");
      return;
    }
    if (!/^[A-Z][A-Z0-9]{0,15}$/.test(normalizedCode)) {
      setError("El segmento debe iniciar con una letra y usar solo A–Z y 0–9.");
      return;
    }
    if (!name.trim()) {
      setError("Ingresa el nombre del espacio.");
      return;
    }
    if (Number.isNaN(area) || (area != null && area <= 0)) {
      setError("Los m² deben ser un número mayor a cero o quedar vacíos.");
      return;
    }
    if (Number.isNaN(capacity) || (capacity != null && (!Number.isInteger(capacity) || capacity < 0))) {
      setError("El aforo debe ser un número entero igual o mayor a cero.");
      return;
    }
    setError("");
    await onSubmit({
      siteId,
      parentId,
      nodeType,
      codeSegment: normalizedCode,
      name: name.trim(),
      // These attributes are valid for every SpaceNode in the current API.
      // Keep them editable so a type change never silently erases prior data.
      squareMeters: area,
      headcount: capacity,
      commonSpace,
    });
  }

  return (
    <form className="space-form surface-card" onSubmit={(event) => void submit(event)}>
      <section>
        <header>
          <span>Jerarquía espacial</span>
          <h2>{node ? "Datos del espacio" : "Nuevo espacio"}</h2>
          <p>El tipo permitido se consulta al servidor según la sede y el padre seleccionados.</p>
        </header>
        <div className="space-form-grid">
          <label>
            <span>Sede <b>*</b></span>
            <select value={siteId} onChange={(event) => changeSite(event.target.value)} required>
              <option value="">Selecciona una sede</option>
              {sites.map((site) => <option key={site.id} value={site.id}>{site.code} · {site.name}</option>)}
            </select>
            {selectedSiteArchived && <small>Esta sede está archivada. Restáurala o selecciona una sede activa antes de guardar.</small>}
          </label>
          <label>
            <span>Padre dentro de la sede</span>
            <select value={parentId ?? ""} onChange={(event) => changeParent(event.target.value)} disabled={!siteId}>
              <option value="">Raíz de la sede</option>
              {parentOptions.filter((item) => item.id !== node?.id).map((parent) => <option key={parent.id} value={parent.id}>{parent.pathCode} · {parent.name}</option>)}
            </select>
            {chosenParent && <small>Se creará dentro de: {chosenParent.pathCode}</small>}
          </label>
          <label>
            <span>Tipo de espacio <b>*</b></span>
            <select value={nodeType} onChange={(event) => setNodeType(event.target.value as SpaceNodeType)} disabled={!siteId || optionsQuery.isPending} required>
              {allowedNodeTypes.length ? allowedNodeTypes.map((option) => <option key={option.value} value={option.value}>{option.label}</option>) : <option value="">{siteId ? "Sin tipos disponibles" : "Selecciona la sede"}</option>}
            </select>
            <small>{spaceKindDescriptions[selectedType]}</small>
          </label>
          <label>
            <span>Segmento de código <b>*</b></span>
            <input value={codeSegment} onChange={(event) => setCodeSegment(event.target.value.toUpperCase())} placeholder={spaceKindCodeHints[selectedType]} maxLength={16} autoComplete="off" required />
            <small>Se agregará a la ruta automática de la sede.</small>
          </label>
          <label className="space-form-full">
            <span>Nombre <b>*</b></span>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder={`Ej. ${spaceKindLabels[selectedType]} principal`} required />
          </label>
        </div>
      </section>

      <section>
        <header>
          <span>Capacidad y uso</span>
          <h2>Datos operativos</h2>
          <p>Los m² y el aforo se guardan en este nodo sin alterar la taxonomía de los bienes.</p>
        </header>
        <div className="space-form-grid">
          <label>
            <span>Metros cuadrados</span>
            <div className="space-input-unit"><input type="number" inputMode="decimal" min="0.01" step="0.01" value={squareMeters} onChange={(event) => setSquareMeters(event.target.value)} placeholder="Ej. 45.50" /><b>m²</b></div>
            <small>Opcional; debe ser mayor a cero.</small>
          </label>
          <label>
            <span>Aforo</span>
            <div className="space-input-unit"><input type="number" inputMode="numeric" min="0" step="1" value={headcount} onChange={(event) => setHeadcount(event.target.value)} disabled={commonSpace} placeholder="Ej. 12" /><b>pers.</b></div>
            <small>Es referencial: el sobreaforo justificado se audita.</small>
          </label>
          <label className="space-form-check"><input type="checkbox" checked={commonSpace} onChange={(event) => setCommonSpace(event.target.checked)} /><span><strong>Espacio común</strong><small>El aforo se considera informativo y permite uso compartido.</small></span></label>
        </div>
      </section>
      <FormFeedback error={error} helper={node ? "Los cambios de jerarquía y medidas quedan registrados en auditoría." : "La ruta se calcula al guardar para proteger la integridad del árbol."} />
      <footer className="space-form-actions">
        <button className="button button-primary" type="submit" disabled={busy || optionsQuery.isPending || selectedSiteArchived}><FloppyDisk />{busy ? "Guardando…" : submitLabel}</button>
        {node && <span className="space-form-state"><CheckCircle weight="fill" />Ruta actual: {node.pathCode}</span>}
      </footer>
    </form>
  );
}
