import {
  Folder,
  Tag,
  MapPin,
  PencilSimple,
  Plus,
  Info,
  FlowArrow,
  Archive,
  ArrowCounterClockwise,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import { useState } from "react";
import { getApiErrorMessage } from "@/utils/httpError";
import {
  useSetTaxonomyActive,
  useUpdateTaxonomyFamily,
  useUpdateTaxonomyPart,
  useUpdateTaxonomyPiece,
  useDeleteTaxonomy,
  useDeleteTaxonomyFamily,
  useDeleteTaxonomyPart,
  useDeleteTaxonomyPiece,
} from "../taxonomyQueries";
import type { TaxonomyTreeFamily, TaxonomyTreePart, TaxonomyTreePiece, TaxonomyTreeType } from "../types";

type TaxonomyNode = TaxonomyTreeFamily | TaxonomyTreeType | TaxonomyTreePart | TaxonomyTreePiece;

type TaxonomyInspectorProps = {
  node?: TaxonomyNode | null;
  nodeType?: "FAMILY" | "TYPE" | "PART" | "PIECE" | null;
  onEdit?: () => void;
  onAddChild?: () => void;
  compact?: boolean;
};

function TaxonomyEntityActions({
  node,
  nodeType,
  disabled,
}: {
  node: TaxonomyNode;
  nodeType: "FAMILY" | "TYPE" | "PART" | "PIECE";
  disabled?: boolean;
}) {
  const setTaxonomyActive = useSetTaxonomyActive();
  const updateFamily = useUpdateTaxonomyFamily(node.id);
  const updatePart = useUpdateTaxonomyPart(node.id);
  const updatePiece = useUpdateTaxonomyPiece(node.id);
  
  const deleteTaxonomy = useDeleteTaxonomy();
  const deleteFamily = useDeleteTaxonomyFamily();
  const deletePart = useDeleteTaxonomyPart();
  const deletePiece = useDeleteTaxonomyPiece();

  const [actionType, setActionType] = useState<"toggle" | "delete" | null>(null);
  const [error, setError] = useState("");

  const isPending = 
    setTaxonomyActive.isPending || updateFamily.isPending || updatePart.isPending || updatePiece.isPending ||
    deleteTaxonomy.isPending || deleteFamily.isPending || deletePart.isPending || deletePiece.isPending;

  const noun = nodeType === "FAMILY" ? "familia" : nodeType === "TYPE" ? "tipo" : nodeType === "PART" ? "parte" : "pieza";

  async function handleToggle() {
    setError("");
    try {
      if (nodeType === "TYPE") {
        await setTaxonomyActive.mutateAsync({ id: node.id, active: !node.active });
      } else if (nodeType === "FAMILY") {
        const payload = { ...node, active: !node.active } as any;
        await updateFamily.mutateAsync(payload);
      } else if (nodeType === "PART") {
        const payload = { ...node, typeId: (node as TaxonomyTreePart).parentId, partCode: (node as TaxonomyTreePart).partCode, active: !node.active } as any;
        await updatePart.mutateAsync(payload);
      } else if (nodeType === "PIECE") {
        const payload = { ...node, partId: (node as TaxonomyTreePiece).parentId, pieceCode: (node as TaxonomyTreePiece).pieceCode, active: !node.active } as any;
        await updatePiece.mutateAsync(payload);
      }
      setActionType(null);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, `No se pudo actualizar la ${noun}.`));
    }
  }

  async function handleDelete() {
    setError("");
    try {
      if (nodeType === "TYPE") await deleteTaxonomy.mutateAsync(node.id);
      else if (nodeType === "FAMILY") await deleteFamily.mutateAsync(node.id);
      else if (nodeType === "PART") await deletePart.mutateAsync(node.id);
      else if (nodeType === "PIECE") await deletePiece.mutateAsync(node.id);
      
      setActionType(null);
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, `No se pudo borrar la ${noun}.`));
    }
  }

  if (actionType === "toggle") {
    return (
      <div className="space-state-confirm" role="alert">
        <p>{node.active ? `¿Marcar esta ${noun} como No operativa?` : `¿Marcar esta ${noun} como Operativa?`}</p>
        {error && <small><WarningCircle weight="fill" />{error}</small>}
        <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
          <button type="button" className="button button-secondary" onClick={() => setActionType(null)}>Cancelar</button>
          <button type="button" className="button button-primary" onClick={() => void handleToggle()} disabled={isPending}>
            {isPending ? "Procesando…" : node.active ? "Confirmar inactividad" : "Confirmar activación"}
          </button>
        </div>
      </div>
    );
  }

  if (actionType === "delete") {
    return (
      <div className="space-state-confirm" role="alert" style={{ borderLeftColor: "var(--error, #dc2626)", backgroundColor: "var(--error-bg, #fef2f2)" }}>
        <p style={{ color: "var(--error, #dc2626)" }}>¿Borrar permanentemente esta {noun}? Esta acción no se puede deshacer.</p>
        {error && <small style={{ color: "var(--error, #dc2626)" }}><WarningCircle weight="fill" />{error}</small>}
        <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
          <button type="button" className="button button-secondary" onClick={() => setActionType(null)}>Cancelar</button>
          <button type="button" className="button button-primary" style={{ backgroundColor: "var(--error, #dc2626)", borderColor: "var(--error, #dc2626)", color: "white" }} onClick={() => void handleDelete()} disabled={isPending}>
            {isPending ? "Borrando…" : "Sí, borrar permanentemente"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "16px" }}>
      <button 
        className="button button-secondary" 
        type="button" 
        onClick={() => setActionType("toggle")} 
        disabled={disabled || isPending}
      >
        {node.active ? <Archive /> : <ArrowCounterClockwise />}{node.active ? "No operativo" : "Operativo"}
      </button>
      <button 
        className="button button-secondary" 
        type="button" 
        onClick={() => setActionType("delete")} 
        disabled={disabled || isPending}
        style={{ color: "var(--error, #dc2626)", borderColor: "var(--error-border, #fca5a5)" }}
      >
        <Trash /> Borrar
      </button>
    </div>
  );
}

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
      <div className="space-inspector-actions" style={{ flexDirection: "column", alignItems: "flex-start" }}>
        <div style={{ display: "flex", gap: "8px" }}>
          {onEdit && <button className="button button-secondary" onClick={onEdit}><PencilSimple />Editar</button>}
          {onAddChild && !isPiece && node.active && (
            <button className="button button-primary" onClick={onAddChild}>
              <Plus />Añadir {isFamily ? "Tipo" : isType ? "Parte" : "Pieza"}
            </button>
          )}
        </div>
        <TaxonomyEntityActions node={node} nodeType={nodeType} />
      </div>
    </section>
  );
}
