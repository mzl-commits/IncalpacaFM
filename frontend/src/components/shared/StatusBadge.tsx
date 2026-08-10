import type { EstadoPieza, TipoMovimiento, ResultadoInspeccion, EstadoCalculado } from "@/modules/almacen/types";

type BadgeValue = EstadoPieza | TipoMovimiento | ResultadoInspeccion | EstadoCalculado | string;

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
  // Estado calculado de Programación de Inspección
  vencida: "status-error",
  proxima: "status-warning",
  pendiente: "status-neutral",
  realizada: "status-success",
};

const labelMap: Record<string, string> = {
  salida: "Salida",
  entrada: "Entrada",
  baja: "Baja",
  apta: "Apta",
  requiere_reparacion: "Requiere reparación",
  fuera_servicio: "Fuera de servicio",
  vencida: "Vencida",
  proxima: "Próxima",
  pendiente: "Pendiente",
  realizada: "Realizada",
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