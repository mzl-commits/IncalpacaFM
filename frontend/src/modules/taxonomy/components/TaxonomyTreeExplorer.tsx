import { CaretDown, CaretRight, Folder, Tag, Plus, FlowArrow } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import type { TaxonomyTreeFamily, TaxonomyTreeType, TaxonomyTreePart, TaxonomyTreePiece } from "../types";

type TaxonomyNode = TaxonomyTreeFamily | TaxonomyTreeType | TaxonomyTreePart | TaxonomyTreePiece;

type TaxonomyTreeExplorerProps = {
  families: TaxonomyTreeFamily[];
  selectedId: string | null;
  onSelect: (id: string, entityType: "FAMILY" | "TYPE" | "PART" | "PIECE") => void;
  onAddChild?: (parentId: string, parentType: "FAMILY" | "TYPE" | "PART") => void;
  visibleIds?: ReadonlySet<string>;
};

function nodeIsVisible(nodeId: string, visibleIds: ReadonlySet<string> | undefined): boolean {
  if (!visibleIds) return true;
  return visibleIds.has(nodeId);
}

export function TaxonomyTreeExplorer({ families, selectedId, onSelect, onAddChild, visibleIds }: TaxonomyTreeExplorerProps) {
  // Extract all IDs from all levels to initially expand the ones that have children
  const initialExpanded = useMemo(() => {
    const ids = new Set<string>();
    families.forEach(f => {
      if (f.types?.length) ids.add(f.id);
      f.types?.forEach(t => {
        if (t.parts?.length) ids.add(t.id);
        t.parts?.forEach(p => {
          if (p.pieces?.length) ids.add(p.id);
        });
      });
    });
    return ids;
  }, [families]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(initialExpanded);

  useEffect(() => {
    setExpandedIds((current) => {
      if (current.size || !families.length) return current;
      return initialExpanded;
    });
  }, [families, initialExpanded]);

  function toggle(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!families.length) {
    return <div className="space-tree-empty"><Tag weight="duotone" /><span>No hay taxonomías registradas.</span></div>;
  }

  const renderPiece = (piece: TaxonomyTreePiece, partId: string) => {
    if (!nodeIsVisible(piece.id, visibleIds)) return null;
    return (
      <li key={piece.id} className="space-tree-item kind-module">
        <div className={piece.id === selectedId ? "is-selected" : ""}>
          <span className="space-tree-spacer" aria-hidden="true" />
          <button
            className="space-tree-node"
            type="button"
            aria-current={piece.id === selectedId ? "true" : undefined}
            onClick={() => onSelect(piece.id, "PIECE")}
          >
            <Tag weight="duotone" />
            <span>
              <strong>{piece.name}</strong>
              <small>{piece.pieceCode}</small>
            </span>
            {!piece.active && <em>Inactiva</em>}
          </button>
        </div>
      </li>
    );
  };

  const renderPart = (part: TaxonomyTreePart, typeId: string) => {
    if (!nodeIsVisible(part.id, visibleIds)) return null;
    const hasChildren = part.pieces && part.pieces.length > 0;
    const expanded = expandedIds.has(part.id);

    return (
      <li key={part.id} className="space-tree-item kind-area">
        <div className={part.id === selectedId ? "is-selected" : ""}>
          {hasChildren ? (
            <button
              className="space-tree-toggle"
              type="button"
              onClick={() => toggle(part.id)}
            >
              {expanded ? <CaretDown weight="bold" /> : <CaretRight weight="bold" />}
            </button>
          ) : <span className="space-tree-spacer" aria-hidden="true" />}
          <button
            className="space-tree-node"
            type="button"
            aria-current={part.id === selectedId ? "true" : undefined}
            onClick={() => onSelect(part.id, "PART")}
          >
            <FlowArrow weight="duotone" />
            <span>
              <strong>{part.name}</strong>
              <small>{part.partCode}</small>
            </span>
            {!part.active && <em>Inactiva</em>}
          </button>
          {onAddChild && (
            <button className="space-tree-add" type="button" aria-label="Añadir Pieza" onClick={() => onAddChild(part.id, "PART")}>
              <Plus weight="bold" />
            </button>
          )}
        </div>
        {hasChildren && expanded && (
          <ul>
            {part.pieces!.map(piece => renderPiece(piece, part.id))}
          </ul>
        )}
      </li>
    );
  };

  const renderType = (type: TaxonomyTreeType, familyId: string) => {
    if (!nodeIsVisible(type.id, visibleIds)) return null;
    const hasChildren = type.parts && type.parts.length > 0;
    const expanded = expandedIds.has(type.id);

    return (
      <li key={type.id} className="space-tree-item kind-building">
        <div className={type.id === selectedId ? "is-selected" : ""}>
          {hasChildren ? (
            <button
              className="space-tree-toggle"
              type="button"
              onClick={() => toggle(type.id)}
            >
              {expanded ? <CaretDown weight="bold" /> : <CaretRight weight="bold" />}
            </button>
          ) : <span className="space-tree-spacer" aria-hidden="true" />}
          <button
            className="space-tree-node"
            type="button"
            aria-current={type.id === selectedId ? "true" : undefined}
            onClick={() => onSelect(type.id, "TYPE")}
          >
            <Tag weight="duotone" />
            <span>
              <strong>{type.name}</strong>
              <small>{type.prefix}{type.assetCount ? ` · ${type.assetCount} bienes` : ""}</small>
            </span>
            {!type.active && <em>Inactiva</em>}
          </button>
          {onAddChild && (
            <button className="space-tree-add" type="button" aria-label="Añadir Parte" onClick={() => onAddChild(type.id, "TYPE")}>
              <Plus weight="bold" />
            </button>
          )}
        </div>
        {hasChildren && expanded && (
          <ul>
            {type.parts!.map(part => renderPart(part, type.id))}
          </ul>
        )}
      </li>
    );
  };

  const renderFamily = (family: TaxonomyTreeFamily) => {
    if (!nodeIsVisible(family.id, visibleIds)) return null;
    const hasChildren = family.types && family.types.length > 0;
    const expanded = expandedIds.has(family.id);

    return (
      <li key={family.id} className="space-tree-item kind-site">
        <div className={family.id === selectedId ? "is-selected" : ""}>
          {hasChildren ? (
            <button
              className="space-tree-toggle"
              type="button"
              onClick={() => toggle(family.id)}
            >
              {expanded ? <CaretDown weight="bold" /> : <CaretRight weight="bold" />}
            </button>
          ) : <span className="space-tree-spacer" aria-hidden="true" />}
          <button
            className="space-tree-node"
            type="button"
            aria-current={family.id === selectedId ? "true" : undefined}
            onClick={() => onSelect(family.id, "FAMILY")}
          >
            <Folder weight="duotone" />
            <span>
              <strong>{family.name}</strong>
              <small>{family.code}</small>
            </span>
            {!family.active && <em>Inactiva</em>}
          </button>
          {onAddChild && (
            <button className="space-tree-add" type="button" aria-label="Añadir Tipo" onClick={() => onAddChild(family.id, "FAMILY")}>
              <Plus weight="bold" />
            </button>
          )}
        </div>
        {hasChildren && expanded && (
          <ul>
            {family.types!.map(type => renderType(type, family.id))}
          </ul>
        )}
      </li>
    );
  };

  return <ul className="space-tree" aria-label="Jerarquía de taxonomía">{families.map(renderFamily)}</ul>;
}
