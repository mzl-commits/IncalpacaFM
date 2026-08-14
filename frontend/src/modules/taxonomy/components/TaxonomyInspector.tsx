import {
  Folder,
  Tag,
  MapPin,
  PencilSimple,
  Plus,
  Info,
  FlowArrow
} from "@phosphor-icons/react";
import type { TaxonomyTreeFamily, TaxonomyTreePart, TaxonomyTreePiece, TaxonomyTreeType } from "../types";

type TaxonomyNode = TaxonomyTreeFamily | TaxonomyTreeType | TaxonomyTreePart | TaxonomyTreePiece;

type TaxonomyInspectorProps = {
  node?: TaxonomyNode | null;
  nodeType?: "FAMILY" | "TYPE" | "PART" | "PIECE" | null;
  onEdit?: () => void;
  onAddChild?: () => void;
  compact?: boolean;
};

export function TaxonomyInspector({ node, nodeType, onEdit, onAddChild, compact = false }: TaxonomyInspectorProps) {
  if (!node || !nodeType) {
    return (
      <section className="space-inspector-empty">
        <Tag weight="duotone" />
        <strong>Selecciona una taxonomía</strong>
        <span>Podrás revisar su estructura y agregar componentes.</span>
      </section>
    );
  }

  const isFamily = nodeType === "FAMILY";
  const isType = nodeType === "TYPE";
  const isPart = nodeType === "PART";
  const isPiece = nodeType === "PIECE";

  const family = isFamily ? (node as TaxonomyTreeFamily) : null;
  const type = isType ? (node as TaxonomyTreeType) : null;
  const part = isPart ? (node as TaxonomyTreePart) : null;
  const piece = isPiece ? (node as TaxonomyTreePiece) : null;

  return (
    <section className={`space-inspector ${compact ? "is-compact" : ""}`} aria-labelledby="space-inspector-title">
      <header className="space-inspector-header">
        <div>
          <span className="space-inspector-icon">
            {isFamily ? <Folder weight="duotone" /> : isPart ? <FlowArrow weight="duotone" /> : <Tag weight="duotone" />}
          </span>
          <div>
            <p>{isFamily ? "Familia" : isType ? "Tipo de bien" : isPart ? "Parte" : "Pieza"}</p>
            <h2 id="space-inspector-title">{node.name}</h2>
            <code>
              {isFamily ? family!.code : isType ? type!.prefix : isPart ? part!.partCode : piece!.pieceCode}
            </code>
          </div>
        </div>
        <span className={`status ${node.active ? "status-success" : "status-neutral"}`}>
          {node.active ? "Activo" : "Inactivo"}
        </span>
      </header>
      <dl className="space-inspector-facts">
        <div><dt>Nombre oficial</dt><dd>{node.name}</dd></div>
        {isType && <div><dt>Bienes registrados</dt><dd>{type!.assetCount}</dd></div>}
      </dl>
      <div className="space-inspector-actions">
        {onEdit && <button className="button button-secondary" onClick={onEdit}><PencilSimple />Editar</button>}
        {onAddChild && !isPiece && node.active && (
          <button className="button button-primary" onClick={onAddChild}>
            <Plus />Añadir {isFamily ? "Tipo" : isType ? "Parte" : "Pieza"}
          </button>
        )}
      </div>
    </section>
  );
}
