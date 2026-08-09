import {
  PlusCircle,
  Trash,
  WarningDiamond,
  Package,
  Check,
  Spinner,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { getMaterialesHijas, listMateriales } from "@/modules/almacen/catalogoRepository";
import { Combobox } from "@/modules/almacen/components/shared/Combobox";
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

  // Piezas hijas del material seleccionado (vacío si no es un estuche/contenedor)
  const [hijas, setHijas] = useState<Material[]>([]);
  const [modo, setModo] = useState<"completo" | "piezas">("completo");
  const [hijaForms, setHijaForms] = useState<
    Record<
      number,
      { cantidad: number; tipo: "USADO" | "NECESARIO_NO_BLOQUEANTE"; porcentajeRequerido: number | "" }
    >
  >({});
  const [savingHijaId, setSavingHijaId] = useState<number | null>(null);

  useEffect(() => {
    void listWorkOrderMateriales(workOrderId).then((data) => {
      setMateriales(data);
      setLoading(false);
    });
    void listMateriales({}).then(setCatalogo);
  }, [workOrderId]);

  // Cada vez que cambia el material elegido, revisa si tiene piezas hijas
  useEffect(() => {
    if (!form.material) {
      setHijas([]);
      setModo("completo");
      return;
    }
    void getMaterialesHijas(Number(form.material)).then((data) => {
      setHijas(data);
      setModo("completo");
      setHijaForms(
        Object.fromEntries(
          data.map((h) => [h.id, { cantidad: 1, tipo: "USADO" as const, porcentajeRequerido: "" as const }]),
        ),
      );
    });
  }, [form.material]);

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
      setHijas([]);
      setModo("completo");
    } catch {
      setError("No se pudo registrar el material. Verifica el stock disponible.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddHija(hijaMaterialId: number) {
    const hijaForm = hijaForms[hijaMaterialId] ?? { cantidad: 1, tipo: "USADO" as const, porcentajeRequerido: "" as const };
    setSavingHijaId(hijaMaterialId);
    setError("");
    try {
      const added = await addWorkOrderMaterial(workOrderId, {
        material: hijaMaterialId,
        cantidad: hijaForm.cantidad,
        tipo: hijaForm.tipo,
        porcentajeRequerido:
          hijaForm.tipo === "NECESARIO_NO_BLOQUEANTE" && hijaForm.porcentajeRequerido !== ""
            ? Number(hijaForm.porcentajeRequerido)
            : null,
      });
      setMateriales((prev) => [...prev, added]);
      setHijaForms((prev) => ({
        ...prev,
        [hijaMaterialId]: { cantidad: 1, tipo: "USADO", porcentajeRequerido: "" },
      }));
    } catch {
      setError("No se pudo registrar esa pieza. Verifica el stock disponible.");
    } finally {
      setSavingHijaId(null);
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
            <Combobox
              value={form.material === "" ? 0 : Number(form.material)}
              selectedLabel={
                selectedMaterial
                  ? `${selectedMaterial.nombre}${selectedMaterial.marca ? ` · ${selectedMaterial.marca}` : ""} (Stock: ${selectedMaterial.cantidad_total})`
                  : ""
              }
              placeholder="Buscar por nombre, código o marca…"
              onChange={(id) => setForm({ ...form, material: id })}
              fetchOptions={async (q) => {
                const res = await listMateriales({ q });
                return res.map((c) => ({
                  id: c.id,
                  label: `${c.nombre}${c.marca ? ` · ${c.marca}` : ""}`,
                  sublabel: `Stock: ${c.cantidad_total}`,
                }));
              }}
            />
            {selectedMaterial && (
              <small style={{ color: "var(--muted)" }}>
                Código: {selectedMaterial.codigo} · Precio ref: {selectedMaterial.precio ? `S/ ${selectedMaterial.precio}` : "Sin precio"}
              </small>
            )}
          </label>

          {/* Solo se muestra el resto del formulario si es estuche completo, o si el material no tiene piezas hijas */}
          {modo === "completo" && (
            <>
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
            </>
          )}
        </form>
      )}

      {/* Si el material elegido tiene piezas hijas, deja elegir entre llevar todo o desglosar */}
      {!isOtClosed && hijas.length > 0 && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            borderRadius: 8,
            border: "1px dashed var(--border, #e5e7eb)",
            background: "var(--surface-raised, #f9fafb)",
          }}
        >
          <div style={{ display: "flex", gap: 16, marginBottom: modo === "piezas" ? 12 : 0, fontSize: 13 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input
                type="radio"
                name="modo-estuche"
                checked={modo === "completo"}
                onChange={() => setModo("completo")}
              />
              Llevar el estuche completo
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <input
                type="radio"
                name="modo-estuche"
                checked={modo === "piezas"}
                onChange={() => setModo("piezas")}
              />
              Elegir piezas específicas ({hijas.length} tipos disponibles)
            </label>
          </div>

          {modo === "piezas" && (
            <div style={{ display: "grid", gap: 8 }}>
              {hijas.map((h) => {
                const hf = hijaForms[h.id] ?? { cantidad: 1, tipo: "USADO" as const, porcentajeRequerido: "" as const };
                return (
                  <div
                    key={h.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 10px",
                      borderRadius: 6,
                      background: "var(--surface, #fff)",
                      border: "1px solid var(--border, #e5e7eb)",
                      fontSize: 13,
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ flex: 1, minWidth: 140 }}>
                      {h.nombre} <span style={{ color: "var(--muted)" }}>(Stock: {h.cantidad_total})</span>
                    </span>

                    <input
                      type="number"
                      min={1}
                      max={h.cantidad_total || undefined}
                      value={hf.cantidad}
                      onChange={(e) =>
                        setHijaForms((prev) => ({
                          ...prev,
                          [h.id]: { ...hf, cantidad: Math.max(1, Number(e.target.value)) },
                        }))
                      }
                      style={{ width: 56, fontSize: 13, textAlign: "center" }}
                    />

                    <select
                      value={hf.tipo}
                      onChange={(e) =>
                        setHijaForms((prev) => ({
                          ...prev,
                          [h.id]: { ...hf, tipo: e.target.value as "USADO" | "NECESARIO_NO_BLOQUEANTE" },
                        }))
                      }
                      style={{ fontSize: 12, width: 150 }}
                    >
                      <option value="USADO">Usado</option>
                      <option value="NECESARIO_NO_BLOQUEANTE">Necesario (no bloqueante)</option>
                    </select>

                    {hf.tipo === "NECESARIO_NO_BLOQUEANTE" && (
                      <input
                        type="number"
                        min={0}
                        max={100}
                        placeholder="% req."
                        value={hf.porcentajeRequerido}
                        onChange={(e) =>
                          setHijaForms((prev) => ({
                            ...prev,
                            [h.id]: {
                              ...hf,
                              porcentajeRequerido: e.target.value !== "" ? Number(e.target.value) : "",
                            },
                          }))
                        }
                        style={{ width: 64, fontSize: 12, textAlign: "center" }}
                      />
                    )}

                    <button
                      type="button"
                      className="button button-secondary"
                      disabled={
                        savingHijaId === h.id ||
                        (hf.tipo === "USADO" && h.cantidad_total === 0) ||
                        (hf.tipo === "NECESARIO_NO_BLOQUEANTE" && hf.porcentajeRequerido === "")
                      }
                      onClick={() => void handleAddHija(h.id)}
                      style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, padding: "4px 8px" }}
                    >
                      <PlusCircle size={14} />
                      {savingHijaId === h.id ? "..." : "Agregar"}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}