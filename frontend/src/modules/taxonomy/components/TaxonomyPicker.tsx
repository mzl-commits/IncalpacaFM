import {
  ArrowsClockwise,
  CheckCircle,
  MagnifyingGlass,
  Tag,
  WarningCircle,
  CaretDown,
  CaretRight,
} from "@phosphor-icons/react";
import { useId, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTaxonomyTree } from "../taxonomyQueries";

type TaxonomyPickerProps = {
  selectedId: string;
  onSelect: (taxonomy: any) => void;
  error?: string;
};

export function TaxonomyPicker({ selectedId, onSelect, error }: TaxonomyPickerProps) {
  const searchId = useId();
  const groupId = useId();
  const [query, setQuery] = useState("");
  const treeQuery = useTaxonomyTree();
  const families = treeQuery.data ?? [];
  const normalizedQuery = query.trim().toLocaleLowerCase("es-PE");

  const [expandedFamilies, setExpandedFamilies] = useState<Record<string, boolean>>({});

  const toggleFamily = (id: string) => {
    setExpandedFamilies((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const filteredFamilies = useMemo(() => {
    if (!normalizedQuery) return families;
    return families
      .map((family) => {
        const matchingTypes = family.types.filter((type: any) =>
          [type.prefix, type.name, family.name]
            .join(" ")
            .toLocaleLowerCase("es-PE")
            .includes(normalizedQuery)
        );
        if (matchingTypes.length > 0 || family.name.toLocaleLowerCase("es-PE").includes(normalizedQuery)) {
          return { ...family, types: matchingTypes.length > 0 ? matchingTypes : family.types };
        }
        return null;
      })
      .filter(Boolean) as typeof families;
  }, [normalizedQuery, families]);

  let selectedType = null;
  let selectedFamily = null;
  for (const family of families) {
    const found = family.types.find((t: any) => t.id === selectedId);
    if (found) {
      selectedType = found;
      selectedFamily = family;
      break;
    }
  }

  if (treeQuery.isPending) {
    return (
      <section className="taxonomy-picker taxonomy-picker-loading" aria-busy="true">
        <div className="taxonomy-picker-skeleton" />
        <div className="taxonomy-picker-skeleton" />
        <div className="taxonomy-picker-skeleton is-short" />
        <span className="sr-only">Cargando taxonomías disponibles</span>
      </section>
    );
  }

  if (treeQuery.isError) {
    return (
      <section className="taxonomy-picker taxonomy-picker-state" role="alert">
        <WarningCircle size={25} weight="duotone" />
        <div>
          <strong>No se pudo cargar la estructura de clasificación</strong>
          <p>Revisa la conexión antes de continuar con la clasificación.</p>
        </div>
        <button
          className="button button-secondary"
          type="button"
          onClick={() => treeQuery.refetch()}
        >
          <ArrowsClockwise /> Reintentar
        </button>
      </section>
    );
  }

  const totalResults = filteredFamilies.reduce((sum, f) => sum + f.types.length, 0);

  return (
    <section className={`taxonomy-picker ${error ? "has-error" : ""}`}>
      <label className="taxonomy-picker-search" htmlFor={searchId}>
        <span>Buscar taxonomía por familia, prefijo o nombre</span>
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

      {selectedType && selectedFamily && (
        <article className="taxonomy-selected-summary" aria-live="polite">
          <CheckCircle size={23} weight="fill" />
          <div>
            <span>Clasificación seleccionada</span>
            <strong>
              <code>{selectedType.prefix}</code> — {selectedType.name}
            </strong>
            <small>
              Familia: {selectedFamily.name}
            </small>
          </div>
        </article>
      )}

      <fieldset
        className="taxonomy-picker-results taxonomy-tree-picker"
        aria-describedby={error ? `${groupId}-error` : undefined}
      >
        <legend id={groupId}>
          {totalResults} {totalResults === 1 ? "tipo encontrado" : "tipos encontrados"}
        </legend>
        
        <div className="taxonomy-picker-tree">
          {filteredFamilies.map((family) => {
            const isExpanded = normalizedQuery ? true : expandedFamilies[family.id] !== false;
            
            return (
              <div key={family.id} className="taxonomy-picker-family">
                <button
                  type="button"
                  className="taxonomy-picker-family-header"
                  onClick={() => toggleFamily(family.id)}
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? <CaretDown /> : <CaretRight />}
                  <strong>{family.name}</strong>
                  <small>({family.types.length})</small>
                </button>
                
                {isExpanded && (
                  <div className="taxonomy-picker-family-types">
                    {family.types.map((type: any) => (
                      <label
                        key={type.id}
                        className={`taxonomy-option ${selectedId === type.id ? "is-selected" : ""}`}
                      >
                        <input
                          type="radio"
                          name="asset-taxonomy"
                          value={type.id}
                          checked={selectedId === type.id}
                          onChange={() => onSelect(type)}
                        />
                        <span className="taxonomy-option-prefix">{type.prefix}</span>
                        <span>
                          <strong>{type.name}</strong>
                        </span>
                        <Tag size={18} aria-hidden="true" />
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </fieldset>

      {!filteredFamilies.length && (
        <div className="taxonomy-picker-empty">
          <Tag size={24} />
          <strong>No hay coincidencias</strong>
          <p>
            Prueba con otra búsqueda o <Link to="/administracion/taxonomia" target="_blank" style={{ fontWeight: 500, color: "var(--primary)", textDecoration: "underline" }}>configura la taxonomía en Administración</Link>.
          </p>
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
