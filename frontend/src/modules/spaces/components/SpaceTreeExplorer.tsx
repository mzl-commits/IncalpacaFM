import { Buildings, CaretDown, CaretRight, MapPin, SquaresFour } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import type { SpaceTreeNode } from "../types";
import { spaceKindLabels } from "../types";

type SpaceTreeExplorerProps = {
  nodes: SpaceTreeNode[];
  selectedId: string;
  onSelect: (id: string) => void;
  visibleIds?: ReadonlySet<string>;
};

function nodeIsVisible(node: SpaceTreeNode, visibleIds: ReadonlySet<string> | undefined): boolean {
  if (!visibleIds) return true;
  return visibleIds.has(node.id) || node.children.some((child) => nodeIsVisible(child, visibleIds));
}

function initialExpanded(nodes: SpaceTreeNode[]) {
  return new Set(nodes.filter((node) => node.children.length > 0).map((node) => node.id));
}

export function SpaceTreeExplorer({ nodes, selectedId, onSelect, visibleIds }: SpaceTreeExplorerProps) {
  const roots = useMemo(
    () => nodes.filter((node) => nodeIsVisible(node, visibleIds)),
    [nodes, visibleIds],
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => initialExpanded(nodes));

  useEffect(() => {
    setExpandedIds((current) => {
      if (current.size || !nodes.length) return current;
      return initialExpanded(nodes);
    });
  }, [nodes]);

  function toggle(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!roots.length) {
    return <div className="space-tree-empty"><MapPin weight="duotone" /><span>No hay espacios que coincidan.</span></div>;
  }

  const renderNode = (node: SpaceTreeNode) => {
    const hasChildren = node.children.some((child) => nodeIsVisible(child, visibleIds));
    const expanded = expandedIds.has(node.id);
    const visibleChildren = node.children.filter((child) => nodeIsVisible(child, visibleIds));

    return (
      <li key={node.id} className={`space-tree-item kind-${node.kind.toLowerCase()}`}>
        <div className={node.id === selectedId ? "is-selected" : ""}>
          {hasChildren ? (
            <button
              className="space-tree-toggle"
              type="button"
              aria-label={`${expanded ? "Contraer" : "Expandir"} ${node.name}`}
              aria-expanded={expanded}
              onClick={() => toggle(node.id)}
            >
              {expanded ? <CaretDown weight="bold" /> : <CaretRight weight="bold" />}
            </button>
          ) : <span className="space-tree-spacer" aria-hidden="true" />}
          <button
            className="space-tree-node"
            type="button"
            aria-current={node.id === selectedId ? "true" : undefined}
            onClick={() => onSelect(node.id)}
          >
            {node.kind === "ENVIRONMENT" ? <MapPin weight="duotone" /> : node.kind === "SITE" ? <Buildings weight="duotone" /> : <SquaresFour weight="duotone" />}
            <span>
              <strong>{node.name}</strong>
              <small>{node.code || spaceKindLabels[node.kind]}{node.usage.assetCount ? ` · ${node.usage.assetCount} bienes` : ""}</small>
            </span>
            {!node.active && <em>Archivado</em>}
          </button>
        </div>
        {hasChildren && expanded && (
          <ul>
            {visibleChildren.map(renderNode)}
          </ul>
        )}
      </li>
    );
  };

  return <ul className="space-tree" aria-label="Jerarquía de espacios">{roots.map(renderNode)}</ul>;
}
