import {
  Funnel,
  MagnifyingGlass,
  Plus,
  WarningCircle,
  Folder
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { TaxonomySectionNav } from "../components/TaxonomySectionNav";
import { TaxonomyTreeExplorer } from "../components/TaxonomyTreeExplorer";
import { TaxonomyInspector } from "../components/TaxonomyInspector";
import {
  TaxonomyFamilyForm,
  TaxonomyTypeForm,
  TaxonomyPartForm,
  TaxonomyPieceForm
} from "../components/TaxonomyForms";
import {
  useTaxonomyTree,
  useCreateTaxonomyFamily,
  useUpdateTaxonomyFamily,
  useCreateTaxonomy,
  useUpdateTaxonomy,
  useCreateTaxonomyPart,
  useUpdateTaxonomyPart,
  useCreateTaxonomyPiece,
  useUpdateTaxonomyPiece
} from "../taxonomyQueries";
import type { TaxonomyTreeFamily, TaxonomyTreeType, TaxonomyTreePart, TaxonomyTreePiece } from "../types";

type EntityType = "FAMILY" | "TYPE" | "PART" | "PIECE";
type Selection = { entity: EntityType; id: string } | null;
type ViewMode = "INSPECT" | "EDIT" | "ADD_CHILD" | "ADD_ROOT";

function flattenTree(families: TaxonomyTreeFamily[]) {
  const nodes: { id: string; entity: EntityType; data: any }[] = [];
  for (const family of families) {
    nodes.push({ id: family.id, entity: "FAMILY", data: family });
    for (const type of family.types || []) {
      nodes.push({ id: type.id, entity: "TYPE", data: type });
      for (const part of type.parts || []) {
        nodes.push({ id: part.id, entity: "PART", data: part });
        for (const piece of part.pieces || []) {
          nodes.push({ id: piece.id, entity: "PIECE", data: piece });
        }
      }
    }
  }
  return nodes;
}

export function TaxonomyCatalogPage() {
  const [query, setQuery] = useState("");
  const treeQuery = useTaxonomyTree();
  const families = useMemo(() => treeQuery.data ?? [], [treeQuery.data]);
  const allNodes = useMemo(() => flattenTree(families), [families]);

  const [selection, setSelection] = useState<Selection>(null);
  const [mode, setMode] = useState<ViewMode>("INSPECT");

  const normalizedQuery = query.trim().toLocaleLowerCase("es-PE");
  const visibleIds = useMemo(() => {
    if (!normalizedQuery) return new Set(allNodes.map(n => n.id));
    const ids = new Set<string>();
    for (const node of allNodes) {
      const match = node.data.name?.toLocaleLowerCase("es-PE").includes(normalizedQuery) ||
                    node.data.code?.toLocaleLowerCase("es-PE").includes(normalizedQuery) ||
                    node.data.prefix?.toLocaleLowerCase("es-PE").includes(normalizedQuery) ||
                    node.data.partCode?.toLocaleLowerCase("es-PE").includes(normalizedQuery) ||
                    node.data.pieceCode?.toLocaleLowerCase("es-PE").includes(normalizedQuery);
      if (match) {
        ids.add(node.id);
        // Include parents
        if (node.entity === "TYPE") {
          const family = families.find(f => f.types?.some(t => t.id === node.id));
          if (family) ids.add(family.id);
        } else if (node.entity === "PART") {
          families.forEach(f => f.types?.forEach(t => {
            if (t.parts?.some(p => p.id === node.id)) { ids.add(t.id); ids.add(f.id); }
          }));
        } else if (node.entity === "PIECE") {
          families.forEach(f => f.types?.forEach(t => t.parts?.forEach(p => {
            if (p.pieces?.some(pc => pc.id === node.id)) { ids.add(p.id); ids.add(t.id); ids.add(f.id); }
          })));
        }
      }
    }
    return ids;
  }, [allNodes, families, normalizedQuery]);

  useEffect(() => {
    if (!selection && families.length > 0 && mode === "INSPECT") {
      setSelection({ entity: "FAMILY", id: families[0].id });
    }
  }, [selection, families, mode]);

  const selectedNodeData = selection ? allNodes.find(n => n.id === selection.id && n.entity === selection.entity)?.data : null;

  // Mutations
  const createFamily = useCreateTaxonomyFamily();
  const updateFamily = useUpdateTaxonomyFamily(selection?.id ?? "");
  const createType = useCreateTaxonomy();
  const updateType = useUpdateTaxonomy(selection?.id ?? "");
  const createPart = useCreateTaxonomyPart();
  const updatePart = useUpdateTaxonomyPart(selection?.id ?? "");
  const createPiece = useCreateTaxonomyPiece();
  const updatePiece = useUpdateTaxonomyPiece(selection?.id ?? "");

  const busy =
    createFamily.isPending || updateFamily.isPending ||
    createType.isPending || updateType.isPending ||
    createPart.isPending || updatePart.isPending ||
    createPiece.isPending || updatePiece.isPending;

  function selectNode(id: string, entityType: EntityType) {
    setSelection({ entity: entityType, id });
    setMode("INSPECT");
  }

  function handleAddChild(parentId: string, parentType: EntityType) {
    setSelection({ entity: parentType, id: parentId });
    setMode("ADD_CHILD");
  }

  async function handleSubmit(input: any) {
    if (mode === "ADD_ROOT") {
      const created = await createFamily.mutateAsync(input);
      setSelection({ entity: "FAMILY", id: created.id });
      setMode("INSPECT");
      return;
    }

    if (mode === "EDIT" && selection) {
      if (selection.entity === "FAMILY") await updateFamily.mutateAsync(input);
      else if (selection.entity === "TYPE") await updateType.mutateAsync(input);
      else if (selection.entity === "PART") await updatePart.mutateAsync(input);
      else if (selection.entity === "PIECE") await updatePiece.mutateAsync(input);
      setMode("INSPECT");
      return;
    }

    if (mode === "ADD_CHILD" && selection) {
      if (selection.entity === "FAMILY") {
        const created = await createType.mutateAsync(input);
        setSelection({ entity: "TYPE", id: created.id });
      } else if (selection.entity === "TYPE") {
        const created = await createPart.mutateAsync(input);
        setSelection({ entity: "PART", id: created.id });
      } else if (selection.entity === "PART") {
        const created = await createPiece.mutateAsync(input);
        setSelection({ entity: "PIECE", id: created.id });
      }
      setMode("INSPECT");
      return;
    }
  }

  function renderRightPane() {
    if (mode === "ADD_ROOT") {
      return (
        <div className="space-inspector-pane-content">
          <TaxonomyFamilyForm busy={busy} submitLabel="Crear Familia" onSubmit={handleSubmit} />
        </div>
      );
    }

    if (mode === "ADD_CHILD" && selection) {
      if (selection.entity === "FAMILY") {
        return <div className="space-inspector-pane-content"><TaxonomyTypeForm familyId={selection.id} busy={busy} submitLabel="Crear Tipo" onSubmit={handleSubmit} /></div>;
      }
      if (selection.entity === "TYPE") {
        return <div className="space-inspector-pane-content"><TaxonomyPartForm typeId={selection.id} busy={busy} submitLabel="Crear Parte" onSubmit={handleSubmit} /></div>;
      }
      if (selection.entity === "PART") {
        return <div className="space-inspector-pane-content"><TaxonomyPieceForm partId={selection.id} busy={busy} submitLabel="Crear Pieza" onSubmit={handleSubmit} /></div>;
      }
    }

    if (mode === "EDIT" && selection && selectedNodeData) {
      if (selection.entity === "FAMILY") {
        return <div className="space-inspector-pane-content"><TaxonomyFamilyForm initialData={selectedNodeData} busy={busy} submitLabel="Guardar Cambios" onSubmit={handleSubmit} /></div>;
      }
      if (selection.entity === "TYPE") {
        // Need to fetch full detail if missing fields? Assuming initialData from tree has enough, or we need to handle it.
        // For type, tree has partial. Let's use it or wait. We might need a separate query for Type detail.
        return <div className="space-inspector-pane-content"><TaxonomyTypeForm familyId={(selectedNodeData as any).familyId ?? ""} initialData={selectedNodeData} busy={busy} submitLabel="Guardar Cambios" onSubmit={handleSubmit} /></div>;
      }
      if (selection.entity === "PART") {
        return <div className="space-inspector-pane-content"><TaxonomyPartForm typeId={(selectedNodeData as any).typeId ?? ""} initialData={selectedNodeData} busy={busy} submitLabel="Guardar Cambios" onSubmit={handleSubmit} /></div>;
      }
      if (selection.entity === "PIECE") {
        return <div className="space-inspector-pane-content"><TaxonomyPieceForm partId={(selectedNodeData as any).partId ?? ""} initialData={selectedNodeData} busy={busy} submitLabel="Guardar Cambios" onSubmit={handleSubmit} /></div>;
      }
    }

    return (
      <div className="space-inspector-pane-content">
        <TaxonomyInspector
          node={selectedNodeData}
          nodeType={selection?.entity}
          onEdit={() => setMode("EDIT")}
          onAddChild={() => handleAddChild(selection!.id, selection!.entity)}
        />
      </div>
    );
  }

  const totalFamilies = families.length;
  const totalTypes = families.reduce((acc, f) => acc + (f.types?.length || 0), 0);
  const totalParts = families.reduce((acc, f) => acc + (f.types?.reduce((tAcc, t) => tAcc + (t.parts?.length || 0), 0) || 0), 0);
  const totalPieces = families.reduce((acc, f) => acc + (f.types?.reduce((tAcc, t) => tAcc + (t.parts?.reduce((pAcc, p) => pAcc + (p.pieces?.length || 0), 0) || 0), 0) || 0), 0);

  return (
    <section className="spaces-page taxonomy-page">
      <div className="page-heading spaces-page-heading">
        <div>
          <p className="breadcrumb">Inicio / Administración / Estructura de clasificación</p>
          <h1>Estructura de clasificación</h1>
          <p>Organiza la jerarquía taxonómica de los bienes (Familia, Tipo, Parte, Pieza).</p>
        </div>
        <div className="spaces-page-actions">
          <button className="button button-primary" onClick={() => setMode("ADD_ROOT")}>
            <Plus />Nueva familia
          </button>
        </div>
      </div>

      <TaxonomySectionNav />

      <dl className="spaces-summary taxonomy-summary" aria-label="Resumen del catálogo">
        <div><dt>Familias</dt><dd>{totalFamilies}</dd><small>Raíces</small></div>
        <div><dt>Tipos</dt><dd>{totalTypes}</dd><small>Clasificación</small></div>
        <div><dt>Partes</dt><dd>{totalParts}</dd><small>Componentes</small></div>
        <div><dt>Piezas</dt><dd>{totalPieces}</dd><small>Repuestos</small></div>
      </dl>

      <section className="spaces-workspace" aria-label="Administrador taxonómico">
        <aside className="spaces-explorer">
          <header>
            <div><Funnel weight="duotone" /><strong>Estructura</strong></div>
            <span>{visibleIds.size} coincidencia{visibleIds.size === 1 ? "" : "s"}</span>
          </header>
          <div className="spaces-explorer-filters">
            <label className="spaces-search">
              <MagnifyingGlass />
              <span className="sr-only">Buscar</span>
              <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Código o nombre..." />
            </label>
          </div>
          {treeQuery.isPending ? <div className="spaces-tree-loading">Cargando estructura…</div>
          : treeQuery.isError ? <div className="spaces-tree-error" role="alert"><WarningCircle weight="fill" /><strong>Error: {treeQuery.error?.message || "Desconocido"}</strong><button type="button" onClick={() => void treeQuery.refetch()}>Reintentar</button></div>
          : <SpaceTreeExplorerWrapper families={families} selectedId={selection?.id ?? ""} onSelect={selectNode} onAddChild={handleAddChild} visibleIds={visibleIds} />}
        </aside>

        <main className="spaces-inspector-pane">
          {renderRightPane()}
        </main>
      </section>
    </section>
  );
}

// Wrapper for css styling reused from spaces
function SpaceTreeExplorerWrapper(props: any) {
  return (
    <div className="space-tree-wrapper taxonomy-tree-wrapper">
      <TaxonomyTreeExplorer {...props} />
    </div>
  );
}
