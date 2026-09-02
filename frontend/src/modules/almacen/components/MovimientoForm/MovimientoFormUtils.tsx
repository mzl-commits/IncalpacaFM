import React from "react";
import { WarningCircle } from "@phosphor-icons/react";
import type { Material, UnidadMedidaCatalogo } from "@/modules/almacen/types";

export interface RenglonMovimiento {
  id: string;
  materialId: number;
  cantidad: number;
  cantidadCajas: number;
  unidadMovimientoId: number | null;
  cantidadEnUnidadMovimiento: string;
  modoPieza: "sueltas" | "estuche";
  piezasSeleccionadas: Set<number>;
  estuchePiezaId: number;
  estucheTodasHijas: boolean;
  estucheHijasSeleccionadas: Set<number>;
}

export interface ResultadoLoteAdmin {
  materialId: number;
  materialNombre: string;
  ok: boolean;
  error?: string;
}

export function generarUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function mensajeError(err: any): string {
  return err?.response?.data
    ? Object.values(err.response.data).flat().join(" ")
    : err?.message ?? "Error desconocido";
}

export function renglonVacio(materialId = 0): RenglonMovimiento {
  return {
    id: generarUUID().slice(0, 8),
    materialId,
    cantidad: 1,
    cantidadCajas: 1,
    unidadMovimientoId: null,
    cantidadEnUnidadMovimiento: "",
    modoPieza: "sueltas",
    piezasSeleccionadas: new Set(),
    estuchePiezaId: 0,
    estucheTodasHijas: true,
    estucheHijasSeleccionadas: new Set(),
  };
}

export function unidadesCompatiblesDe(mat: Material | undefined, unidadesMedida: UnidadMedidaCatalogo[]): UnidadMedidaCatalogo[] {
  if (!mat || !mat.unidad_movimiento_base) return [];
  const comp = new Set(mat.unidades_movimiento_compatibles || []);
  comp.add(mat.unidad_movimiento_base);
  return unidadesMedida.filter((u) => comp.has(u.id));
}

export function Field({
  label,
  required,
  error,
  hint,
  children,
  wide,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <label className={`field ${wide ? "field-wide" : ""} ${error ? "has-error" : ""}`}>
      <span>
        {label}
        {required && <b aria-hidden="true"> *</b>}
      </span>
      {children}
      {hint && !error && <small style={{ color: "var(--muted)", fontSize: 12 }}>{hint}</small>}
      {error && (
        <small className="field-error">
          <WarningCircle size={14} />
          {error}
        </small>
      )}
    </label>
  );
}
