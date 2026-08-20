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
    <div className="combobox" ref={containerRef} style={{ position: "relative" }}>
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
        <div
          id="combobox-options"
          role="listbox"
          className="combobox-panel"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            right: 0,
            zIndex: 9999,
            background: "#ffffff",
            opacity: 1,
            border: "1px solid var(--border, #d1d5db)",
            borderRadius: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
            maxHeight: 260,
            overflowY: "auto",
          }}
        >
          {loading && <div className="combobox-message" style={{ padding: "10px 12px", background: "#ffffff" }}>Buscando…</div>}
          {!loading && options.length === 0 && (
            <div className="combobox-message" style={{ padding: "10px 12px", background: "#ffffff" }}>
              {debounced ? "Sin resultados." : "Escribe para buscar…"}
            </div>
          )}
          {!loading && options.map((option) => (
            <button
              type="button"
              key={option.id}
              role="option"
              aria-selected={value === option.id}
              className="combobox-option"
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: "#ffffff",
                opacity: 1,
                padding: "8px 12px",
                border: "none",
                borderBottom: "1px solid #f0f0f0",
                cursor: "pointer",
              }}
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