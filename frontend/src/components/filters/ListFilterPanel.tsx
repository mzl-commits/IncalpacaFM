import { CaretDown, Funnel, MagnifyingGlass, X } from "@phosphor-icons/react";
import { useId, useState, type ReactNode } from "react";

export type FilterOption = {
  value: string;
  label: string;
  count?: number;
};

export type ActiveFilter = {
  key: string;
  label: string;
  value: string;
  onRemove: () => void;
};

export type QuickFilter = {
  key: string;
  label: string;
  active: boolean;
  onSelect: () => void;
  count?: number;
};

type ListFilterPanelProps = {
  title: string;
  description: string;
  searchLabel: string;
  searchPlaceholder: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  resultCount: number;
  totalCount: number;
  activeFilters: ActiveFilter[];
  onClear: () => void;
  quickFilters?: QuickFilter[];
  children: ReactNode;
};

type FilterSelectProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  allLabel: string;
  disabled?: boolean;
};

type FilterDateProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
};

export function ListFilterPanel({
  title,
  description,
  searchLabel,
  searchPlaceholder,
  searchValue,
  onSearchChange,
  resultCount,
  totalCount,
  activeFilters,
  onClear,
  quickFilters = [],
  children,
}: ListFilterPanelProps) {
  const searchId = useId();
  const advancedId = useId();
  const [expanded, setExpanded] = useState(false);
  const activeCount = activeFilters.length;

  return (
    <section
      className={`list-filter-panel ${expanded ? "is-expanded" : ""}`}
      aria-labelledby={`${advancedId}-title`}
    >
      <header className="list-filter-heading">
        <div className="list-filter-title">
          <span className="list-filter-title-icon">
            <Funnel size={19} weight="duotone" aria-hidden="true" />
          </span>
          <span>
            <strong id={`${advancedId}-title`}>{title}</strong>
            <small>{description}</small>
          </span>
        </div>

        <p className="list-filter-results" aria-live="polite" aria-atomic="true">
          <strong>{resultCount}</strong>
          <span>{resultCount === totalCount ? "resultados" : `de ${totalCount} resultados`}</span>
        </p>
      </header>

      <form className="list-filter-form" role="search" onSubmit={(event) => event.preventDefault()}>
        <div className="list-filter-search-row">
          <label className="list-filter-search" htmlFor={searchId}>
            <span>{searchLabel}</span>
            <span className="list-filter-control">
              <MagnifyingGlass size={19} aria-hidden="true" />
              <input
                id={searchId}
                type="search"
                value={searchValue}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder={searchPlaceholder}
              />
            </span>
          </label>

          <button
            className="list-filter-toggle"
            type="button"
            aria-expanded={expanded}
            aria-controls={advancedId}
            aria-label={`${expanded ? "Ocultar" : "Mostrar"} filtros avanzados${
              activeCount > 0 ? `, ${activeCount} activos` : ""
            }`}
            onClick={() => setExpanded((current) => !current)}
          >
            <Funnel size={18} aria-hidden="true" />
            <span>{expanded ? "Ocultar filtros" : "Filtros"}</span>
            {activeCount > 0 && <strong aria-hidden="true">{activeCount}</strong>}
            <CaretDown size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="list-filter-advanced" id={advancedId}>
          {quickFilters.length > 0 && (
            <div className="list-filter-quick" aria-label="Vistas rápidas">
              <span>Vistas rápidas</span>
              <div>
                {quickFilters.map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    aria-pressed={filter.active}
                    onClick={filter.onSelect}
                  >
                    <span>{filter.label}</span>
                    {typeof filter.count === "number" && <strong>{filter.count}</strong>}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="list-filter-fields">{children}</div>
        </div>

        {activeFilters.length > 0 && (
          <footer className="list-filter-active">
            <div>
              <span className="list-filter-active-label">Filtros activos</span>
              <div className="list-filter-chips">
                {activeFilters.map((filter) => (
                  <button
                    key={filter.key}
                    type="button"
                    onClick={filter.onRemove}
                    aria-label={`Quitar filtro ${filter.label}: ${filter.value}`}
                  >
                    <span>
                      {filter.label}: <strong>{filter.value}</strong>
                    </span>
                    <X size={14} weight="bold" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>

            <button className="list-filter-clear" type="button" onClick={onClear}>
              Restablecer filtros
            </button>
          </footer>
        )}
      </form>
    </section>
  );
}

export function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
  disabled = false,
}: FilterSelectProps) {
  const id = useId();

  return (
    <label className={`list-filter-field ${value ? "is-active" : ""}`} htmlFor={id}>
      <span>{label}</span>
      <span className="list-filter-select">
        <select
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        >
          <option value="">{allLabel}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
              {typeof option.count === "number" ? ` · ${option.count}` : ""}
            </option>
          ))}
        </select>
        <CaretDown size={15} aria-hidden="true" />
      </span>
    </label>
  );
}

export function FilterDate({ label, value, onChange, min, max }: FilterDateProps) {
  const id = useId();

  return (
    <label className={`list-filter-field ${value ? "is-active" : ""}`} htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
