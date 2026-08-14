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

const MACRO_GROUPS: Record<string, string> = {
  PP: "Planta de producción",
  AD: "Sectores administrativos",
  CO: "Sectores comerciales",
  RE: "Sectores de retail",
  AL: "Sectores de almacenamiento",
};

function nodeIsVisible(node: SpaceTreeNode, visibleIds: ReadonlySet<string> | undefined): boolean {
  if (!visibleIds) return true;
  return visibleIds.has(node.id) || node.children.some((child) => nodeIsVisible(child, visibleIds));
}

function initialExpanded(nodes: SpaceTreeNode[]) {
  return new Set(nodes.filter((node) => node.children.length > 0).map((node) => node.id));
}

function groupMacroAreas(children: SpaceTreeNode[]): SpaceTreeNode[] {
  const groups = new Map<string, SpaceTreeNode>();
  const others: SpaceTreeNode[] = [];

  for (const child of children) {
    if (child.kind === "MACRO_AREA") {
      const segment = (child as any).codeSegment || child.code?.split("-").pop() || "";
      const prefix = segment.substring(0, 2).toUpperCase();
      if (prefix && MACRO_GROUPS[prefix]) {
        if (!groups.has(prefix)) {
          groups.set(prefix, {
            id: `group-${prefix}`,
            entityType: "node",
            siteId: child.siteId,
            parentId: child.parentId,
            kind: "MACRO_AREA",
            code: prefix,
            pathCode: prefix,
            name: MACRO_GROUPS[prefix],
            active: true,
            squareMeters: null,
            headcount: null,
            commonSpace: false,
            legacyLocation: null,
            usage: { childCount: 0, assetCount: 0, activeAssignments: 0, activePeople: 0 },
            children: [],
          });
        }
        const group = groups.get(prefix)!;
        group.children.push(child);
        group.usage.childCount += 1;
        group.usage.assetCount += child.usage.assetCount;
      } else {
        others.push(child);
      }
    } else {
      others.push(child);
    }
  }

  return [...groups.values(), ...others];
}

export function SpaceTreeExplorer({ nodes, selectedId, onSelect, visibleIds }: SpaceTreeExplorerProps) {
  const roots = useMemo(() => {
    const visibleRoots = nodes.filter((node) => nodeIsVisible(node, visibleIds));
    return visibleRoots.map(root => {
       if (root.kind === "SITE") {
          return { ...root, children: groupMacroAreas(root.children) };
       }
       return root;
    });
  }, [nodes, visibleIds]);

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => initialExpanded(roots));

  useEffect(() => {
    setExpandedIds((current) => {
      if (current.size || !roots.length) return current;
      return initialExpanded(roots);
    });
  }, [roots]);

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
    const isPseudoGroup = node.id.startsWith("group-");
    const hasChildren = node.children.some((child) => nodeIsVisible(child, visibleIds));
    const expanded = expandedIds.has(node.id);
    const visibleChildren = node.children.filter((child) => nodeIsVisible(child, visibleIds));

    return (
      <li key={node.id} className={`space-tree-item kind-${node.kind.toLowerCase()} ${isPseudoGroup ? "is-pseudo-group" : ""}`}>
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
            onClick={() => isPseudoGroup ? toggle(node.id) : onSelect(node.id)}
          >
            {node.kind === "MODULE" ? <MapPin weight="duotone" /> : node.kind === "SITE" ? <Buildings weight="duotone" /> : <SquaresFour weight="duotone" />}
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
