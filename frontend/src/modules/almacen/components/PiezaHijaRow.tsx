import { Check, Package, PencilSimple, Trash, X } from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { StatusBadge } from "@/components/shared/StatusBadge";
import { desvinculaPieza, updatePieza } from "@/modules/almacen/catalogoRepository";
import type { PiezaBase } from "@/modules/almacen/types";

export function PiezaHijaRow({
  pieza,
  materialId,
  isInspector,
}: {
  pieza: PiezaBase & { material_nombre?: string; material_medida?: string };
  materialId: number;
  isInspector?: boolean;
}) {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);

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

  const desvinMut = useMutation({
    mutationFn: () => desvinculaPieza(pieza.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["material", materialId] });
      setConfirm(false);
    },
  });

  return (
    <div className="pieza-tree-hija" style={{ alignItems: "center" }}>
      <Package size={12} style={{ color: "var(--muted)", flexShrink: 0 }} />
      <span className="pieza-code">{pieza.codigo}</span>
      {(pieza.material_nombre || pieza.material_medida) && (
        <span style={{ fontSize: 11, color: "var(--muted)" }}>
          {[pieza.material_nombre, pieza.material_medida].filter(Boolean).join(" · ")}
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
            style={{ fontSize: 11, padding: "2px 6px", width: 130 }}
            autoFocus
          />
          <button
            type="button"
            style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--success, #16a34a)" }}
            onClick={() => detalleMut.mutate()}
            disabled={detalleMut.isPending}
            title="Guardar"
          >
            <Check size={13} />
          </button>
          <button
            type="button"
            style={{ background: "transparent", border: 0, cursor: "pointer", color: "var(--muted)" }}
            onClick={() => { setEditandoDetalle(false); setDetalleValor(pieza.detalle ?? ""); }}
            title="Cancelar"
          >
            <X size={13} />
          </button>
        </span>
      ) : (
        <span
          style={{
            fontSize: 11,
            color: pieza.detalle ? "var(--text)" : "var(--muted)",
            display: "flex",
            alignItems: "center",
            gap: 4,
            cursor: "pointer",
          }}
          onClick={() => setEditandoDetalle(true)}
          title="Editar nombre/nota de esta pieza"
        >
          {pieza.detalle || "Sin nombre"} <PencilSimple size={10} />
        </span>
      )}

      <StatusBadge value={pieza.estado} />
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
        {!isInspector && (confirm ? (
          <>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>¿Quitar del estuche?</span>
            <button
              style={{
                fontSize: 11, padding: "2px 8px", borderRadius: 4,
                background: "var(--error, #dc2626)", color: "#fff",
                border: "none", cursor: "pointer",
              }}
              onClick={() => desvinMut.mutate()}
              disabled={desvinMut.isPending}
            >
              {desvinMut.isPending ? "…" : "Sí"}
            </button>
            <button
              style={{
                fontSize: 11, padding: "2px 8px", borderRadius: 4,
                background: "transparent", border: "1px solid var(--border, #d1d5db)",
                cursor: "pointer",
              }}
              onClick={() => setConfirm(false)}
              disabled={desvinMut.isPending}
            >
              No
            </button>
          </>
        ) : (
          <button
            title="Quitar del estuche"
            style={{
              background: "transparent", border: 0,
              color: "var(--muted)", cursor: "pointer",
              padding: 2, display: "flex", alignItems: "center",
              opacity: 0.6,
            }}
            onClick={() => setConfirm(true)}
          >
            <Trash size={13} />
          </button>
        ))}
      </div>
    </div>
  );
}