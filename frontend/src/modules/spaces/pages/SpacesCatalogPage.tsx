import {
  Buildings,
  Funnel,
  MagnifyingGlass,
  Plus,
  WarningCircle,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SpaceInspector } from "../components/SpaceInspector";
import { SpaceTreeExplorer } from "../components/SpaceTreeExplorer";
import { useSite, useSites, useSpaceNode, useSpaceTree } from "../spacesQueries";
import type { SpaceKind, SpaceTreeNode } from "../types";
import { spaceKindLabels } from "../types";

import { TaxonomySectionNav } from "@/modules/taxonomy/components/TaxonomySectionNav";

type StatusFilter = "" | "true" | "false";
type Selection = { entity: "site" | "node"; id: string } | null;

function flattenTree(nodes: SpaceTreeNode[]): SpaceTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenTree(node.children)]);
}

function matchesTreeNode(node: SpaceTreeNode, query: string, kind: SpaceKind | "", active: StatusFilter) {
  const matchesQuery = !query || [node.code, node.name, node.pathCode].join(" ").toLocaleLowerCase("es-PE").includes(query);
  const matchesKind = !kind || node.kind === kind;
  const matchesState = !active || node.active === (active === "true");
  return matchesQuery && matchesKind && matchesState;
}

export function SpacesCatalogPage() {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<SpaceKind | "">("");
  const [active, setActive] = useState<StatusFilter>("");
  const treeQuery = useSpaceTree(active);
  const sitesQuery = useSites(active);
  const [selection, setSelection] = useState<Selection>(null);
  const tree = useMemo(() => treeQuery.data ?? [], [treeQuery.data]);
  const allTreeNodes = useMemo(() => flattenTree(tree), [tree]);
  const normalizedQuery = query.trim().toLocaleLowerCase("es-PE");
  const visibleIds = useMemo(() => new Set(
    allTreeNodes
      .filter((node) => matchesTreeNode(node, normalizedQuery, kind, active))
      .map((node) => node.id),
  ), [active, allTreeNodes, kind, normalizedQuery]);
  const selectedTreeNode = selection ? allTreeNodes.find((node) => node.id === selection.id && node.entityType === selection.entity) ?? null : null;
  const selectedNodeQuery = useSpaceNode(selection?.entity === "node" ? selection.id : undefined);
  const selectedSiteQuery = useSite(selection?.entity === "site" ? selection.id : undefined);

  useEffect(() => {
    if (selection || !tree.length) return;
    setSelection({ entity: "site", id: tree[0].id });
  }, [selection, tree]);

  useEffect(() => {
    if (!selection || selectedTreeNode) return;
    const fallback = tree[0];
    setSelection(fallback ? { entity: "site", id: fallback.id } : null);
  }, [selectedTreeNode, selection, tree]);

  const activeSites = sitesQuery.data ?? [];
  const totalSpaces = allTreeNodes.filter((node) => node.entityType === "node").length;
  const environments = allTreeNodes.filter((node) => node.kind === "ENVIRONMENT").length;
  const commonSpaces = allTreeNodes.filter((node) => node.entityType === "node" && node.commonSpace).length;
  const archived = allTreeNodes.filter((node) => !node.active).length;

  function selectNode(id: string) {
    const treeNode = allTreeNodes.find((item) => item.id === id);
    if (treeNode) setSelection({ entity: treeNode.entityType, id });
  }

  function refresh() {
    void treeQuery.refetch();
    void sitesQuery.refetch();
    if (selection?.entity === "node") void selectedNodeQuery.refetch();
    if (selection?.entity === "site") void selectedSiteQuery.refetch();
  }

  return (
    <section className="spaces-page">
      <div className="page-heading spaces-page-heading">
        <div>
          <p className="breadcrumb">Administración / Espacios y ambientes</p>
          <h1>Espacios y ambientes</h1>
          <p>Administra sedes, edificios, áreas y ambientes sin mezclarlos con la taxonomía de bienes.</p>
        </div>
        <div className="spaces-page-actions">
          <Link className="button button-secondary" to="/administracion/espacios/nuevo?tipo=sede"><Buildings />Nueva sede</Link>
          <Link className="button button-primary" to="/administracion/espacios/nuevo"><Plus />Nuevo espacio</Link>
        </div>
      </div>

      <TaxonomySectionNav />

      <dl className="spaces-summary" aria-label="Resumen de espacios">
        <div><dt>Sedes</dt><dd>{activeSites.length}</dd><small>Raíces configuradas</small></div>
        <div><dt>Espacios</dt><dd>{totalSpaces}</dd><small>Nodos de infraestructura</small></div>
        <div><dt>Ambientes</dt><dd>{environments}</dd><small>Destinos de bienes</small></div>
        <div><dt>Espacios comunes</dt><dd>{commonSpaces}</dd><small>Aforo informativo</small></div>
        <div><dt>Archivados</dt><dd>{archived}</dd><small>Con historial conservado</small></div>
      </dl>

      <section className="spaces-workspace" aria-label="Administrador espacial">
        <aside className="spaces-explorer">
          <header>
            <div><Funnel weight="duotone" /><strong>Estructura espacial</strong></div>
            <span>{visibleIds.size} coincidencia{visibleIds.size === 1 ? "" : "s"}</span>
          </header>
          <div className="spaces-explorer-filters">
            <label className="spaces-search"><MagnifyingGlass /><span className="sr-only">Buscar espacio</span><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Sede, código o ambiente" /></label>
            <div>
              <label><span>Tipo</span><select value={kind} onChange={(event) => setKind(event.target.value as SpaceKind | "")}><option value="">Todos los tipos</option>{Object.entries(spaceKindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label><span>Estado</span><select value={active} onChange={(event) => setActive(event.target.value as StatusFilter)}><option value="">Todos</option><option value="true">Activos</option><option value="false">Archivados</option></select></label>
            </div>
          </div>
          {treeQuery.isPending ? <div className="spaces-tree-loading">Cargando estructura…</div>
          : treeQuery.isError ? <div className="spaces-tree-error" role="alert"><WarningCircle weight="fill" /><strong>No se pudo cargar la estructura espacial.</strong><button type="button" onClick={() => void treeQuery.refetch()}>Reintentar</button></div>
          : <SpaceTreeExplorer nodes={tree} selectedId={selection?.id ?? ""} onSelect={selectNode} visibleIds={visibleIds} />}
        </aside>

        <main className="spaces-inspector-pane">
          {selection?.entity === "site" && selectedSiteQuery.isPending ? <div className="space-inspector-loading">Cargando sede…</div>
          : selection?.entity === "node" && selectedNodeQuery.isPending ? <div className="space-inspector-loading">Cargando espacio…</div>
          : (selectedSiteQuery.isError || selectedNodeQuery.isError) ? <div className="space-inspector-error" role="alert"><WarningCircle weight="fill" /><strong>No se pudo abrir la ficha seleccionada.</strong><button type="button" onClick={refresh}>Reintentar</button></div>
          : <SpaceInspector
              site={selection?.entity === "site" ? selectedSiteQuery.data : null}
              node={selection?.entity === "node" ? selectedNodeQuery.data : null}
              treeNode={selectedTreeNode}
              onChanged={refresh}
            />}
        </main>
      </section>
    </section>
  );
}
