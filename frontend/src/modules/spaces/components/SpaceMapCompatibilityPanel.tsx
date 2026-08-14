import { ArrowSquareOut, ImageSquare, MapPin } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import type { SpaceNode } from "../types";

type SpaceMapCompatibilityPanelProps = {
  node: SpaceNode;
};

/**
 * Spatial nodes do not own images. When a legacy location is linked, the
 * administrator can continue managing its image in the existing map module.
 */
export function SpaceMapCompatibilityPanel({ node }: SpaceMapCompatibilityPanelProps) {
  if (node.kind !== "MODULE") return null;

  return (
    <section className="space-map-panel" aria-labelledby="space-map-title">
      <header>
        <span className="space-section-icon"><MapPin weight="duotone" /></span>
        <div>
          <h2 id="space-map-title">Compatibilidad con mapas</h2>
          <p>Las imágenes continúan administrándose en el catálogo histórico de ambientes.</p>
        </div>
      </header>

      {node.legacyLocation ? (
        <div className="space-map-status is-ready">
          <ImageSquare weight="fill" />
          <div>
            <strong>Ubicación heredada vinculada</strong>
            <span>{node.legacyLocation.code} · {node.legacyLocation.displayName}</span>
          </div>
        </div>
      ) : (
        <div className="space-map-status">
          <ImageSquare weight="duotone" />
          <div>
            <strong>Sin mapa compatible todavía</strong>
            <span>El espacio se puede usar de inmediato sin modificar el catálogo histórico.</span>
          </div>
        </div>
      )}

      <Link className="button button-secondary" to="/administracion/mapas-ambientes">
        Abrir administrador de mapas <ArrowSquareOut />
      </Link>
    </section>
  );
}
