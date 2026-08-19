/**
 * Estado de vigencia de la inspección de un material/pieza, calculado a partir
 * de la fecha de su última inspección y la periodicidad configurada (en días).
 * Refleja la misma lógica que ProgramacionInspeccion.estado_calculado en el
 * backend (apps/inspeccion/models.py), reducida a los 3 estados relevantes
 * para "última inspección registrada" (no aplica "pendiente"/"realizada",
 * que son propios de una programación del plan anual).
 */
type EstadoVigencia = "vencida" | "proxima" | "al_dia";

const ESTADO_META: Record<EstadoVigencia, { label: string; className: string }> = {
  vencida: { label: "Vencida", className: "trimestre-badge--vencida" },
  proxima: { label: "Próxima", className: "trimestre-badge--proxima" },
  al_dia: { label: "Al día", className: "trimestre-badge--al-dia" },
};

/** A partir de este umbral de días restantes, la inspección se considera "próxima" a vencer. */
const UMBRAL_PROXIMA_DIAS = 15;
const MS_POR_DIA = 1000 * 60 * 60 * 24;

function calcularEstado(fecha: string, periodicidadDias: number): { estado: EstadoVigencia; diasRestantes: number } {
  const proxima = new Date(fecha);
  proxima.setDate(proxima.getDate() + periodicidadDias);
  proxima.setHours(0, 0, 0, 0);

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const diasRestantes = Math.round((proxima.getTime() - hoy.getTime()) / MS_POR_DIA);

  const estado: EstadoVigencia =
    diasRestantes < 0 ? "vencida" : diasRestantes <= UMBRAL_PROXIMA_DIAS ? "proxima" : "al_dia";

  return { estado, diasRestantes };
}

interface TrimestreBadgeProps {
  /** Fecha ISO de la última inspección */
  fecha: string;
  /** Periodicidad de inspección del material, en días (material.periodicidad_inspeccion_dias) */
  periodicidadDias: number;
  /** Si true, muestra el label textual completo en vez de la versión compacta */
  showLabel?: boolean;
}

/**
 * Badge de vigencia de inspección: vencida / próxima (≤15 días) / al día.
 * Solo debe renderizarse cuando la subcategoría tiene plantilla_inspeccion asignada.
 */
export function TrimestreBadge({ fecha, periodicidadDias, showLabel = false }: TrimestreBadgeProps) {
  if (!fecha || !periodicidadDias) return null;

  const { estado, diasRestantes } = calcularEstado(fecha, periodicidadDias);
  const { label, className } = ESTADO_META[estado];

  const detalle =
    estado === "vencida"
      ? `PENDIENTE: faltan ${Math.abs(diasRestantes)} día${Math.abs(diasRestantes) === 1 ? "" : "s"}`
      : estado === "proxima"
        ? `Próxima a vencer en ${diasRestantes} día${diasRestantes === 1 ? "" : "s"}`
        : "EJECUTADO";

  return (
    <span
      className={`trimestre-badge ${className}`}
      title={detalle}
      aria-label={`Estado de vigencia de inspección: ${detalle}`}
    >
      {showLabel ? detalle : label}
    </span>
  );
}