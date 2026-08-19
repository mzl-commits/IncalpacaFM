import { Check, Spinner, Warehouse, WarningDiamond } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import {
  getAlmacenerosAutorizados,
  setAlmacenerosAutorizados,
  type AlmaceneroAutorizadoUsuario,
} from "@/modules/workorders/workOrderRepository";

interface Props {
  workOrderId: string;
}

export function AlmacenerosAutorizadosSection({ workOrderId }: Props) {
  const [disponibles, setDisponibles] = useState<AlmaceneroAutorizadoUsuario[]>([]);
  const [seleccionados, setSeleccionados] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setError("");
    getAlmacenerosAutorizados(workOrderId)
      .then((resp) => {
        if (cancelado) return;
        setDisponibles(resp.disponibles);
        setSeleccionados(new Set(resp.autorizados.map((u) => u.id)));
      })
      .catch(() => {
        if (!cancelado) setError("No se pudo cargar la lista de almaceneros.");
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [workOrderId]);

  function toggle(id: number) {
    setSaved(false);
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleGuardar() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await setAlmacenerosAutorizados(workOrderId, Array.from(seleccionados));
      setSaved(true);
    } catch {
      setError("No se pudo guardar la asignación. Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="detail-empty">
        <Spinner size={14} /> Cargando almaceneros…
      </p>
    );
  }

  if (disponibles.length === 0) {
    return (
      <p className="detail-empty">
        No hay usuarios con rol Almacenero registrados en el sistema.
      </p>
    );
  }

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <p style={{ fontSize: 13, color: "var(--muted)", margin: 0 }}>
        Marca qué almacenero(s) pueden ver y usar esta OT en el módulo de movimientos
        de inventario. Solo verán esta orden quienes estén seleccionados aquí.
      </p>

      {error && (
        <div className="form-error" style={{ marginBottom: 4 }}>
          <WarningDiamond size={13} /> {error}
        </div>
      )}

      <div style={{ display: "grid", gap: 6 }}>
        {disponibles.map((u) => (
          <label
            key={u.id}
            className="switch-row"
            style={{
              cursor: "pointer",
              padding: "8px 12px",
              borderRadius: 8,
              border: "1px solid var(--border, #e5e7eb)",
              background: seleccionados.has(u.id) ? "rgba(0,86,179,0.05)" : "var(--surface, #fff)",
            }}
          >
            <input
              type="checkbox"
              checked={seleccionados.has(u.id)}
              onChange={() => toggle(u.id)}
            />
            <span style={{ fontSize: 13 }}>
              <strong>{u.full_name}</strong>
              {u.worker_code && (
                <code style={{ fontSize: 11, marginLeft: 6, color: "var(--muted)" }}>{u.worker_code}</code>
              )}
            </span>
          </label>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          type="button"
          className="button button-primary"
          onClick={() => void handleGuardar()}
          disabled={saving}
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <Warehouse size={16} />
          {saving ? "Guardando…" : "Guardar asignación"}
        </button>
        {saved && !saving && (
          <span style={{ fontSize: 12, color: "var(--success, #16a34a)", display: "flex", alignItems: "center", gap: 4 }}>
            <Check size={13} /> Guardado
          </span>
        )}
      </div>
    </div>
  );
}