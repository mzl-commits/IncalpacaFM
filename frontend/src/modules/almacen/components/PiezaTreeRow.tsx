import { Check, Package, PencilSimple, Plus, Trash, X } from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { StatusBadge } from "@/components/shared/StatusBadge";
import { TrimestreBadge } from "@/components/shared/TrimestreBadge";
import { agregarHijaInline, deletePieza, updatePieza } from "@/modules/almacen/catalogoRepository";
import type { PiezaAnidada } from "@/modules/almacen/types";
import { PiezaHijaRow } from "@/modules/almacen/components/PiezaHijaRow";

export function PiezaTreeRow({
  pieza,
  mostrarTrimestre,
  periodicidadDias,
  materialId,
}: {
  pieza: PiezaAnidada;
  mostrarTrimestre: string | null;
  /** material.periodicidad_inspeccion_dias — requerido por TrimestreBadge para calcular vigencia */
  periodicidadDias: number;
  materialId: number;
}) {
  const qc = useQueryClient();
  const esContenedor = pieza.total_hijas > 0;
  // "idle" | "confirming" | "confirmed"
  const [delStep, setDelStep] = useState<"idle" | "confirming" | "confirmed">("idle");
  // F1: formulario inline para agregar pieza hija
  const [mostrarFormHija, setMostrarFormHija] = useState(false);
  const [hijaNombre, setHijaNombre] = useState("");
  const [hijaMedida, setHijaMedida] = useState("");
  const [hijaCantidad, setHijaCantidad] = useState(1);
  const [hijaError, setHijaError] = useState("");

  // Edición inline del nombre/nota personalizada de esta pieza (campo "detalle")
  const [editandoDetalle, setEditandoDetalle] = useState(false);
  const [detalleValor, setDetalleValor] = useState(pieza.detalle ?? "");

  const detalleMut = useMutation({
    mutationFn: () => updatePieza(pieza.id, { detalle: detalleValor }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material", materialId] });
      setEditandoDetalle(false);
    },
  });

  const delMut = useMutation({
    mutationFn: () => deletePieza(pieza.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material", materialId] });
      setDelStep("idle");
    },
    onError: () => {
      setDelStep("idle");
      alert("No se pudo eliminar. Intenta de nuevo.");
    },
  });

  const agregarMut = useMutation({
    mutationFn: () => agregarHijaInline(pieza.id, {
      nombre: hijaNombre.trim(),
      medida: hijaMedida.trim() || undefined,
      cantidad: hijaCantidad,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material", materialId] });
      setMostrarFormHija(false);
      setHijaNombre("");
      setHijaMedida("");
      setHijaCantidad(1);
      setHijaError("");
    },
    onError: (e: { response?: { data?: Record<string, string[]> } }) => {
      const data = e?.response?.data;
      setHijaError(data ? Object.values(data).flat().join(" ") : "Error al agregar pieza.");
    },
  });

  return (
    <div>
      <div className={`pieza-tree-row ${esContenedor ? "is-container" : ""}`}>
        <Package size={15} style={{ color: "var(--muted)", flexShrink: 0 }} />
        <span className="pieza-code">{pieza.codigo}</span>
        {pieza.material_nombre && (
          <span style={{ fontSize: 12, color: "var(--muted)", marginLeft: 2 }}>
            {pieza.material_nombre}{pieza.material_medida ? ` · ${pieza.material_medida}` : ""}
          </span>
        )}

        {/* Nombre / nota personalizada de esta pieza física (campo "detalle") */}
        {editandoDetalle ? (
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input
              type="text"
              value={detalleValor}
              onChange={(e) => setDetalleValor(e.target.value)}
              placeholder="Nombre / nota de esta pieza"
              style={{ fontSize: 12, padding: "2px 6px", width: 150 }}
              autoFocus
            />
            <button
              type="button"
              style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--success, #16a34a)" }}
              onClick={() => detalleMut.mutate()}
              disabled={detalleMut.isPending}
              title="Guardar"
            >
              <Check size={14} />
            </button>
            <button
              type="button"
              style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--muted)" }}
              onClick={() => { setEditandoDetalle(false); setDetalleValor(pieza.detalle ?? ""); }}
              title="Cancelar"
            >
              <X size={14} />
            </button>
          </span>
        ) : (
          <span
            style={{
              fontSize: 12,
              color: pieza.detalle ? "var(--text)" : "var(--muted)",
              display: "flex",
              alignItems: "center",
              gap: 4,
              cursor: "pointer",
            }}
            onClick={() => setEditandoDetalle(true)}
            title="Editar nombre/nota de esta pieza"
          >
            {pieza.detalle || "Sin nombre"} <PencilSimple size={11} />
          </span>
        )}

        <StatusBadge value={pieza.estado} />
        {mostrarTrimestre && pieza.estado !== "Baja" && (
          <TrimestreBadge fecha={mostrarTrimestre} periodicidadDias={periodicidadDias} />
        )}

        {/* Contador estuche + botón agregar hija + botón eliminar */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          {esContenedor && delStep === "idle" && (
            <small style={{ color: "var(--muted)", fontSize: 11 }}>
              Estuche · {pieza.hijas_disponibles}/{pieza.total_hijas} disponibles
            </small>
          )}

          {/* Botón + Pieza (solo en estuches) */}
          {delStep === "idle" && (
            <button
              type="button"
              title="Agregar item a este estuche"
              style={{
                background: "transparent", border: 0,
                color: "var(--accent, #6366f1)", cursor: "pointer",
                padding: 2, display: "flex", alignItems: "center", gap: 3,
                fontSize: 11, opacity: 0.8,
              }}
              onClick={() => { setMostrarFormHija((v) => !v); setHijaError(""); }}
            >
              <Plus size={13} /> Item
            </button>
          )}

          {delStep === "idle" && (
            <button
              title={esContenedor ? "Eliminar estuche y todas sus piezas" : "Eliminar pieza"}
              style={{
                background: "transparent", border: 0,
                color: "var(--muted)", cursor: "pointer",
                padding: 2, display: "flex", alignItems: "center",
                opacity: 0.55,
              }}
              onClick={() => setDelStep("confirming")}
            >
              <Trash size={14} />
            </button>
          )}

          {delStep === "confirming" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                {esContenedor
                  ? `¿Eliminar estuche + ${pieza.total_hijas} items?`
                  : "¿Eliminar pieza?"}
              </span>
              {esContenedor && (
                <button
                  style={{
                    fontSize: 11, padding: "2px 8px", borderRadius: 4,
                    background: "var(--error, #dc2626)", color: "#fff",
                    border: "none", cursor: "pointer",
                  }}
                  onClick={() => setDelStep("confirmed")}
                >
                  Ver aviso
                </button>
              )}
              {!esContenedor && (
                <button
                  style={{
                    fontSize: 11, padding: "2px 8px", borderRadius: 4,
                    background: "var(--error, #dc2626)", color: "#fff",
                    border: "none", cursor: "pointer",
                  }}
                  onClick={() => delMut.mutate()}
                  disabled={delMut.isPending}
                >
                  {delMut.isPending ? "…" : "Sí"}
                </button>
              )}
              <button
                style={{
                  fontSize: 11, padding: "2px 8px", borderRadius: 4,
                  background: "transparent", border: "1px solid var(--border, #d1d5db)",
                  cursor: "pointer",
                }}
                onClick={() => setDelStep("idle")}
                disabled={delMut.isPending}
              >
                No
              </button>
            </div>
          )}

          {delStep === "confirmed" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, color: "#dc2626", fontWeight: 600 }}>
                ⚠️ Se borrarán {pieza.total_hijas} items también.
              </span>
              <button
                style={{
                  fontSize: 11, padding: "2px 8px", borderRadius: 4,
                  background: "#7f1d1d", color: "#fff",
                  border: "none", cursor: "pointer",
                }}
                onClick={() => delMut.mutate()}
                disabled={delMut.isPending}
              >
                {delMut.isPending ? "Eliminando…" : "Confirmar"}
              </button>
              <button
                style={{
                  fontSize: 11, padding: "2px 8px", borderRadius: 4,
                  background: "transparent", border: "1px solid var(--border, #d1d5db)",
                  cursor: "pointer",
                }}
                onClick={() => setDelStep("idle")}
                disabled={delMut.isPending}
              >
                No
              </button>
            </div>
          )}
        </div>
      </div>

      {/* F1: formulario inline para agregar pieza hija */}
      {mostrarFormHija && (
        <div style={{
          marginLeft: 24, marginTop: 6, padding: "10px 14px",
          background: "var(--surface-2, rgba(99,102,241,.06))",
          borderRadius: 8, border: "1px dashed var(--accent, #6366f1)",
        }}>
          <p style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: "var(--accent, #6366f1)" }}>
            + Agregar item al estuche
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, alignItems: "end" }}>
            <label style={{ fontSize: 12 }}>
              Nombre *
              <input
                type="text"
                value={hijaNombre}
                onChange={(e) => setHijaNombre(e.target.value)}
                placeholder="Ej. Llave allen 5mm"
                style={{ display: "block", width: "100%", marginTop: 3, padding: "4px 8px", fontSize: 13, borderRadius: 6, border: "1px solid var(--border, #d1d5db)" }}
              />
            </label>
            <label style={{ fontSize: 12 }}>
              Medida (opcional)
              <input
                type="text"
                value={hijaMedida}
                onChange={(e) => setHijaMedida(e.target.value)}
                placeholder="Ej. 5mm"
                style={{ display: "block", width: "100%", marginTop: 3, padding: "4px 8px", fontSize: 13, borderRadius: 6, border: "1px solid var(--border, #d1d5db)" }}
              />
            </label>
            <label style={{ fontSize: 12 }}>
              Cant.
              <input
                type="number"
                min={1}
                value={hijaCantidad}
                onChange={(e) => setHijaCantidad(Number(e.target.value))}
                style={{ display: "block", width: 56, marginTop: 3, padding: "4px 8px", fontSize: 13, borderRadius: 6, border: "1px solid var(--border, #d1d5db)" }}
              />
            </label>
          </div>
          {hijaError && (
            <p style={{ fontSize: 12, color: "#dc2626", marginTop: 6 }}>{hijaError}</p>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              type="button"
              className="button button-primary"
              style={{ fontSize: 12, padding: "4px 14px" }}
              onClick={() => { setHijaError(""); agregarMut.mutate(); }}
              disabled={agregarMut.isPending || !hijaNombre.trim()}
            >
              {agregarMut.isPending ? "Agregando…" : "Agregar"}
            </button>
            <button
              type="button"
              className="button button-secondary"
              style={{ fontSize: 12, padding: "4px 14px" }}
              onClick={() => { setMostrarFormHija(false); setHijaError(""); }}
              disabled={agregarMut.isPending}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {pieza.piezas_hijas.length > 0 && (
        <div className="pieza-tree-children">
          {pieza.piezas_hijas.map((hija) => (
            <PiezaHijaRow key={hija.id} pieza={hija} materialId={materialId} />
          ))}
        </div>
      )}
    </div>
  );
}