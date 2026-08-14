import { ArrowLeft, Check, FloppyDisk, Info, WarningCircle } from "@phosphor-icons/react";
import axios from "axios";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CRITICALITIES } from "@/modules/assets/entryModel";
import { TaxonomySectionNav } from "../components/TaxonomySectionNav";
import { useCreateTaxonomy, useTaxonomy, useUpdateTaxonomy } from "../taxonomyQueries";
import type { TaxonomyInput } from "../types";

const emptyInput: TaxonomyInput = {
  prefix: "",
  name: "",
  assetType: "",
  category: "",
  subcategory: "",
  specialty: "",
  sequenceDigits: 4,
  defaultCriticality: "Media",
  usefulLifeYears: null,
  preventiveFrequencyMonths: null,
  requiresMaintenance: false,
  requiresCertification: false,
  issuanceEnabled: true,
  reviewStatus: "VALIDATED",
  aliases: [],
  notes: "",
  active: true,
};

function Field({
  label,
  error,
  hint,
  required,
  children,
  wide,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`field ${wide ? "field-wide" : ""} ${error ? "has-error" : ""}`}>
      <span>
        {label}
        {required && <b aria-hidden="true"> *</b>}
      </span>
      {children}
      {hint && !error && <small>{hint}</small>}
      {error && (
        <small className="field-error">
          <WarningCircle size={15} /> {error}
        </small>
      )}
    </label>
  );
}

function toInput(record: NonNullable<ReturnType<typeof useTaxonomy>["data"]>): TaxonomyInput {
  return {
    prefix: record.prefix,
    name: record.name,
    assetType: record.assetType,
    category: record.category,
    subcategory: record.subcategory,
    specialty: record.specialty,
    sequenceDigits: record.sequenceDigits,
    defaultCriticality: record.defaultCriticality,
    usefulLifeYears: record.usefulLifeYears,
    preventiveFrequencyMonths: record.preventiveFrequencyMonths,
    requiresMaintenance: record.requiresMaintenance,
    requiresCertification: record.requiresCertification,
    issuanceEnabled: record.issuanceEnabled,
    reviewStatus: record.reviewStatus,
    aliases: record.aliases,
    notes: record.notes,
    active: record.active,
  };
}

