import { Check, Package, Plus, Spinner, Trash, WarningDiamond, X } from "@phosphor-icons/react";
import { useEffect, useState } from "react";

import { listAlmacenes, listMateriales } from "@/modules/almacen/catalogoRepository";
import { Combobox } from "@/modules/almacen/components/shared/Combobox";
import type { Almacen, Material } from "@/modules/almacen/types";
import {
  addWorkOrderMaterial,
  deleteWorkOrderMaterial,
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

  // Formulario para que el Admin agregue materiales directamente
  const [showAddForm, setShowAddForm] = useState(false);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [almacenId, setAlmacenId] = useState<number | "">("");
  const [catalogo, setCatalogo] = useState<Material[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<number | "">("");
  const [cantidad, setCantidad] = useState(1);
  const [tipo, setTipo] = useState<"NECESARIO_NO_BLOQUEANTE" | "USADO">("NECESARIO_NO_BLOQUEANTE");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    void listWorkOrderMateriales(workOrderId)
      .then(setMateriales)
      .finally(() => setLoading(false));
  }, [workOrderId]);

  useEffect(() => {
    if (showAddForm && almacenes.length === 0) {
      void listAlmacenes().then((data) => {
        setAlmacenes(data);
        const activo = data.find((a) => a.activo) ?? data[0];
        if (activo) setAlmacenId(activo.id);
      });
    }
  }, [showAddForm, almacenes.length]);

  useEffect(() => {
    if (!almacenId) {
      setCatalogo([]);
      return;
    }
    void listMateriales(Number(almacenId)).then(setCatalogo);
    setSelectedMaterialId("");
  }, [almacenId]);

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

  async function handleDelete(id: string) {
    if (!confirm("¿Eliminar este material de la orden de trabajo?")) return;
    try {
      await deleteWorkOrderMaterial(workOrderId, id);
      setMateriales((prev) => prev.filter((m) => m.id !== id));
    } catch {
      setError("No se pudo eliminar el material.");
    }
  }

  async function handleAddMaterial(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedMaterialId) {
      setError("Selecciona un material del catálogo.");
      return;
    }
    setAdding(true);
    setError("");
    try {
      const added = await addWorkOrderMaterial(workOrderId, {
        material: Number(selectedMaterialId),
        cantidad,
        tipo,
        almacen: almacenId ? Number(almacenId) : null,
      });
      setMateriales((prev) => [...prev, added]);
      setSelectedMaterialId("");
      setCantidad(1);
      setShowAddForm(false);
    } catch {
      setError("No se pudo agregar el material. Verifica el stock disponible.");
    } finally {
      setAdding(false);
    }
  }

  const selectedMatObj = catalogo.find((c) => c.id === Number(selectedMaterialId));

  if (loading) {
    return (
      <p className="detail-empty">
        <Spinner size={14} /> Cargando materiales…
      </p>
    );
  }

  return (
    <div style={{ display: "grid", gap: 10, marginBottom: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong style={{ fontSize: 13 }}>Materiales y herramientas planificados</strong>
        <button
          type="button"
          className="button button-secondary button-sm"
          style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, padding: "4px 8px" }}
          onClick={() => setShowAddForm((prev) => !prev)}
        >
          {showAddForm ? <X size={14} /> : <Plus size={14} />}
          {showAddForm ? "Cancelar" : "Agregar material"}
        </button>
      </div>

      {error && (
        <div className="form-error" style={{ marginBottom: 4 }}>
          {error}
        </div>
      )}

      {showAddForm && (
        <form
          onSubmit={handleAddMaterial}
          style={{
            padding: 12,
            borderRadius: 8,
            border: "1px solid var(--border, #e5e7eb)",
            background: "var(--surface-raised, #f9fafb)",
            display: "grid",
            gap: 10,
          }}
        >
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 8 }}>
            <label className="field" style={{ margin: 0 }}>
              <span style={{ fontSize: 12 }}>Almacén</span>
              <select
                value={almacenId}
                onChange={(e) => setAlmacenId(e.target.value ? Number(e.target.value) : "")}
                style={{ fontSize: 13 }}
              >
                <option value="">Selecciona almacén…</option>
                {almacenes.map((a) => (
                  <option key={a.id} value={a.id}>{a.nombre}</option>
                ))}
              </select>
            </label>

            <label className="field" style={{ margin: 0 }}>
              <span style={{ fontSize: 12 }}>Material / Herramienta</span>
              <Combobox
                value={selectedMaterialId === "" ? 0 : Number(selectedMaterialId)}
                selectedLabel={
                  selectedMatObj
                    ? `${selectedMatObj.nombre} (Stock: ${selectedMatObj.cantidad_total})`
                    : ""
                }
                placeholder="Buscar por nombre o código…"
                onChange={(id) => setSelectedMaterialId(id)}
                fetchOptions={async (q) => {
                  if (!almacenId) return [];
                  const res = await listMateriales(Number(almacenId), { q });
                  return res.map((c) => ({
                    id: c.id,
                    label: `${c.nombre}${c.marca ? ` · ${c.marca}` : ""}`,
                    sublabel: `Stock: ${c.cantidad_total}`,
                  }));
                }}
              />
            </label>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
            <label className="field" style={{ margin: 0, width: 100 }}>
              <span style={{ fontSize: 12 }}>Cantidad</span>
              <input
                type="number"
                min={1}
                value={cantidad}
                onChange={(e) => setCantidad(Math.max(1, Number(e.target.value)))}
                style={{ fontSize: 13, textAlign: "center" }}
              />
            </label>

            <label className="field" style={{ margin: 0, flex: 1 }}>
              <span style={{ fontSize: 12 }}>Tipo de asignación</span>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value as typeof tipo)}
                style={{ fontSize: 13 }}
              >
                <option value="NECESARIO_NO_BLOQUEANTE">Necesario para la labor</option>
                <option value="USADO">Usado / Retirado</option>
              </select>
            </label>

            <button
              type="submit"
              className="button button-primary button-sm"
              disabled={adding || !selectedMaterialId}
              style={{ height: 36, padding: "0 14px" }}
            >
              {adding ? "Agregando…" : "Confirmar"}
            </button>
          </div>
        </form>
      )}

      {materiales.length === 0 && !showAddForm ? (
        <p className="detail-empty" style={{ margin: "4px 0" }}>{emptyMessage}</p>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          {materiales.map((m) => (
            <div
              key={m.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "8px 12px",
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
                  {m.tipoLabel} · Cantidad: <strong>{m.cantidad}</strong> (Stock: {m.materialStock})
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
                    padding: "4px 8px",
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <WarningDiamond size={13} />
                  {savingId === m.id ? "Guardando…" : "Marcar adquirido"}
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
                  <Check size={13} /> Adquirido
                </span>
              )}

              <button
                type="button"
                onClick={() => void handleDelete(m.id)}
                style={{ background: "none", border: 0, cursor: "pointer", color: "var(--muted)", padding: 4 }}
                title="Quitar material de la OT"
              >
                <Trash size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}