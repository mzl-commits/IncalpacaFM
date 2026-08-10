import { Check, Package, Spinner, WarningDiamond } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import {
  listWorkOrderMateriales,
  marcarMaterialAdquirido,
  type WorkOrderMaterial,
} from "@/modules/workorders/workOrderMaterialRepository";

interface Props {
  workOrderId: string;
  emptyMessage: string;
}

export function MaterialesOTAdminSection({ workOrderId, emptyMessage }: Props) {
  const [materiales, setMateriales] = useState<WorkOrderMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    void listWorkOrderMateriales(workOrderId)
      .then(setMateriales)
      .finally(() => setLoading(false));
  }, [workOrderId]);

  async function handleMarcarAdquirido(id: string) {
    setSavingId(id);
    setError("");
    try {
      const updated = await marcarMaterialAdquirido(workOrderId, id);
      setMateriales((prev) => prev.map((m) => (m.id === id ? updated : m)));
    } catch {
      setError("No se pudo marcar el material como adquirido.");
    } finally {
      setSavingId(null);
    }
  }

  if (loading) {
    return (
      <p className="detail-empty">
        <Spinner size={14} /> Cargando materiales…
      </p>
    );
  }

  if (materiales.length === 0) {
    return <p className="detail-empty">{emptyMessage}</p>;
  }

  return (
    <div style={{ display: "grid", gap: 8, marginBottom: 4 }}>
      {error && (
        <div className="form-error" style={{ marginBottom: 4 }}>
          {error}
        </div>
      )}
      {materiales.map((m) => (
        <div
          key={m.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 14px",
            borderRadius: 8,
            border: m.esBloqueante && !m.adquirido
              ? "1px solid var(--error, #dc2626)"
              : "1px solid var(--border, #e5e7eb)",
            background: m.esBloqueante && !m.adquirido
              ? "rgba(220,38,38,0.04)"
              : "var(--surface, #fff)",
            fontSize: 13,
          }}
        >
          <Package size={18} style={{ flexShrink: 0, color: "var(--muted)" }} />
          <div style={{ flex: 1 }}>
            <strong>{m.materialNombre}</strong>
            <code style={{ fontSize: 11, marginLeft: 6, color: "var(--muted)" }}>{m.materialCodigo}</code>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
              {m.tipoLabel} · Registrado por {m.registradoPorNombre} · Cantidad: {m.cantidad}
              {m.tipo === "NECESARIO_NO_BLOQUEANTE" && m.porcentajeRequerido !== null && (
                <span style={{ fontWeight: 600, color: "var(--brand-primary, #0056b3)", marginLeft: 6 }}>
                  (Requerido al {m.porcentajeRequerido}% de avance)
                </span>
              )}
            </div>
          </div>

          {m.esBloqueante && !m.adquirido && (
            <button
              type="button"
              onClick={() => void handleMarcarAdquirido(m.id)}
              disabled={savingId === m.id}
              style={{
                background: "var(--error, #dc2626)",
                border: 0,
                borderRadius: 6,
                color: "#fff",
                cursor: "pointer",
                fontSize: 12,
                padding: "5px 10px",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <WarningDiamond size={13} />
              {savingId === m.id ? "Guardando…" : "Marcar como adquirido"}
            </button>
          )}

          {m.esBloqueante && m.adquirido && (
            <span
              style={{
                fontSize: 12,
                color: "var(--success, #16a34a)",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Check size={13} /> Adquirido — técnico notificado
            </span>
          )}
        </div>
      ))}
    </div>
  );
}