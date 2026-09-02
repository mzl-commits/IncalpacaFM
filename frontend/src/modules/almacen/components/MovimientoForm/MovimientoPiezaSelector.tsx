import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listPiezas } from '@/modules/almacen/catalogoRepository';
import { Combobox } from '../shared/Combobox';
import type { RenglonMovimiento } from './MovimientoFormUtils';

function PiezaPickerRenglon({
  tipo,
  materialId,
  renglon,
  onUpdate,
}: {
  tipo: "salida" | "entrada";
  materialId: number;
  renglon: RenglonMovimiento;
  onUpdate: (patch: Partial<RenglonMovimiento>) => void;
}) {
  const { data: piezasDisponibles = [] } = useQuery({
    queryKey: ["piezas-renglon-disponible", materialId],
    queryFn: () => listPiezas({ material: materialId, estado: "Disponible", sin_padre: true }),
    enabled: tipo === "salida" && !!materialId,
  });
  const { data: piezasPrestadasRaw = [] } = useQuery({
    queryKey: ["piezas-renglon-prestado", materialId],
    queryFn: () => listPiezas({ material: materialId, estado: "Prestado" }),
    enabled: tipo === "entrada" && !!materialId,
  });
  const piezasPrestadas = piezasPrestadasRaw.filter((p) => !p.tiene_hijas);
  const piezasSueltas = piezasDisponibles.filter((p) => !p.tiene_hijas);
  const estuches = piezasDisponibles.filter((p) => p.tiene_hijas);
  const estuche = estuches.find((e) => e.id === renglon.estuchePiezaId);

  const { data: hijasDisponibles = [] } = useQuery({
    queryKey: ["piezas-hijas-renglon", renglon.estuchePiezaId],
    queryFn: () => listPiezas({ padre: renglon.estuchePiezaId, estado: "Disponible" }),
    enabled: tipo === "salida" && renglon.estuchePiezaId > 0,
  });

  // Si el material no tiene piezas sueltas (todas están dentro de estuches),
  // "sueltas" es un callejón sin salida — cambiamos automáticamente a "estuche"
  // para que el usuario no se quede viendo "No hay piezas sueltas disponibles".
  useEffect(() => {
    if (tipo === "salida" && renglon.modoPieza === "sueltas" && piezasSueltas.length === 0 && estuches.length > 0) {
      onUpdate({ modoPieza: "estuche" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipo, renglon.modoPieza, piezasSueltas.length, estuches.length]);

  function togglePieza(id: number) {
    const next = new Set(renglon.piezasSeleccionadas);
    next.has(id) ? next.delete(id) : next.add(id);
    onUpdate({ piezasSeleccionadas: next });
  }

  function toggleHija(id: number) {
    const next = new Set(renglon.estucheHijasSeleccionadas);
    next.has(id) ? next.delete(id) : next.add(id);
    onUpdate({ estucheHijasSeleccionadas: next });
  }

  if (tipo === "entrada") {
    if (piezasPrestadas.length === 0) {
      return <p style={{ fontSize: 12, color: "var(--muted)", margin: "6px 0 0" }}>No hay piezas prestadas de este material.</p>;
    }
    return (
      <div className="pieza-multiselect" style={{ marginTop: 8 }}>
        <label className="pieza-checkbox-row">
          <input
            type="checkbox"
            checked={renglon.piezasSeleccionadas.size === piezasPrestadas.length}
            onChange={(e) =>
              onUpdate({ piezasSeleccionadas: e.target.checked ? new Set(piezasPrestadas.map((p) => p.id)) : new Set() })
            }
          />
          <strong style={{ fontSize: 13 }}>Todas las prestadas ({piezasPrestadas.length})</strong>
        </label>
        {piezasPrestadas.map((p) => (
          <label key={p.id} className="pieza-checkbox-row">
            <input type="checkbox" checked={renglon.piezasSeleccionadas.has(p.id)} onChange={() => togglePieza(p.id)} />
            <span className="pieza-code">{p.codigo}</span>
            {p.detalle && <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 4 }}>— {p.detalle}</span>}
          </label>
        ))}
      </div>
    );
  }

  // tipo === "salida"
  if (piezasSueltas.length === 0 && estuches.length === 0) {
    return <p style={{ fontSize: 12, color: "var(--muted)", margin: "6px 0 0" }}>No hay piezas disponibles de este material.</p>;
  }

  return (
    <div style={{ marginTop: 8 }}>
      {estuches.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <button
            type="button"
            className={renglon.modoPieza === "sueltas" ? "button button-secondary button-sm is-active" : "button button-ghost button-sm"}
            style={{ fontSize: 12 }}
            onClick={() => onUpdate({ modoPieza: "sueltas", estuchePiezaId: 0, estucheHijasSeleccionadas: new Set() })}
          >
            Piezas sueltas
          </button>
          <button
            type="button"
            className={renglon.modoPieza === "estuche" ? "button button-secondary button-sm is-active" : "button button-ghost button-sm"}
            style={{ fontSize: 12 }}
            onClick={() => onUpdate({ modoPieza: "estuche", piezasSeleccionadas: new Set() })}
          >
            Estuche completo
          </button>
        </div>
      )}

      {(renglon.modoPieza === "sueltas" || estuches.length === 0) ? (
        piezasSueltas.length === 0 ? (
          <p style={{ fontSize: 12, color: "var(--muted)" }}>
            No hay piezas sueltas disponibles{estuches.length > 0 ? " — este material está organizado en estuches, usa \"Estuche completo\"." : "."}
          </p>
        ) : (
          <PiezasSueltasSelector piezasSueltas={piezasSueltas} renglon={renglon} onUpdate={onUpdate} />
        )
      ) : (
        <div>
          <Combobox
            value={renglon.estuchePiezaId}
            selectedLabel={estuche ? `${estuche.codigo} — ${estuche.material_nombre ?? ""}` : ""}
            placeholder="Buscar estuche por código…"
            onChange={(id) => {
              // Cuando se selecciona un estuche, forzamos estucheTodasHijas: false
              // y pre-seleccionamos todas las hijas (el useEffect las cargará en hijasDisponibles).
              onUpdate({ estuchePiezaId: id, estucheTodasHijas: false, estucheHijasSeleccionadas: new Set() });
            }}
            fetchOptions={async (q) => {
              const res = await listPiezas({ material: materialId, estado: "Disponible", sin_padre: true, q });
              return res
                .filter((p) => p.tiene_hijas)
                .map((p) => ({ id: p.id, label: `${p.codigo} — ${p.material_nombre ?? ""}` }));
            }}
          />
          {renglon.estuchePiezaId > 0 && (
            <div style={{ marginTop: 8 }}>
              {hijasDisponibles.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--muted)" }}>No hay items disponibles en este estuche.</p>
              ) : (
                <AutoSelectEstucheHijas
                  hijasDisponibles={hijasDisponibles}
                  renglon={renglon}
                  onUpdate={onUpdate}
                  toggleHija={toggleHija}
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Componente auxiliar que auto-selecciona todas las hijas disponibles al
// montar y permite desmarcar individualmente las que no se vayan a mover.
function AutoSelectEstucheHijas({
  hijasDisponibles,
  renglon,
  onUpdate,
  toggleHija,
}: {
  hijasDisponibles: Array<{ id: number; codigo: string | null; material_nombre?: string | null; material_medida?: string | null; detalle?: string | null }>;
  renglon: RenglonMovimiento;
  onUpdate: (patch: Partial<RenglonMovimiento>) => void;
  toggleHija: (id: number) => void;
}) {
  const hijasIds = hijasDisponibles.map((h) => h.id).join(",");

  // Pre-marcar todas las hijas disponibles al cargar / cambiar el listado
  useEffect(() => {
    onUpdate({ estucheTodasHijas: false, estucheHijasSeleccionadas: new Set(hijasDisponibles.map((h) => h.id)) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hijasIds]);

  const selAll = renglon.estucheHijasSeleccionadas.size === hijasDisponibles.length;
  const selNone = renglon.estucheHijasSeleccionadas.size === 0;

  return (
    <div className="pieza-multiselect">
      <label className="pieza-checkbox-row">
        <input
          type="checkbox"
          checked={selAll}
          ref={(el) => { if (el) el.indeterminate = !selAll && !selNone; }}
          onChange={() =>
            onUpdate({
              estucheHijasSeleccionadas: selAll ? new Set() : new Set(hijasDisponibles.map((h) => h.id)),
            })
          }
        />
        <strong style={{ fontSize: 13 }}>Todas las disponibles ({hijasDisponibles.length})</strong>
      </label>
      {hijasDisponibles.map((h) => (
        <label key={h.id} className="pieza-checkbox-row" style={{ marginLeft: 24 }}>
          <input type="checkbox" checked={renglon.estucheHijasSeleccionadas.has(h.id)} onChange={() => toggleHija(h.id)} />
          <span className="pieza-code" style={{ fontSize: 13 }}>{h.codigo}</span>
          {(h.material_nombre || h.material_medida) && (
            <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 4 }}>
              {[h.material_nombre, h.material_medida].filter(Boolean).join(" · ")}
            </span>
          )}
          {h.detalle && (
            <span style={{ fontSize: 12, color: "var(--text)", marginLeft: 4 }}>— {h.detalle}</span>
          )}
        </label>
      ))}
    </div>
  );
}

// Selector de piezas sueltas para UN renglón de salida. La mayoría de las
// veces cualquier pieza suelta sirve igual (rara vez varían en detalle o
// medida), así que por defecto solo se pide una cantidad y se auto-eligen
// las primeras N disponibles. Si el usuario necesita una pieza puntual
// (por su detalle/medida/código), puede desplegar la lista y elegirla.
function PiezasSueltasSelector({
  piezasSueltas,
  renglon,
  onUpdate,
}: {
  piezasSueltas: Array<{ id: number; codigo: string | null; detalle?: string | null }>;
  renglon: RenglonMovimiento;
  onUpdate: (patch: Partial<RenglonMovimiento>) => void;
}) {
  const [modoSeleccion, setModoSeleccion] = useState<"cantidad" | "especifica">("cantidad");
  const [cantidadDeseada, setCantidadDeseada] = useState(1);
  const idsDisponibles = piezasSueltas.map((p) => p.id).join(",");

  // Mientras estamos en modo "cantidad", mantenemos la selección sincronizada
  // tomando las primeras N piezas sueltas disponibles.
  useEffect(() => {
    if (modoSeleccion !== "cantidad") return;
    const n = Math.min(Math.max(cantidadDeseada, 1), piezasSueltas.length);
    onUpdate({ piezasSeleccionadas: new Set(piezasSueltas.slice(0, n).map((p) => p.id)) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoSeleccion, cantidadDeseada, idsDisponibles]);

  if (modoSeleccion === "especifica") {
    return (
      <div className="pieza-multiselect">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <strong style={{ fontSize: 13 }}>Elegir piezas específicas</strong>
          <button
            type="button"
            style={{ background: "transparent", border: 0, color: "var(--accent, #6366f1)", cursor: "pointer", fontSize: 12 }}
            onClick={() => {
              setModoSeleccion("cantidad");
              setCantidadDeseada(Math.max(renglon.piezasSeleccionadas.size, 1));
            }}
          >
            ← Volver a cantidad
          </button>
        </div>
        <label className="pieza-checkbox-row">
          <input
            type="checkbox"
            checked={renglon.piezasSeleccionadas.size === piezasSueltas.length}
            onChange={(e) =>
              onUpdate({ piezasSeleccionadas: e.target.checked ? new Set(piezasSueltas.map((p) => p.id)) : new Set() })
            }
          />
          <strong style={{ fontSize: 13 }}>Todas las sueltas ({piezasSueltas.length})</strong>
        </label>
        {piezasSueltas.map((p) => (
          <label key={p.id} className="pieza-checkbox-row">
            <input
              type="checkbox"
              checked={renglon.piezasSeleccionadas.has(p.id)}
              onChange={() => {
                const next = new Set(renglon.piezasSeleccionadas);
                next.has(p.id) ? next.delete(p.id) : next.add(p.id);
                onUpdate({ piezasSeleccionadas: next });
              }}
            />
            <span className="pieza-code">{p.codigo}</span>
            {p.detalle && <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: 4 }}>{p.detalle}</span>}
          </label>
        ))}
      </div>
    );
  }

  const seleccionadas = piezasSueltas.filter((p) => renglon.piezasSeleccionadas.has(p.id));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}>
          Cantidad
          <input
            type="number"
            min={1}
            max={piezasSueltas.length}
            value={cantidadDeseada}
            onChange={(e) =>
              setCantidadDeseada(Math.max(1, Math.min(piezasSueltas.length, Number(e.target.value) || 1)))
            }
            style={{ width: 56, padding: "4px 8px", fontSize: 13, borderRadius: 6, border: "1px solid var(--border, #d1d5db)" }}
          />
        </label>
        <span style={{ fontSize: 12, color: "var(--muted)" }}>de {piezasSueltas.length} disponibles</span>
        <button
          type="button"
          style={{ background: "transparent", border: 0, color: "var(--accent, #6366f1)", cursor: "pointer", fontSize: 12, marginLeft: "auto" }}
          onClick={() => setModoSeleccion("especifica")}
        >
          Elegir una en específico
        </button>
      </div>
      {seleccionadas.length > 0 && (
        <span style={{ fontSize: 11, color: "var(--muted)" }}>
          Se usarán: {seleccionadas.map((p) => p.codigo ?? "—").join(", ")}
        </span>
      )}
    </div>
  );
}

import { listWorkOrderMateriales } from "@/modules/workorders/workOrderMaterialRepository";

