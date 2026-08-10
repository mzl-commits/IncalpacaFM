import { useEffect, useRef, useState } from "react";

export interface ComboboxOption {
  id: number;
  label: string;
  sublabel?: string;
}

interface ComboboxProps {
  value: number;
  selectedLabel?: string; // texto a mostrar cuando hay selección y no se está escribiendo
  onChange: (id: number) => void;
  fetchOptions: (query: string) => Promise<ComboboxOption[]>;
  placeholder?: string;
  disabled?: boolean;
}

export function Combobox({
  value, selectedLabel, onChange, fetchOptions, placeholder, disabled,
}: ComboboxProps) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<ComboboxOption[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoading(true);
    fetchOptions(debounced)
      .then((res) => { if (active) setOptions(res); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [debounced, open, fetchOptions]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div className="combobox" ref={containerRef} style={{ position: "relative" }}>
      <input
        type="text"
        disabled={disabled}
        placeholder={placeholder ?? "Buscar…"}
        value={open ? query : (value ? selectedLabel ?? "" : query)}
        onFocus={() => { setOpen(true); setQuery(""); }}
        onChange={(e) => setQuery(e.target.value)}
      />
      {open && (
        <div
          className="combobox-panel"
          style={{
            position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20,
            background: "#fff", border: "1px solid var(--border, #dfe6ef)",
            borderRadius: 8, maxHeight: 240, overflowY: "auto", marginTop: 4,
            boxShadow: "0 4px 12px rgba(0,0,0,.08)",
          }}
        >
          {loading && (
            <div style={{ padding: 8, fontSize: 13, color: "var(--muted)" }}>Buscando…</div>
          )}
          {!loading && options.length === 0 && (
            <div style={{ padding: 8, fontSize: 13, color: "var(--muted)" }}>
              {debounced ? "Sin resultados." : "Escribe para buscar…"}
            </div>
          )}
          {!loading && options.map((opt) => (
            <button
              type="button"
              key={opt.id}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "8px 10px", border: "none", background: "transparent", cursor: "pointer",
              }}
              onClick={() => { onChange(opt.id); setQuery(""); setOpen(false); }}
            >
              {opt.label}
              {opt.sublabel && (
                <span style={{ color: "var(--muted)", marginLeft: 6, fontSize: 12 }}>{opt.sublabel}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}