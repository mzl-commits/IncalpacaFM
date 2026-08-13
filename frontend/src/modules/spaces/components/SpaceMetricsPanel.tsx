import { Buildings, UsersThree } from "@phosphor-icons/react";
import type { SpaceNode } from "../types";

type SpaceMetricsPanelProps = {
  node: SpaceNode;
};

function areaLabel(value: number | null) {
  if (value == null) return "Pendiente";
  return `${new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 }).format(value)} m²`;
}

/** Metrics declared on the spatial node; operational counts are not inferred. */
export function SpaceMetricsPanel({ node }: SpaceMetricsPanelProps) {
  const capacity = node.headcount;

  return (
    <section className="space-metrics-panel" aria-labelledby="space-metrics-title">
      <header>
        <div>
          <span className="space-section-icon"><Buildings weight="duotone" /></span>
          <div>
            <h2 id="space-metrics-title">Superficie y capacidad</h2>
            <p>Datos declarados para planificar uso, aforo y superficie del espacio.</p>
          </div>
        </div>
      </header>

      <dl>
        <div>
          <dt>Superficie</dt>
          <dd>{areaLabel(node.squareMeters)}</dd>
          <small>{node.kind === "BUILDING" ? "Total del edificio" : node.kind === "ENVIRONMENT" ? "Área propia del ambiente" : "Medición opcional para este nivel"}</small>
        </div>
        <div>
          <dt>Aforo</dt>
          <dd>{node.commonSpace ? "Espacio común" : capacity == null ? "Pendiente" : `${capacity} personas`}</dd>
          <small>Límite de referencia; no bloquea una asignación justificada.</small>
        </div>
        <div>
          <dt>Tipo de uso</dt>
          <dd>{node.commonSpace ? "Espacio común" : "Uso delimitado"}</dd>
          <small>{node.commonSpace ? "El aforo sirve como referencia operativa." : "Puede tener aforo definido cuando corresponda."}</small>
        </div>
      </dl>

      {node.commonSpace && (
        <p className="space-capacity-note"><UsersThree weight="duotone" />Este espacio se registró como común; el aforo es informativo.</p>
      )}
    </section>
  );
}
