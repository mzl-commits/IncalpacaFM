/** Calcula el trimestre (1–4) de una fecha ISO dada. */
function calcularTrimestre(fecha: string): 1 | 2 | 3 | 4 {
  const mes = new Date(fecha).getMonth() + 1; // 1-12
  if (mes <= 3) return 1;
  if (mes <= 6) return 2;
  if (mes <= 9) return 3;
  return 4;
}

const TRIMESTRE_META: Record<
  1 | 2 | 3 | 4,
  { label: string; className: string }
> = {
  1: { label: "Q1 Ene-Mar", className: "trimestre-q1" },
  2: { label: "Q2 Abr-Jun", className: "trimestre-q2" },
  3: { label: "Q3 Jul-Sep", className: "trimestre-q3" },
  4: { label: "Q4 Oct-Dic", className: "trimestre-q4" },
};

interface TrimestreBadgeProps {
  /** Fecha ISO de la última inspección */
  fecha: string;
  /** Si true, muestra el label textual además del punto de color */
  showLabel?: boolean;
}

/**
 * Badge de color trimestral para indicar cuándo fue la última inspección.
 * Solo debe renderizarse cuando la subcategoría tiene plantilla_inspeccion asignada.
 */
export function TrimestreBadge({ fecha, showLabel = false }: TrimestreBadgeProps) {
  if (!fecha) return null;
  const trimestre = calcularTrimestre(fecha);
  const { label, className } = TRIMESTRE_META[trimestre];

  return (
    <span
      className={`trimestre-badge ${className}`}
      title={`Última inspección en ${label}`}
      aria-label={`Último trimestre inspeccionado: ${label}`}
    >
      {showLabel ? label : trimestre === 1 ? "Q1" : trimestre === 2 ? "Q2" : trimestre === 3 ? "Q3" : "Q4"}
    </span>
  );
}
