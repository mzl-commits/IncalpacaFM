import type { EstadoPieza, TipoMovimiento, ResultadoInspeccion } from "@/modules/almacen/types";

type BadgeValue = EstadoPieza | TipoMovimiento | ResultadoInspeccion | string;

const variantMap: Record<string, string> = {
  // Estado Pieza
  Disponible: "status-success",
  Prestado: "status-warning",
  Mantenimiento: "status-warning",
  Baja: "status-error",
  // Tipo Movimiento
  salida: "status-neutral",
  entrada: "status-success",
  baja: "status-error",
  // Resultado Inspección
  apta: "status-success",
  requiere_reparacion: "status-warning",
  fuera_servicio: "status-error",
};

const labelMap: Record<string, string> = {
  salida: "Salida",
  entrada: "Entrada",
  baja: "Baja",
  apta: "Apta",
  requiere_reparacion: "Requiere reparación",
  fuera_servicio: "Fuera de servicio",
};

interface StatusBadgeProps {
  value: BadgeValue;
  label?: string; // override de label si se quiere
}

export function StatusBadge({ value, label }: StatusBadgeProps) {
  const variantClass = variantMap[value] ?? "status-neutral";
  const displayLabel = label ?? labelMap[value] ?? value;
  return (
    <span className={`status ${variantClass}`} aria-label={displayLabel}>
      {displayLabel}
    </span>
  );
}
