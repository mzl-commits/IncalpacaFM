import { useEffect, useRef } from "react";
import type { PiezaBase } from "@/modules/almacen/types";

// ─── Grupo estuche + piezas hijas para el selector de lote ────────────────────
// Muestra el estuche como encabezado con su código, un checkbox "Todas las
// disponibles (N)" y cada pieza hija con su propio checkbox (selección parcial
// permitida).
export function EstucheGroup({
  padre, hijas, piezasLote, togglePieza, toggleTodas,
}: {
  padre: PiezaBase;
  hijas: PiezaBase[];
  piezasLote: Set<number>;
  togglePieza: (id: number) => void;
  toggleTodas: (hijas: PiezaBase[]) => void;
}) {
  const hijasDisponibles = hijas.filter((h) => h.estado === "Disponible");
  const disponibles = hijasDisponibles.length;
  // Solo cuentan para "todas marcadas" las piezas realmente seleccionables
  // (Disponible). Prestado/Mantenimiento se muestran atenuadas y no se
  // consideran en el estado del checkbox maestro.
  const seleccionadas = hijasDisponibles.filter((h) => piezasLote.has(h.id)).length;
  const todasMarcadas = disponibles > 0 && seleccionadas === disponibles;
  const algunasMarcadas = seleccionadas > 0 && !todasMarcadas;

  const selectAllRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = algunasMarcadas;
  }, [algunasMarcadas]);

  return (
    <div className="estuche-group">
      <div className="estuche-header">
        <span className="pieza-code">{padre.codigo}</span> — {padre.material_nombre}
        <span className="estuche-badge">Estuche · {disponibles}/{hijas.length} disponibles</span>
        <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 8 }}>{padre.estado}</span>
      </div>

      <label className={`pieza-checkbox-row select-all-row${disponibles === 0 ? " is-disabled" : ""}`}>
        <input
          ref={selectAllRef}
          type="checkbox"
          checked={todasMarcadas}
          disabled={disponibles === 0}
          onChange={() => toggleTodas(hijasDisponibles)}
        />
        <span><strong>Todas las disponibles ({disponibles})</strong></span>
      </label>

      <div className="estuche-hijas">
        {hijas.map((h) => {
          const seleccionable = h.estado === "Disponible";
          return (
            <label
              key={h.id}
              className={`pieza-checkbox-row pieza-hija-row${seleccionable ? "" : " is-disabled"}`}
            >
              <input
                type="checkbox"
                checked={piezasLote.has(h.id)}
                disabled={!seleccionable}
                onChange={() => togglePieza(h.id)}
              />
              <span className="pieza-code">{h.codigo}</span>
              <span style={{ fontSize: 13 }}>
                {h.material_nombre}{h.detalle ? ` — ${h.detalle}` : ""}
              </span>
              <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: "auto" }}>{h.estado}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}