export function TaxonomyFormPage() {
  const { id } = useParams();
  const editing = Boolean(id);
  const navigate = useNavigate();
  const detailQuery = useTaxonomy(id);
  const createMutation = useCreateTaxonomy();
  const updateMutation = useUpdateTaxonomy(id ?? "");
  const [input, setInput] = useState<TaxonomyInput>(emptyInput);
  const [aliasesText, setAliasesText] = useState("");
  const [initializedId, setInitializedId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState("");
  const record = detailQuery.data;
  const codeLocked = Boolean(record && record.lastSequence > 0);
  const pending = createMutation.isPending || updateMutation.isPending;
  const codeMask = useMemo(
    () => `${input.prefix || "PREFIJO"}-${"0".repeat(input.sequenceDigits || 4)}`,
    [input.prefix, input.sequenceDigits],
  );

  useEffect(() => {
    if (!record || initializedId === record.id) return;
    setInput(toInput(record));
    setAliasesText(record.aliases.join(", "));
    setInitializedId(record.id);
  }, [initializedId, record]);

  function setField<K extends keyof TaxonomyInput>(key: K, value: TaxonomyInput[K]) {
    setInput((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  function validate() {
    const next: Record<string, string> = {};
    if (!/^[A-Z][A-Z0-9]{0,15}$/.test(input.prefix.trim().toUpperCase()))
      next.prefix = "Usa de 1 a 16 letras o números, iniciando con una letra.";
    if (!input.name.trim()) next.name = "Ingresa el nombre oficial.";
    if (!input.assetType.trim()) next.assetType = "Ingresa el tipo de bien.";
    if (!input.category.trim()) next.category = "Ingresa la categoría.";
    if (!input.subcategory.trim()) next.subcategory = "Ingresa la subcategoría.";
    if (!input.specialty.trim()) next.specialty = "Ingresa la especialidad.";
    if (input.sequenceDigits < 3 || input.sequenceDigits > 8)
      next.sequenceDigits = "Debe tener entre 3 y 8 dígitos.";
    if (input.usefulLifeYears !== null && input.usefulLifeYears <= 0)
      next.usefulLifeYears = "Debe ser mayor que cero.";
    if (
      input.requiresMaintenance &&
      (!input.preventiveFrequencyMonths || input.preventiveFrequencyMonths <= 0)
    )
      next.preventiveFrequencyMonths = "Define una frecuencia mayor que cero.";
    setErrors(next);
    return !Object.keys(next).length;
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!validate()) {
      document.querySelector(".has-error")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSubmitError("");
    const payload = {
      ...input,
      prefix: input.prefix.trim().toUpperCase(),
      aliases: aliasesText
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    };
    try {
      if (editing) await updateMutation.mutateAsync(payload);
      else await createMutation.mutateAsync(payload);
      navigate("/administracion/taxonomia", {
        replace: true,
        state: {
          message: editing
            ? "Taxonomía actualizada correctamente."
            : "Taxonomía creada correctamente.",
        },
      });
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409)
        setErrors((current) => ({
          ...current,
          prefix:
            "Este prefijo ya está registrado o entra en conflicto con una secuencia existente.",
        }));
      else if (
        axios.isAxiosError(error) &&
        error.response?.data &&
        typeof error.response.data === "object"
      ) {
        const response = error.response.data as Record<string, string[] | string>;
        const mapped: Record<string, string> = {};
        const fields: Record<string, keyof TaxonomyInput> = {
          prefix: "prefix",
          name: "name",
          asset_type: "assetType",
          category: "category",
          subcategory: "subcategory",
          specialty: "specialty",
          sequence_digits: "sequenceDigits",
          useful_life_years: "usefulLifeYears",
          preventive_frequency_months: "preventiveFrequencyMonths",
          requires_maintenance: "requiresMaintenance",
          requires_certification: "requiresCertification",
          issuance_enabled: "issuanceEnabled",
          review_status: "reviewStatus",
          default_criticality: "defaultCriticality",
          aliases: "aliases",
          notes: "notes",
        };
        Object.entries(fields).forEach(([apiField, formField]) => {
          const value = response[apiField];
          if (value) mapped[formField] = Array.isArray(value) ? value[0] : String(value);
        });
        if (Object.keys(mapped).length) {
          setErrors((current) => ({ ...current, ...mapped }));
        }
        const generalMsg = response.non_field_errors
          ? (Array.isArray(response.non_field_errors) ? response.non_field_errors[0] : response.non_field_errors)
          : response.detail;
        if (generalMsg) {
          setSubmitError(String(generalMsg));
        } else if (!Object.keys(mapped).length) {
          setSubmitError(
            "No se pudo guardar la taxonomía. Revisa los datos e inténtalo nuevamente.",
          );
        }
      } else {
        setSubmitError(
          "No se pudo guardar la taxonomía. Verifica la conexión e inténtalo nuevamente.",
        );
      }
    }
  }

  if (editing && detailQuery.isPending)
    return (
      <div className="taxonomy-form-loading" aria-busy="true">
        <span />
        <span />
        <span />
        <span className="sr-only">Cargando taxonomía</span>
      </div>
    );
  if (editing && detailQuery.isError)
    return (
      <section className="taxonomy-state-panel" role="alert">
        <WarningCircle size={34} />
        <strong>No se pudo abrir la taxonomía</strong>
        <p>El registro puede haber cambiado o el servidor no está disponible.</p>
        <Link className="button button-secondary" to="/administracion/taxonomia">
          Volver al catálogo
        </Link>
      </section>
    );

  return (
    <section className="taxonomy-form-page">
      <TaxonomySectionNav />
      <div className="wizard-heading">
        <Link className="back-link" to="/administracion/taxonomia">
          <ArrowLeft /> Volver a taxonomía
        </Link>
        <div>
          <div>
            <p className="breadcrumb">Administración / Taxonomía</p>
            <h1>{editing ? `Editar ${record?.prefix ?? "taxonomía"}` : "Nueva taxonomía"}</h1>
          </div>
          <span className={`status ${input.active ? "status-success" : "status-neutral"}`}>
            {input.active ? "Activa" : "Inactiva"}
          </span>
        </div>
      </div>
      <div className="taxonomy-form-layout">
        <form className="form-panel taxonomy-form" onSubmit={submit}>
          <section>
            <header>
              <span>Identidad y código</span>
              <h2>Define el prefijo operativo</h2>
              <p>
                El prefijo identifica la familia; el servidor administra el consecutivo de cada
                bien.
              </p>
            </header>
            <div className="form-grid">
              <Field
                label="Prefijo"
                error={errors.prefix}
                hint={
                  codeLocked
                    ? "Bloqueado porque ya existen códigos emitidos."
                    : "Sin guion ni espacios. Se guardará en mayúsculas."
                }
                required
              >
                <input
                  value={input.prefix}
                  disabled={codeLocked}
                  maxLength={16}
                  onChange={(event) =>
                    setField("prefix", event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))
                  }
                  placeholder="AAP"
                />
              </Field>
              <Field
                label="Dígitos del consecutivo"
                error={errors.sequenceDigits}
                hint={
                  codeLocked
                    ? "Bloqueado porque ya existen códigos emitidos."
                    : "Entre 3 y 8 dígitos."
                }
                required
              >
                <input
                  type="number"
                  min={3}
                  max={8}
                  disabled={codeLocked}
                  value={input.sequenceDigits}
                  onChange={(event) => setField("sequenceDigits", Number(event.target.value))}
                />
              </Field>
              <Field label="Nombre oficial" error={errors.name} required wide>
                <input
                  value={input.name}
                  onChange={(event) => setField("name", event.target.value)}
                  placeholder="Aire acondicionado"
                />
              </Field>
              <div className="taxonomy-code-preview field-wide">
                <span>Formato resultante</span>
                <code>{codeMask}</code>
                <small>El número real se reserva al confirmar la entrada del bien.</small>
              </div>
            </div>
          </section>
          <section>
            <header>
              <span>Clasificación</span>
              <h2>Ubica el bien en la jerarquía</h2>
            </header>
            <div className="form-grid">
              <Field label="Tipo de bien" error={errors.assetType} required>
                <input
                  value={input.assetType}
                  onChange={(event) => setField("assetType", event.target.value)}
                />
              </Field>
              <Field label="Categoría" error={errors.category} required>
                <input
                  value={input.category}
                  onChange={(event) => setField("category", event.target.value)}
                />
              </Field>
              <Field label="Subcategoría" error={errors.subcategory} required>
                <input
                  value={input.subcategory}
                  onChange={(event) => setField("subcategory", event.target.value)}
                />
              </Field>
              <Field label="Especialidad" error={errors.specialty} required>
                <input
                  value={input.specialty}
                  onChange={(event) => setField("specialty", event.target.value)}
                />
              </Field>
              <Field label="Alias de búsqueda" hint="Sepáralos con comas." wide>
                <input
                  value={aliasesText}
                  onChange={(event) => setAliasesText(event.target.value)}
                  placeholder="A/C, climatización"
                />
              </Field>
              <Field label="Estado de validación">
                <select
                  value={input.reviewStatus}
                  onChange={(event) => {
                    const nextStatus = event.target.value as TaxonomyInput["reviewStatus"];
                    setInput((current) => ({
                      ...current,
                      reviewStatus: nextStatus,
                      issuanceEnabled: nextStatus === "REVIEW" ? false : current.issuanceEnabled,
                    }));
                  }}
                >
                  <option value="VALIDATED">Validada</option>
                  <option value="REVIEW">Requiere revisión</option>
                </select>
              </Field>
            </div>
          </section>
          <section>
            <header>
              <span>Reglas predeterminadas</span>
              <h2>Configura el ciclo de vida</h2>
              <p>
                Estas reglas se propondrán al registrar un bien y podrán ajustarse según el caso.
              </p>
            </header>
            <div className="form-grid">
              <Field label="Criticidad predeterminada">
                <select
                  value={input.defaultCriticality}
                  onChange={(event) =>
                    setField(
                      "defaultCriticality",
                      event.target.value as TaxonomyInput["defaultCriticality"],
                    )
                  }
                >
                  {CRITICALITIES.map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </Field>
            </div>
          </section>
          <section>
            <header>
              <span>Trazabilidad</span>
              <h2>Documenta el criterio</h2>
            </header>
            <div className="form-grid">
              <Field label="Notas de administración" wide>
                <textarea
                  rows={4}
                  value={input.notes}
                  onChange={(event) => setField("notes", event.target.value)}
                  placeholder="Decisiones, equivalencias o validaciones pendientes."
                />
              </Field>
            </div>
          </section>
          {submitError && (
            <div className="taxonomy-form-error" role="alert">
              <WarningCircle /> {submitError}
            </div>
          )}
          <footer className="form-actions">
            <Link className="button button-secondary" to="/administracion/taxonomia">
              Cancelar
            </Link>
            <button className="button button-primary" type="submit" disabled={pending}>
              <FloppyDisk /> {pending ? "Guardando…" : "Guardar taxonomía"}
            </button>
          </footer>
        </form>
        <aside className="help-panel taxonomy-form-help">
          <Info size={24} weight="duotone" />
          <h2>Reglas de integridad</h2>
          <ul>
            <li>
              <Check /> Un prefijo pertenece a una sola taxonomía.
            </li>
            <li>
              <Check /> Los alias ayudan a buscar, pero nunca generan códigos.
            </li>
            <li>
              <Check /> Los consecutivos se reservan en el servidor.
            </li>
            <li>
              <Check /> Los códigos emitidos nunca se reutilizan.
            </li>
            <li>
              <Check /> Una taxonomía con historial solo se desactiva.
            </li>
          </ul>
          {record && (
            <dl>
              <div>
                <dt>Bienes vinculados</dt>
                <dd>{record.assetCount}</dd>
              </div>
              <div>
                <dt>Última secuencia</dt>
                <dd>{record.lastSequence || "Sin emisiones"}</dd>
              </div>
              <div>
                <dt>Próximo formato</dt>
                <dd>{record.nextCodePreview ?? codeMask}</dd>
              </div>
              {record.sourceVersion && (
                <div>
                  <dt>Fuente</dt>
                  <dd>{record.sourceVersion}</dd>
                </div>
              )}
            </dl>
          )}
        </aside>
      </div>
    </section>
  );
}
