import { useEffect, useRef, useState } from "react";

export interface ComboboxOption {
  id: number;
  label: string;
  sublabel?: string;
}

interface ComboboxProps {
  value: number;
  selectedLabel?: string;
  onChange: (id: number) => void;
  fetchOptions: (query: string) => Promise<ComboboxOption[]>;
  placeholder?: string;
  disabled?: boolean;
}

export function Combobox({ value, selectedLabel, onChange, fetchOptions, placeholder, disabled }: ComboboxProps) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ComboboxOption[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fetchOptionsRef = useRef(fetchOptions);

  // Los formularios suelen declarar fetchOptions en línea. Guardarla en una
  // referencia evita que cada render reinicie la búsqueda mientras el usuario
  // mueve el cursor por la lista.
  useEffect(() => {
    fetchOptionsRef.current = fetchOptions;
  }, [fetchOptions]);

  function closePanel() {
    setOpen(false);
    setQuery("");
    setDebounced("");
    setOptions([]);
  }

  function selectOption(option: ComboboxOption) {
    onChange(option.id);
    closePanel();
    // El input conservaba el foco tras escoger una opción. Eso hacía que el
    // siguiente clic alternara el panel de manera inestable en algunos
    // navegadores. Liberar el foco deja el selector listo para una nueva
    // búsqueda deliberada.
    requestAnimationFrame(() => inputRef.current?.blur());
  }

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    fetchOptionsRef.current(debounced)
      .then((result) => { if (active) setOptions(result); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [debounced, open]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) closePanel();
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="combobox" ref={containerRef}>
      <input
        ref={inputRef}
        type="text"
        disabled={disabled}
        placeholder={placeholder ?? "Buscar…"}
        value={open ? query : (value ? selectedLabel ?? "" : query)}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls="combobox-options"
        onFocus={() => { setOpen(true); setQuery(""); }}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            closePanel();
            inputRef.current?.blur();
          }
          if (event.key === "Enter" && options.length === 1) {
            event.preventDefault();
            selectOption(options[0]);
          }
        }}
      />
      {open && (
        <div id="combobox-options" role="listbox" className="combobox-panel">
          {loading && <div className="combobox-message">Buscando…</div>}
          {!loading && options.length === 0 && <div className="combobox-message">{debounced ? "Sin resultados." : "Escribe para buscar…"}</div>}
          {!loading && options.map((option) => (
            <button
              type="button"
              key={option.id}
              role="option"
              aria-selected={value === option.id}
              className="combobox-option"
              onPointerDown={(event) => {
                event.preventDefault();
                selectOption(option);
              }}
            >
              {option.label}
              {option.sublabel && <span>{option.sublabel}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
