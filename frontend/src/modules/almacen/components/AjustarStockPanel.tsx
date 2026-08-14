import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
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

  // Este panel es para correcciones administrativas rápidas de stock (ej.
  // "conté mal", "encontré 2 más en la repisa"), NO para dar de baja
  // formalmente. Por eso usa `ajustarStock` (que solo corrige
  // cantidad_total en el material) en vez de `registrarEntradaMaterial` /
  // `registrarBajaMaterial` (que crean un Movimiento con tipo "entrada" /
  // "baja" y se cuentan en las stats de Movimientos). Ni "aumentar" ni
  // "disminuir" acá quedan como baja — para dar de baja de verdad
  // (unidades dañadas, vencidas, perdidas), con su observación, se usa el
  // flujo formal de Movimientos → Nuevo movimiento → Baja.
  //
  // Cuando el material se maneja por empaque (unidad_manejo_requiere_multiplicador,
  // ej. caja, bolsa, kit), el usuario ingresa cantidad de EMPAQUES; acá se
  // convierte a unidades antes de llamar a ajustarStock, porque el endpoint
  // de ajuste rápido siempre trabaja en unidades (no tiene noción de "cajas").
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
            <option value="salida">Disminuir stock</option>
          </select>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 11, color: "var(--muted)", textTransform: "uppercase", marginBottom: 4 }}>
            {esPorCaja ? "Cantidad de cajas" : "Cantidad"}
          </label>
          <input
            type="number"
            min={1}
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            style={{ ...inputStyle, width: 100 }}
          />
          {esPorCaja && cantidad && (
            <small style={{ display: "block", fontSize: 11, color: "var(--muted)", marginTop: 4 }}>
              = {Number(cantidad) * (material.unidades_por_caja ?? 0)} unidades
            </small>
          )}
        </div>

        <button
          className="button button-primary"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Aplicando..." : "Aplicar"}
        </button>
      </div>

      <p style={{ color: "var(--muted)", fontSize: 12, marginTop: 8 }}>
        Esto es un ajuste manual (ej. corregir un conteo) y no queda
        registrado como baja. Si las unidades están dañadas, vencidas o se
        perdieron, regístralo como baja formal — con su observación — desde{" "}
        <Link to={`/almacen/${almacenId}/movimientos/nuevo?material=${material.id}`} style={{ fontWeight: 600 }}>
          Movimientos → Nuevo movimiento → Baja
        </Link>.
      </p>

      {error && (
        <p style={{ color: "#c0392b", fontSize: 12, marginTop: 8 }}>{error}</p>
      )}
    </div>
  );
}