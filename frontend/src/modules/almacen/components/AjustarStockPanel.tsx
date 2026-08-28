import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Info, WarningCircle } from "@phosphor-icons/react";
import { useAlmacenActivo } from "@/modules/almacen/AlmacenContext";

import { ajustarStock } from "@/modules/almacen/catalogoRepository";
import type { MaterialDetalle } from "@/modules/almacen/types";

type Modo = "entrada" | "salida";

export function AjustarStockPanel({ material }: { material: MaterialDetalle }) {
  const { almacenId } = useAlmacenActivo();
  const queryClient = useQueryClient();

  const [modo, setModo] = useState<Modo>("entrada");
  const [cantidad, setCantidad] = useState("");
  const [error, setError] = useState<string | null>(null);

  const esPorCaja = material.unidad_manejo_requiere_multiplicador && !!material.unidades_por_caja;

  const mutation = useMutation({
    mutationFn: async () => {
      const cantidadNum = Number(cantidad);
      if (!cantidadNum || cantidadNum <= 0) {
        throw new Error(esPorCaja ? "Ingresa una cantidad de cajas válida mayor a 0." : "Ingresa una cantidad válida mayor a 0.");
      }
      const cantidadEnUnidades = esPorCaja
        ? cantidadNum * (material.unidades_por_caja ?? 0)
        : cantidadNum;
      const delta = modo === "entrada" ? cantidadEnUnidades : -cantidadEnUnidades;
      return ajustarStock({ material_id: material.id, cantidad: delta });
    },
    onSuccess: () => {
      setCantidad("");
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["material", material.id] });
      queryClient.invalidateQueries({ queryKey: ["materiales"] });
    },
    onError: (err: unknown) => {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ??
        (err as Error)?.message ??
        "No se pudo ajustar el stock.";
      setError(msg);
    },
  });

  return (
    <div className="ajuste-stock-panel">
      <div className="form-section-heading" style={{ marginBottom: 12 }}>
        <span>Ajustar cantidad disponible</span>
      </div>

      <div className="ajuste-stock-row">
        <div className="ajuste-stock-input-block">
          <label className="ajuste-stock-label">Movimiento</label>
          <select
            value={modo}
            onChange={(e) => setModo(e.target.value as Modo)}
            className="ajuste-stock-select"
          >
            <option value="entrada">Aumentar stock</option>
            <option value="salida">Disminuir stock</option>
          </select>
        </div>

        <div className="ajuste-stock-input-block">
          <label className="ajuste-stock-label">
            {esPorCaja ? "Cantidad de cajas" : "Cantidad"}
          </label>
          <input
            type="number"
            min={1}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            className="ajuste-stock-cantidad-input"
          />
          {esPorCaja && cantidad && (
            <small className="ajuste-stock-equiv-inline">
              = {Number(cantidad) * (material.unidades_por_caja ?? 0)} unidades
            </small>
          )}
        </div>

        <button
          className="button button-primary"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !cantidad}
        >
          {mutation.isPending ? "Aplicando…" : "Aplicar"}
        </button>
      </div>

      <div className="ajuste-stock-note">
        <Info size={14} />
        <span>
          Ajuste manual para corregir el conteo. No queda registrado como baja.{" "}
          Si las unidades están dañadas, vencidas o se perdieron, usa{" "}
          <Link to={`/almacen/${almacenId}/movimientos/nuevo?material=${material.id}`}>
            Nuevo movimiento → Baja
          </Link>
          {" "}en su lugar.
        </span>
      </div>

      {error && (
        <div className="ajuste-stock-error">
          <WarningCircle size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}