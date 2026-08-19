import { Ruler, PencilSimple, Trash, X } from "@phosphor-icons/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  createUnidadMedida,
  createTipoManejoStock,
  deleteUnidadMedida,
  deleteTipoManejoStock,
  listUnidadesMedida,
  listTiposManejoStock,
  updateUnidadMedida,
  updateTipoManejoStock,
} from "@/modules/almacen/catalogoRepository";
import type { UnidadMedidaCatalogo, TipoManejoStockCatalogo } from "@/modules/almacen/types";

interface Props {
  onClose: () => void;
}

const FAMILIAS: { value: UnidadMedidaCatalogo["familia"]; label: string }[] = [
  { value: "longitud", label: "Longitud" },
  { value: "peso", label: "Peso" },
  { value: "volumen", label: "Volumen" },
  { value: "otro", label: "Otro" },
];

export function GestionUnidadesPanel({ onClose }: Props) {
  const queryClient = useQueryClient();

  // ── Unidad de medida ──
  const [editUM, setEditUM] = useState<UnidadMedidaCatalogo | null>(null);
  const [umNombre, setUmNombre] = useState("");
  const [umAbrev, setUmAbrev] = useState("");
  const [umCodigo, setUmCodigo] = useState("");
  const [umFamilia, setUmFamilia] = useState<UnidadMedidaCatalogo["familia"]>("longitud");
  const [umFactor, setUmFactor] = useState("1");
  const [umError, setUmError] = useState("");

  // ── Tipo de manejo de stock ──
  const [editTM, setEditTM] = useState<TipoManejoStockCatalogo | null>(null);
  const [tmNombre, setTmNombre] = useState("");
  const [tmCodigo, setTmCodigo] = useState("");
  const [tmRequiereMult, setTmRequiereMult] = useState(false);
  const [tmPermiteConv, setTmPermiteConv] = useState(false);
  const [tmError, setTmError] = useState("");

  const { data: unidades = [] } = useQuery({
    queryKey: ["unidades-medida"],
    queryFn: listUnidadesMedida,
  });

  const { data: tiposManejo = [] } = useQuery({
    queryKey: ["tipos-manejo-stock"],
    queryFn: listTiposManejoStock,
  });

  const umMut = useMutation({
    mutationFn: async () => {
      setUmError("");
      if (!umNombre.trim() || !umAbrev.trim() || (!editUM && !umCodigo.trim())) {
        throw new Error("Nombre, abreviatura y código son obligatorios.");
      }
      const factor = Number(umFactor);
      if (!factor || factor <= 0) {
        throw new Error("El factor debe ser un número mayor a 0.");
      }
      if (editUM) {
        return updateUnidadMedida(editUM.id, {
          nombre: umNombre.trim(),
          abreviatura: umAbrev.trim(),
          familia: umFamilia,
          factor_a_base: factor,
        });
      }
      return createUnidadMedida({
        codigo: umCodigo.trim().toLowerCase(),
        nombre: umNombre.trim(),
        abreviatura: umAbrev.trim(),
        familia: umFamilia,
        factor_a_base: factor,
        activo: true,
        orden: unidades.length + 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["unidades-medida"] });
      resetUmForm();
    },
    onError: (err: Error) => setUmError(err.message || "Error al guardar la unidad de medida."),
  });

  const delUmMut = useMutation({
    mutationFn: (id: number) => deleteUnidadMedida(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["unidades-medida"] }),
    onError: (err: any) =>
      setUmError(err?.response?.data?.detail || "No se puede eliminar: está en uso por materiales."),
  });

  const tmMut = useMutation({
    mutationFn: async () => {
      setTmError("");
      if (!tmNombre.trim() || (!editTM && !tmCodigo.trim())) {
        throw new Error("Nombre y código son obligatorios.");
      }
      if (editTM) {
        return updateTipoManejoStock(editTM.id, {
          nombre: tmNombre.trim(),
          requiere_multiplicador: tmRequiereMult,
          permite_conversion_unidad: tmPermiteConv,
        });
      }
      return createTipoManejoStock({
        codigo: tmCodigo.trim(),
        nombre: tmNombre.trim(),
        requiere_multiplicador: tmRequiereMult,
        permite_conversion_unidad: tmPermiteConv,
        activo: true,
        orden: tiposManejo.length + 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tipos-manejo-stock"] });
      resetTmForm();
    },
    onError: (err: Error) => setTmError(err.message || "Error al guardar el tipo de manejo de stock."),
  });

  const delTmMut = useMutation({
    mutationFn: (id: number) => deleteTipoManejoStock(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tipos-manejo-stock"] }),
    onError: (err: any) =>
      setTmError(err?.response?.data?.detail || "No se puede eliminar: está en uso por materiales."),
  });

  function resetUmForm() {
    setEditUM(null);
    setUmNombre("");
    setUmAbrev("");
    setUmCodigo("");
    setUmFamilia("longitud");
    setUmFactor("1");
    setUmError("");
  }

  function resetTmForm() {
    setEditTM(null);
    setTmNombre("");
    setTmCodigo("");
    setTmRequiereMult(false);
    setTmPermiteConv(false);
    setTmError("");
  }

  function handleEditUm(u: UnidadMedidaCatalogo) {
    setEditUM(u);
    setUmNombre(u.nombre);
    setUmAbrev(u.abreviatura);
    setUmCodigo(u.codigo);
    setUmFamilia(u.familia);
    setUmFactor(String(u.factor_a_base));
    setUmError("");
  }

  function handleEditTm(t: TipoManejoStockCatalogo) {
    setEditTM(t);
    setTmNombre(t.nombre);
    setTmCodigo(t.codigo);
    setTmRequiereMult(t.requiere_multiplicador);
    setTmPermiteConv(t.permite_conversion_unidad);
    setTmError("");
  }

  const inputStyle: React.CSSProperties = {
    padding: "6px 8px",
    borderRadius: 6,
    border: "1px solid var(--border, #e5e7eb)",
    fontSize: 13,
  };

  return (
    <div
      style={{
        background: "var(--surface, #fff)",
        borderRadius: 12,
        border: "1px solid var(--border, #e5e7eb)",
        padding: 20,
        marginBottom: 16,
        boxShadow: "0 2px 12px rgba(0,0,0,.06)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Ruler size={20} style={{ color: "var(--accent, #6366f1)" }} />
          <strong style={{ fontSize: 16 }}>Unidades de Medida y Manejo de Stock</strong>
        </div>
        <button type="button" onClick={onClose} style={{ background: "none", border: 0, cursor: "pointer", color: "var(--muted)" }}>
          <X size={18} />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Columna 1: Unidades de medida */}
        <div>
          <h3 style={{ fontSize: 14, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Unidades de medida (grosor / largo / rollo)</span>
            {editUM && (
              <button type="button" onClick={resetUmForm} style={{ fontSize: 12, color: "var(--muted)", background: "none", border: 0, cursor: "pointer" }}>
                + Nueva
              </button>
            )}
          </h3>

          <div style={{ background: "var(--surface-raised, #f9fafb)", padding: 12, borderRadius: 8, border: "1px solid var(--border, #e5e7eb)", marginBottom: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: editUM ? "1fr 1fr" : "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
              <input style={inputStyle} type="text" placeholder="Nombre (ej. Centímetros)" value={umNombre} onChange={(e) => setUmNombre(e.target.value)} />
              <input style={inputStyle} type="text" placeholder="Abrev. (ej. cm)" value={umAbrev} onChange={(e) => setUmAbrev(e.target.value)} />
              {!editUM && (
                <input style={inputStyle} type="text" placeholder="Código interno (ej. cm)" value={umCodigo} onChange={(e) => setUmCodigo(e.target.value)} />
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <select style={inputStyle} value={umFamilia} onChange={(e) => setUmFamilia(e.target.value as UnidadMedidaCatalogo["familia"])}>
                {FAMILIAS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
              <input style={inputStyle} type="number" step="any" placeholder="Factor a base" value={umFactor} onChange={(e) => setUmFactor(e.target.value)} />
            </div>
            <p style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>
              El factor solo importa entre unidades de la misma familia (ej. para convertir cm ↔ m en un
              material tipo Rollo). Usa una referencia consistente, ej. mm=1, cm=10, m=1000.
            </p>
            {umError && <p style={{ color: "#dc2626", fontSize: 12, marginBottom: 8 }}>{umError}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => umMut.mutate()}
                disabled={umMut.isPending}
                style={{ padding: "6px 12px", borderRadius: 6, border: 0, background: "var(--accent, #6366f1)", color: "#fff", fontSize: 13, cursor: "pointer" }}
              >
                {editUM ? "Guardar cambios" : "Crear unidad"}
              </button>
              {editUM && (
                <button type="button" onClick={resetUmForm} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "none", fontSize: 13, cursor: "pointer" }}>
                  Cancelar
                </button>
              )}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {unidades.map((u) => (
              <div key={u.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", borderRadius: 6, background: editUM?.id === u.id ? "var(--surface-raised, #f3f4f6)" : "transparent" }}>
                <span style={{ fontSize: 13 }}>
                  {u.nombre} <span style={{ color: "var(--muted)" }}>({u.abreviatura} · {u.familia})</span>
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" onClick={() => handleEditUm(u)} style={{ background: "none", border: 0, cursor: "pointer", color: "var(--muted)" }}>
                    <PencilSimple size={16} />
                  </button>
                  <button type="button" onClick={() => delUmMut.mutate(u.id)} style={{ background: "none", border: 0, cursor: "pointer", color: "#dc2626" }}>
                    <Trash size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Columna 2: Tipos de manejo de stock */}
        <div>
          <h3 style={{ fontSize: 14, marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Tipos de manejo de stock</span>
            {editTM && (
              <button type="button" onClick={resetTmForm} style={{ fontSize: 12, color: "var(--muted)", background: "none", border: 0, cursor: "pointer" }}>
                + Nuevo
              </button>
            )}
          </h3>

          <div style={{ background: "var(--surface-raised, #f9fafb)", padding: 12, borderRadius: 8, border: "1px solid var(--border, #e5e7eb)", marginBottom: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: editTM ? "1fr" : "1fr 1fr", gap: 8, marginBottom: 8 }}>
              <input style={inputStyle} type="text" placeholder="Nombre (ej. Por Kit / Juego)" value={tmNombre} onChange={(e) => setTmNombre(e.target.value)} />
              {!editTM && (
                <input style={inputStyle} type="text" placeholder="Código interno (ej. kit)" value={tmCodigo} onChange={(e) => setTmCodigo(e.target.value)} />
              )}
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginBottom: 6 }}>
              <input type="checkbox" checked={tmRequiereMult} onChange={(e) => setTmRequiereMult(e.target.checked)} />
              Requiere indicar "unidades por empaque" (caja, bolsa, kit, docena, etc.)
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginBottom: 8 }}>
              <input type="checkbox" checked={tmPermiteConv} onChange={(e) => setTmPermiteConv(e.target.checked)} />
              Permite elegir otra unidad al registrar movimientos (ej. Rollo: cm o m)
            </label>
            {tmError && <p style={{ color: "#dc2626", fontSize: 12, marginBottom: 8 }}>{tmError}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => tmMut.mutate()}
                disabled={tmMut.isPending}
                style={{ padding: "6px 12px", borderRadius: 6, border: 0, background: "var(--accent, #6366f1)", color: "#fff", fontSize: 13, cursor: "pointer" }}
              >
                {editTM ? "Guardar cambios" : "Crear tipo"}
              </button>
              {editTM && (
                <button type="button" onClick={resetTmForm} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "none", fontSize: 13, cursor: "pointer" }}>
                  Cancelar
                </button>
              )}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {tiposManejo.map((t) => (
              <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 8px", borderRadius: 6, background: editTM?.id === t.id ? "var(--surface-raised, #f3f4f6)" : "transparent" }}>
                <span style={{ fontSize: 13 }}>
                  {t.nombre}{" "}
                  <span style={{ color: "var(--muted)" }}>
                    {t.requiere_multiplicador ? "· por empaque" : ""}{t.permite_conversion_unidad ? " · convierte unidad" : ""}
                  </span>
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="button" onClick={() => handleEditTm(t)} style={{ background: "none", border: 0, cursor: "pointer", color: "var(--muted)" }}>
                    <PencilSimple size={16} />
                  </button>
                  <button type="button" onClick={() => delTmMut.mutate(t.id)} style={{ background: "none", border: 0, cursor: "pointer", color: "#dc2626" }}>
                    <Trash size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
