import { Package, Trash } from "@phosphor-icons/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { StatusBadge } from "@/components/shared/StatusBadge";
import { desvinculaPieza } from "@/modules/almacen/catalogoRepository";
import { labelPieza } from "@/utils/pieza";
import type { PiezaBase } from "@/modules/almacen/types";

export function PiezaHijaRow({
  pieza,
  materialId,
}: {
  pieza: PiezaBase & { material_nombre?: string; material_medida?: string };
  materialId: number;
}) {
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);

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
      <span className="pieza-code">{labelPieza(pieza)}</span>
      {(pieza.material_nombre || pieza.material_medida) && (
        <span style={{ fontSize: 11, color: "var(--muted)" }}>
          {[pieza.material_nombre, pieza.material_medida].filter(Boolean).join(" · ")}
        </span>
      )}
      <StatusBadge value={pieza.estado} />
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
        {confirm ? (
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
        )}
      </div>
    </div>
  );
}