import {
  ArrowsClockwise,
  CheckCircle,
  MagnifyingGlass,
  Tag,
  WarningCircle,
  WifiSlash,
} from "@phosphor-icons/react";
import { useId, useMemo, useState } from "react";
import { useTaxonomyOptions } from "../taxonomyQueries";
import type { TaxonomyOption } from "../types";

type TaxonomyPickerProps = {
  selectedId: string;
  onSelect: (taxonomy: TaxonomyOption) => void;
  error?: string;
};

const EMPTY_OPTIONS: TaxonomyOption[] = [];

export function TaxonomyPicker({ selectedId, onSelect, error }: TaxonomyPickerProps) {
  const searchId = useId();
  const groupId = useId();
  const [query, setQuery] = useState("");
  const optionsQuery = useTaxonomyOptions();
  const options = optionsQuery.data?.items ?? EMPTY_OPTIONS;
  const normalizedQuery = query.trim().toLocaleLowerCase("es-PE");
  const selected = options.find((item) => item.id === selectedId);
  const filtered = useMemo(() => {
    if (!normalizedQuery) return options;
    return options.filter((item) =>
      [
        item.prefix,
        item.name,
        item.assetType,
        item.category,
        item.subcategory,
        item.specialty,
        ...item.aliases,
      ]
        .join(" ")
        .toLocaleLowerCase("es-PE")
        .includes(normalizedQuery),
    );
  }, [normalizedQuery, options]);

  if (optionsQuery.isPending) {
    return (
      <section className="taxonomy-picker taxonomy-picker-loading" aria-busy="true">
        <div className="taxonomy-picker-skeleton" />
        <div className="taxonomy-picker-skeleton" />
        <div className="taxonomy-picker-skeleton is-short" />
        <span className="sr-only">Cargando taxonomías disponibles</span>
      </section>
    );
  }

  if (optionsQuery.isError) {
    return (
      <section className="taxonomy-picker taxonomy-picker-state" role="alert">
        <WarningCircle size={25} weight="duotone" />
        <div>
          <strong>No se pudo cargar el catálogo</strong>
          <p>Revisa la conexión antes de continuar con la clasificación.</p>
        </div>
        <button
          className="button button-secondary"
          type="button"
          onClick={() => optionsQuery.refetch()}
        >
          <ArrowsClockwise /> Reintentar
        </button>
      </section>
    );
  }

  return (
    <section className={`taxonomy-picker ${error ? "has-error" : ""}`}>
      {optionsQuery.data?.source === "cache" && (
        <div className="taxonomy-cache-notice" role="status">
          <WifiSlash size={19} />
          <span>
            <strong>Catálogo sin conexión</strong>
            Se usa la última versión disponible en este dispositivo. Se validará al registrar.
          </span>
        </div>
      )}

      <label className="taxonomy-picker-search" htmlFor={searchId}>
        <span>Buscar taxonomía por prefijo o nombre</span>
        <span>
          <MagnifyingGlass size={19} aria-hidden="true" />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Ej. AAP o aire acondicionado"
            autoComplete="off"
          />
        </span>
      </label>

      {selected && (
        <article className="taxonomy-selected-summary" aria-live="polite">
          <CheckCircle size={23} weight="fill" />
          <div>
            <span>Taxonomía seleccionada</span>
            <strong>
              <code>{selected.prefix}</code> — {selected.name}
            </strong>
            <small>
              {selected.assetType} / {selected.category} / {selected.subcategory}
            </small>
          </div>
          <span className="taxonomy-format">
            Formato {selected.prefix}-{"0".repeat(selected.sequenceDigits)}
          </span>
        </article>
      )}

      <fieldset
        className="taxonomy-picker-results"
        aria-describedby={error ? `${groupId}-error` : undefined}
      >
        <legend id={groupId}>
          {filtered.length} {filtered.length === 1 ? "resultado" : "resultados"}
        </legend>
        <div>
          {filtered.map((item) => (
            <label
              key={item.id}
              className={`taxonomy-option ${selectedId === item.id ? "is-selected" : ""}`}
            >
              <input
                type="radio"
                name="asset-taxonomy"
                value={item.id}
                checked={selectedId === item.id}
                onChange={() => onSelect(item)}
              />
              <span className="taxonomy-option-prefix">{item.prefix}</span>
              <span>
                <strong>{item.name}</strong>
                <small>
                  {item.category} · {item.specialty}
                </small>
              </span>
              {item.reviewStatus === "REVIEW" && (
                <span className="status status-warning">En revisión</span>
              )}
              <Tag size={18} aria-hidden="true" />
            </label>
          ))}
        </div>
      </fieldset>

      {!filtered.length && (
        <div className="taxonomy-picker-empty">
          <Tag size={24} />
          <strong>No hay coincidencias</strong>
          <p>Prueba con otro prefijo, nombre o categoría.</p>
          <button type="button" onClick={() => setQuery("")}>
            Limpiar búsqueda
          </button>
        </div>
      )}

      {error && (
        <small className="field-error" id={`${groupId}-error`}>
          <WarningCircle size={15} /> {error}
        </small>
      )}
    </section>
  );
}
