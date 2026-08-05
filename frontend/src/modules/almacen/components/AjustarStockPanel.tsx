import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/modules/accounts/AuthContext";
import {
  registrarEntradaMaterial,
  registrarBajaMaterial,
} from "@/modules/almacen/inventarioRepository";
import type { MaterialDetalle } from "@/modules/almacen/types";

type Modo = "entrada" | "baja";

export function AjustarStockPanel({ material }: { material: MaterialDetalle }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [modo, setModo] = useState<Modo>("entrada");
  const [cantidad, setCantidad] = useState("");
  const [observaciones, setObservaciones] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const cantidadNum = Number(cantidad);
      if (!cantidadNum || cantidadNum <= 0) {
        throw new Error("Ingresa una cantidad válida mayor a 0.");
      }
      if (!user) {
        throw new Error("No hay usuario autenticado.");
      }

      const input = {
        material_id: material.id,
        cantidad: cantidadNum,
        responsable_id: user.userId,
        observaciones: observaciones.trim() || undefined,
      };

      return modo === "entrada"
        ? registrarEntradaMaterial(input)
        : registrarBajaMaterial(input);
    },
    onSuccess: () => {
      setCantidad("");
      setObservaciones("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["material", material.id] });
      queryClient.invalidateQueries({
        queryKey: ["movimientos", { material: material.id }],
      });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ??
        (err as Error)?.message ??
        "No se pudo registrar el movimiento.";
      setError(msg);
    },
  });

  const inputStyle: React.CSSProperties = {
    padding: "7px 10px",
    borderRadius: 6,
    border: "1px solid var(--border, #d0d5dd)",
    fontSize: 13,
  };

  return (
    <div
      style={{
        marginTop: 16,
        paddingTop: 16,
        borderTop: "1px solid var(--border, #e5e7eb)",
      }}
    >
      <div className="form-section-heading" style={{ marginBottom: 12 }}>
        <span>Ajustar cantidad disponible</span>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <label style={{ display: "block", fontSize: 11, color: "var(--muted)", textTransform: "uppercase", marginBottom: 4 }}>
            Movimiento
          </label>
          <select
            value={modo}
            onChange={(e) => setModo(e.target.value as Modo)}
            style={inputStyle}
          >
            <option value="entrada">Aumentar stock</option>
            <option value="baja">Disminuir stock</option>
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 11, color: "var(--muted)", textTransform: "uppercase", marginBottom: 4 }}>
            Cantidad
          </label>
          <input
            type="number"
            min={1}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            style={{ ...inputStyle, width: 100 }}
          />
        </div>

        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={{ display: "block", fontSize: 11, color: "var(--muted)", textTransform: "uppercase", marginBottom: 4 }}>
            Observaciones (opcional)
          </label>
          <input
            type="text"
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            style={{ ...inputStyle, width: "100%" }}
          />
        </div>

        <button
          className="button button-primary"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Aplicando..." : "Aplicar"}
        </button>
      </div>

      {error && (
        <p style={{ color: "#c0392b", fontSize: 12, marginTop: 8 }}>{error}</p>
      )}
    </div>
  );
}