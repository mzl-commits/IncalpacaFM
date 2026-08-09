import {
  PlusCircle,
  Trash,
  WarningDiamond,
  Package,
  Check,
  Spinner,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { listMateriales } from "@/modules/almacen/catalogoRepository";
import type { Material } from "@/modules/almacen/types";
import {
  addWorkOrderMaterial,
  deleteWorkOrderMaterial,
  listWorkOrderMateriales,
  marcarMaterialBloqueante,
  updateWorkOrderMaterial,
  type WorkOrderMaterial,
} from "@/modules/workorders/workOrderMaterialRepository";

interface Props {
  workOrderId: string;
  isOtClosed: boolean;
}

export function MaterialesUsadosSection({ workOrderId, isOtClosed }: Props) {
  const [materiales, setMateriales] = useState<WorkOrderMaterial[]>([]);
  const [catalogo, setCatalogo] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState<{
    material: number | "";
    cantidad: number;
    tipo: "USADO" | "NECESARIO_NO_BLOQUEANTE";
    porcentajeRequerido: number | "";
  }>({ material: "", cantidad: 1, tipo: "USADO", porcentajeRequerido: "" });

  useEffect(() => {
    void listWorkOrderMateriales(workOrderId).then((data) => {
      setMateriales(data);
      setLoading(false);
    });
    void listMateriales({}).then(setCatalogo);
  }, [workOrderId]);

  async function handleAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!form.material) {
      setError("Selecciona un material.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const added = await addWorkOrderMaterial(workOrderId, {
        material: Number(form.material),
        cantidad: form.cantidad,
        tipo: form.tipo,
        porcentajeRequerido: form.tipo === "NECESARIO_NO_BLOQUEANTE" && form.porcentajeRequerido !== "" ? Number(form.porcentajeRequerido) : null,
      });
      setMateriales((prev) => [...prev, added]);
      setForm({ material: "", cantidad: 1, tipo: "USADO", porcentajeRequerido: "" });
    } catch {
      setError("No se pudo registrar el material. Verifica el stock disponible.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este material de la OT?")) return;
    try {
      await deleteWorkOrderMaterial(workOrderId, id);
      setMateriales((prev) => prev.filter((m) => m.id !== id));
    } catch {
      setError("No se pudo eliminar el material.");
    }
  }

  async function handleMarcarbloqueante(id: string) {
    try {
      const updated = await marcarMaterialBloqueante(workOrderId, id);
      setMateriales((prev) => prev.map((m) => (m.id === id ? updated : m)));
    } catch {
      setError("No se pudo marcar como bloqueante.");
    }
  }

  async function handleCantidadChange(id: string, nuevaCantidad: number) {
    const item = materiales.find((m) => m.id === id);
    if (!item) return;
    try {
      const updated = await updateWorkOrderMaterial(workOrderId, id, {
        material: item.material,
        cantidad: nuevaCantidad,
        tipo: item.tipo,
        porcentajeRequerido: item.porcentajeRequerido,
      });
      setMateriales((prev) => prev.map((m) => (m.id === id ? updated : m)));
    } catch {
      setError("No se pudo actualizar la cantidad.");
    }
  }

  const selectedMaterial = catalogo.find((c) => c.id === Number(form.material));

  return (
    <div className="form-section">
      <div className="section-heading">
        <div>
          <span className="section-number">3</span>
          <div>
            <h2>Materiales usados</h2>
            <p>Registra los materiales del almacén que utilizaste o que necesitas para continuar.</p>
          </div>
        </div>
      </div>

      {/* Error global */}
      {error && (
        <div className="form-error" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      {/* Lista de materiales ya registrados */}
      {loading ? (
        <p style={{ color: "var(--muted)", fontSize: 13 }}>
          <Spinner size={14} /> Cargando materiales…
        </p>
      ) : materiales.length > 0 ? (
        <div style={{ display: "grid", gap: 8, marginBottom: 16 }}>
          {materiales.map((m) => (
            <div
              key={m.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 14px",
                borderRadius: 8,
                border: m.esBloqueante
                  ? "1px solid var(--error, #dc2626)"
                  : "1px solid var(--border, #e5e7eb)",
                background: m.esBloqueante
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
                  {m.tipoLabel}
                  {m.tipo === "NECESARIO_NO_BLOQUEANTE" && m.porcentajeRequerido !== null && (
                    <span style={{ fontWeight: 600, color: "var(--brand-primary, #0056b3)", marginLeft: 6 }}>
                      (Requerido al {m.porcentajeRequerido}% de avance)
                    </span>
                  )}
                  {" "}· Stock almacén: {m.materialStock}
                  {m.esBloqueante && (
                    <span style={{ color: "var(--error, #dc2626)", fontWeight: 600, marginLeft: 8 }}>
                      ⚠ Bloqueante — Administrador notificado
                    </span>
                  )}
                </div>
              </div>

              {/* Cantidad editable */}
              {!isOtClosed && (
                <input
                  type="number"
                  min={1}
                  value={m.cantidad}
                  onChange={(e) => void handleCantidadChange(m.id, Number(e.target.value))}
                  style={{ width: 64, fontSize: 13, textAlign: "center" }}
                />
              )}
              {isOtClosed && <span style={{ minWidth: 64, textAlign: "center" }}>{m.cantidad}</span>}

              {/* Marcar bloqueante */}
              {!isOtClosed && m.tipo === "NECESARIO_NO_BLOQUEANTE" && !m.esBloqueante && (
                <button
                  type="button"
                  title="Marcar como bloqueante — notifica al administrador"
                  onClick={() => void handleMarcarbloqueante(m.id)}
                  style={{
                    background: "none",
                    border: "1px solid var(--error, #dc2626)",
                    borderRadius: 6,
                    color: "var(--error, #dc2626)",
                    cursor: "pointer",
                    fontSize: 12,
                    padding: "3px 8px",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <WarningDiamond size={13} />
                  Marcar bloqueante
                </button>
              )}

              {m.esBloqueante && (
                <span
                  style={{
                    fontSize: 12,
                    color: "var(--error, #dc2626)",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Check size={13} /> Notificado
                </span>
              )}

              {/* Eliminar */}
              {!isOtClosed && (
                <button
                  type="button"
                  onClick={() => void handleDelete(m.id)}
                  style={{ background: "none", border: 0, cursor: "pointer", color: "var(--muted)", padding: 4 }}
                  title="Eliminar material"
                >
                  <Trash size={16} />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 13, color: "var(--muted)", marginBottom: 16, fontStyle: "italic" }}>
          Sin materiales registrados en esta OT.
        </p>
      )}

      {/* Formulario para agregar */}
      {!isOtClosed && (
        <form
          onSubmit={(e) => void handleAdd(e)}
          style={{
            display: "grid",
            gridTemplateColumns: form.tipo === "NECESARIO_NO_BLOQUEANTE" ? "1fr 80px 180px 100px auto" : "1fr 80px 180px auto",
            gap: 8,
            alignItems: "end",
          }}
        >
          <label className="field">
            <span>Material del almacén</span>
            <select
              value={form.material}
              onChange={(e) => setForm({ ...form, material: e.target.value ? Number(e.target.value) : "" })}
              required
            >
              <option value="">— Seleccionar —</option>
              {catalogo.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                  {c.marca ? ` · ${c.marca}` : ""}
                  {" "}(Stock: {c.cantidad_total})
                </option>
              ))}
            </select>
            {selectedMaterial && (
              <small style={{ color: "var(--muted)" }}>
                Código: {selectedMaterial.codigo} · Precio ref: {selectedMaterial.precio ? `S/ ${selectedMaterial.precio}` : "Sin precio"}
              </small>
            )}
          </label>

          <label className="field">
            <span>Cant.</span>
            <input
              type="number"
              min={1}
              value={form.cantidad}
              onChange={(e) => setForm({ ...form, cantidad: Math.max(1, Number(e.target.value)) })}
              required
            />
          </label>

          <label className="field">
            <span>Estado de uso</span>
            <select
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value as typeof form.tipo })}
            >
              <option value="USADO">Usado</option>
              <option value="NECESARIO_NO_BLOQUEANTE">Necesario (no bloqueante aún)</option>
            </select>
          </label>

          {form.tipo === "NECESARIO_NO_BLOQUEANTE" && (
            <label className="field">
              <span>% Requerido</span>
              <input
                type="number"
                min={0}
                max={100}
                value={form.porcentajeRequerido}
                onChange={(e) => setForm({ ...form, porcentajeRequerido: e.target.value !== "" ? Number(e.target.value) : "" })}
                placeholder="Ej. 50"
                required
              />
            </label>
          )}

          <button
            className="button button-secondary"
            type="submit"
            disabled={saving}
            style={{ alignSelf: "end", display: "flex", alignItems: "center", gap: 6 }}
          >
            <PlusCircle size={16} />
            {saving ? "Guardando…" : "Agregar"}
          </button>
        </form>
      )}
    </div>
  );
}
