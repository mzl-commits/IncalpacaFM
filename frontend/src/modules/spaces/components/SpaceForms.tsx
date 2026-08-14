import { CheckCircle, FloppyDisk, Info, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { useSpaceOptions, useSites } from "../spacesQueries";
import type { SpaceNode, SpaceNodeInput, SpaceSite, SpaceSiteInput } from "../types";
import {
  spaceKindCodeHints,
  spaceKindDescriptions,
  spaceKindLabels,
  spaceKindLevels,
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
    try {
      await onSubmit({ code: normalizedCode, name: name.trim(), address });
    } catch (err: any) {
      if (err?.response?.data) {
        const data = err.response.data;
        const msg = data.code ? (Array.isArray(data.code) ? data.code[0] : data.code)
          : data.name ? (Array.isArray(data.name) ? data.name[0] : data.name)
          : data.detail ? String(data.detail)
          : "No se pudo guardar la sede. Revisa los datos e inténtalo nuevamente.";
        setError(msg);
      } else {
        setError("No se pudo guardar la sede. Verifica la conexión.");
      }
    }
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

const LEVEL_BOXES: Array<{
  type: SpaceNodeType;
  level: number;
  title: string;
  description: string;
}> = [
  { type: "MACRO_AREA", level: 2, title: "Área macro", description: "Inicia con PP, AD, CO, RE o AL." },
  { type: "AREA", level: 3, title: "Área", description: "Área funcional o departamento." },
  { type: "MODULE", level: 4, title: "Módulo", description: "Estación de trabajo o módulo." },
];

export function SpaceNodeForm({
  node,
  defaultSiteId = "",
  defaultParentId = null,
  defaultNodeType,
  busy = false,
  submitLabel,
  onSubmit,
}: SpaceNodeFormProps) {
  const sitesQuery = useSites(node ? "" : "true");
  const [siteId, setSiteId] = useState(node?.siteId ?? defaultSiteId);
  const [parentId, setParentId] = useState<string | null>(node?.parentId ?? defaultParentId);
  const optionsQuery = useSpaceOptions(siteId || undefined, parentId || undefined);
  const [nodeType, setNodeType] = useState<SpaceNodeType>(node?.nodeType ?? defaultNodeType ?? "MACRO_AREA");
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

  const chosenParent = useMemo(() => parentOptions.find((item) => item.id === parentId) ?? null, [parentId, parentOptions]);
  const currentLevel = spaceKindLevels[selectedType] ?? 2;

  // Filter parent options by expected prior level for direct selection
  const candidateParents = useMemo(() => {
    if (!parentOptions.length) return [];
    return parentOptions.filter((item) => item.id !== node?.id);
  }, [node?.id, parentOptions]);

  function changeSite(id: string) {
    setSiteId(id);
    setParentId(null);
    setError("");
  }

  function changeParent(id: string | null) {
    setParentId(id);
    setError("");
  }

  function selectLevel(targetType: SpaceNodeType) {
    setNodeType(targetType);
    setError("");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const area = decimalValue(squareMeters);
    const capacity = decimalValue(headcount);
    const normalizedCode = codeSegment.trim().toUpperCase();
    if (!siteId) {
      setError("Selecciona la sede (Nivel 1) a la que pertenece el espacio.");
      return;
    }
    if (currentLevel >= 3 && !parentId) {
      setError(`Para crear un espacio de Nivel ${currentLevel} (${spaceKindLabels[selectedType]}) debes seleccionar un espacio padre de nivel superior.`);
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
    try {
      if (nodeType === "MACRO_AREA") {
        const validPrefixes = ["PP", "AD", "CO", "RE", "AL"];
        if (!validPrefixes.some(p => normalizedCode.startsWith(p))) {
          setError("El código del Área Macro debe iniciar con PP, AD, CO, RE o AL.");
          return;
        }
      }

      await onSubmit({
        siteId,
        parentId: chosenParent ? chosenParent.id : null,
        nodeType,
        codeSegment: normalizedCode,
        name: name.trim(),
        squareMeters: area,
        headcount: capacity,
        commonSpace,
      });
    } catch (err: any) {
      if (err?.response?.data) {
        const data = err.response.data;
        const msg = data.name ? (Array.isArray(data.name) ? data.name[0] : data.name)
          : data.code_segment ? (Array.isArray(data.code_segment) ? data.code_segment[0] : data.code_segment)
          : data.parent_id ? (Array.isArray(data.parent_id) ? data.parent_id[0] : data.parent_id)
          : data.detail ? String(data.detail)
          : "No se pudo guardar el espacio. Revisa los datos e inténtalo nuevamente.";
        setError(msg);
      } else {
        setError("No se pudo guardar el espacio. Verifica la conexión.");
      }
    }
  }

  const generatedPathPreview = useMemo(() => {
    if (!selectedSite) return "";
    const parentPath = chosenParent ? chosenParent.pathCode : selectedSite.code;
    return `${parentPath}-${codeSegment.trim().toUpperCase() || "..."}`;
  }, [chosenParent, codeSegment, selectedSite]);

  return (
    <form className="space-form surface-card" onSubmit={(event) => void submit(event)}>
      {/* Paso 1: Selección de Sede */}
      <section className="space-form-step">
        <header>
          <span>Paso 1</span>
          <h3>Selecciona la Sede (Nivel 1)</h3>
          <p>La sede es el punto de partida físico de la infraestructura.</p>
        </header>
        {sites.length === 0 && !sitesQuery.isPending ? (
          <div className="space-form-feedback is-error">
            <WarningCircle weight="fill" />
            <span>No existen sedes (Nivel 1) registradas. Debes crear una sede primero.</span>
          </div>
        ) : (
          <div className="space-level-grid">
            {sites.map((site) => (
              <button
                key={site.id}
                type="button"
                className={`space-box-card ${site.id === siteId ? "is-selected" : ""}`}
                onClick={() => changeSite(site.id)}
              >
                <span className="level-badge">Nivel 1 · Sede</span>
                <strong>{site.code} · {site.name}</strong>
                <small>{site.address.addressLine || site.address.district || "Sede activa"}</small>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Paso 2: Selección del Nivel del Espacio */}
      <section className="space-form-step">
        <header>
          <span>Paso 2</span>
          <h3>Selecciona el Nivel a Crear (Nivel 2 al 9)</h3>
          <p>Selecciona directamente el nivel del espacio. No necesitas entrar nivel por nivel.</p>
        </header>
        <div className="space-level-grid">
          {LEVEL_BOXES.map((box) => (
            <button
              key={box.type}
              type="button"
              className={`space-box-card ${nodeType === box.type ? "is-selected" : ""}`}
              onClick={() => selectLevel(box.type)}
              disabled={!siteId}
            >
              <span className="level-badge">Nivel {box.level}</span>
              <strong>{box.title}</strong>
              <small>{box.description}</small>
            </button>
          ))}
        </div>
      </section>

      {/* Paso 3: Selección del Padre Directo */}
      <section className="space-form-step">
        <header>
          <span>Paso 3</span>
          <h3>
            {currentLevel === 2
              ? "Padre Directo: Raíz de la Sede"
              : `Selecciona el Padre Directo (Nivel ${currentLevel - 1} o superior)`}
          </h3>
          <p>
            {currentLevel === 2
              ? "Los espacios de Nivel 2 se ubican directamente en la raíz de la Sede."
              : `Selecciona el espacio de Nivel ${currentLevel - 1} al que pertenece directamente.`}
          </p>
        </header>
        {currentLevel === 2 ? (
          <div className="space-form-feedback">
            <Info weight="duotone" />
            <span>El espacio se creará directamente en la Sede seleccionada ({selectedSite?.code || "Sede"}).</span>
          </div>
        ) : (
          <div className="space-form-grid">
            <label className="space-form-full">
              <span>Espacio Padre <b>*</b></span>
              <select
                value={parentId ?? ""}
                onChange={(event) => changeParent(event.target.value || null)}
                disabled={!siteId || optionsQuery.isPending}
                required
              >
                <option value="">-- Selecciona el espacio padre --</option>
                {candidateParents.map((parent) => (
                  <option key={parent.id} value={parent.id}>
                    {parent.pathCode} · {parent.name} ({spaceKindLabels[parent.kind] || parent.kind})
                  </option>
                ))}
              </select>
              {chosenParent ? (
                <small>Padre seleccionado: <b>{chosenParent.name}</b> ({chosenParent.pathCode})</small>
              ) : (
                <small>Selecciona el espacio de nivel superior.</small>
              )}
            </label>
          </div>
        )}
      </section>

      {/* Paso 4: Identidad y Medidas del Espacio */}
      <section className="space-form-step">
        <header>
          <span>Paso 4</span>
          <h3>Datos e Identificación del Espacio</h3>
          <p>Asigna el código de segmento, el nombre legible y sus medidas operativas.</p>
        </header>
        <div className="space-form-grid">
          <label>
            <span>Segmento de código <b>*</b></span>
            <input
              value={codeSegment}
              onChange={(event) => setCodeSegment(event.target.value.toUpperCase())}
              placeholder={spaceKindCodeHints[selectedType]}
              maxLength={16}
              autoComplete="off"
              required
            />
            <small>Segmento único dentro del mismo nivel.</small>
          </label>
          <label>
            <span>Nombre del espacio <b>*</b></span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={`Ej. ${spaceKindLabels[selectedType]} principal`}
              required
            />
            <small>Nombre descriptivo legible.</small>
          </label>
          <label>
            <span>Metros cuadrados</span>
            <div className="space-input-unit">
              <input
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={squareMeters}
                onChange={(event) => setSquareMeters(event.target.value)}
                placeholder="Ej. 45.50"
              />
              <b>m²</b>
            </div>
            <small>Opcional; mayor a cero.</small>
          </label>
          <label>
            <span>Aforo</span>
            <div className="space-input-unit">
              <input
                type="number"
                inputMode="numeric"
                min="0"
                step="1"
                value={headcount}
                onChange={(event) => setHeadcount(event.target.value)}
                disabled={commonSpace}
                placeholder="Ej. 12"
              />
              <b>pers.</b>
            </div>
            <small>Referencial; aforo estimado.</small>
          </label>
          <label className="space-form-check">
            <input
              type="checkbox"
              checked={commonSpace}
              onChange={(event) => setCommonSpace(event.target.checked)}
            />
            <span>
              <strong>Espacio común</strong>
              <small>Permite uso compartido entre diferentes áreas.</small>
            </span>
          </label>
        </div>
      </section>

      <FormFeedback
        error={error}
        helper={
          node
            ? "Los cambios quedan auditados sin modificar bienes de otras sedes."
            : `Ruta esperada al guardar: ${generatedPathPreview || "Sede-Código"}`
        }
      />
      <footer className="space-form-actions">
        <button
          className="button button-primary"
          type="submit"
          disabled={busy || optionsQuery.isPending || selectedSiteArchived}
        >
          <FloppyDisk />
          {busy ? "Guardando…" : submitLabel}
        </button>
        {node && (
          <span className="space-form-state">
            <CheckCircle weight="fill" />
            Ruta actual: {node.pathCode}
          </span>
        )}
      </footer>
    </form>
  );
}
