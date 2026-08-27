import { PencilSimple, X, Check } from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { updatePieza } from "@/modules/almacen/catalogoRepository";

// ─── Editor inline del campo "detalle" de una pieza ─────────────────────────
// Muestra el detalle actual (o un placeholder si está vacío) junto a un lápiz.
// Al hacer clic, convierte el texto en un <input> para editarlo y guardar.
// El componente invalida la query ["pieza", id] y ["piezas", ...] al guardar.
export function PiezaDetalleEditor({
  piezaId,
  initialDetalle,
  onSaved,
  queryKeys,
}: {
  piezaId: number;
  initialDetalle?: string | null;
  onSaved?: (nuevoDetalle: string) => void;
  /** Claves adicionales de React Query a invalidar al guardar. */
  queryKeys?: (string | number)[][];
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialDetalle ?? "");

  const mut = useMutation({
    mutationFn: (detalle: string) => updatePieza(piezaId, { detalle }),
    onSuccess: (updated) => {
      setValue(updated.detalle ?? "");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["piezas"] });
      qc.invalidateQueries({ queryKey: ["pieza", piezaId] });
      queryKeys?.forEach((key) => qc.invalidateQueries({ queryKey: key }));
      onSaved?.(updated.detalle ?? "");
    },
  });

  if (!editing) {
    return (
      <span
        style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12 }}
      >
        {value ? (
          <span style={{ color: "var(--text)" }}>{value}</span>
        ) : (
          <span style={{ color: "var(--muted)", fontStyle: "italic" }}>Detalle adicional</span>
        )}
        <button
          type="button"
          title="Editar nombre de la pieza"
          onClick={() => setEditing(true)}
          style={{
            background: "transparent",
            border: 0,
            padding: "1px 3px",
            cursor: "pointer",
            color: "var(--muted)",
            display: "inline-flex",
            alignItems: "center",
          }}
        >
          <PencilSimple size={12} />
        </button>
      </span>
    );
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") mut.mutate(value);
          if (e.key === "Escape") setEditing(false);
        }}
        style={{
          fontSize: 12,
          padding: "2px 6px",
          borderRadius: 4,
          border: "1px solid var(--border, #d1d5db)",
          width: 140,
        }}
        disabled={mut.isPending}
      />
      <button
        type="button"
        title="Guardar"
        onClick={() => mut.mutate(value)}
        disabled={mut.isPending}
        style={{ background: "transparent", border: 0, padding: 2, cursor: "pointer", color: "var(--success, #16a34a)" }}
      >
        <Check size={14} weight="bold" />
      </button>
      <button
        type="button"
        title="Cancelar"
        onClick={() => setEditing(false)}
        disabled={mut.isPending}
        style={{ background: "transparent", border: 0, padding: 2, cursor: "pointer", color: "var(--muted)" }}
      >
        <X size={14} weight="bold" />
      </button>
    </span>
  );
}
