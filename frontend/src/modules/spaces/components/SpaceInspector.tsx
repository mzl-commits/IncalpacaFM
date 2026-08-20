import {
  Archive,
  ArrowCounterClockwise,
  ArrowSquareOut,
  Buildings,
  CaretRight,
  CheckCircle,
  MapPin,
  PencilSimple,
  Plus,
  Trash,
  WarningCircle,
  ImageSquare,
} from "@phosphor-icons/react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getApiErrorMessage } from "@/utils/httpError";
import { 
  useSetSiteActive, 
  useSetSpaceNodeActive, 
  useDeleteSite, 
  useDeleteSpaceNode, 
  useSpaceImpact, 
  useSpaceOptions 
} from "../spacesQueries";
import type { SpaceNode, SpaceSite, SpaceTreeNode } from "../types";
import { spaceKindLabels } from "../types";
import { SpaceMapCompatibilityPanel } from "./SpaceMapCompatibilityPanel";
import { SpaceMetricsPanel } from "./SpaceMetricsPanel";

type SpaceInspectorProps = {
  node?: SpaceNode | null;
  site?: SpaceSite | null;
  treeNode?: SpaceTreeNode | null;
  compact?: boolean;
  onChanged?: () => void;
};

function addressLabel(site: SpaceSite) {
  return [site.address.addressLine, site.address.district, site.address.province, site.address.department, site.address.country]
    .filter(Boolean)
    .join(" · ");
}

function EntityActions({
  entity,
  id,
  active,
  disabled,
  onChanged,
}: {
  entity: "site" | "node";
  id: string;
  active: boolean;
  disabled?: boolean;
  onChanged?: () => void;
}) {
  const nodeState = useSetSpaceNodeActive();
  const siteState = useSetSiteActive();
  const deleteSite = useDeleteSite();
  const deleteNode = useDeleteSpaceNode();
  
  const [actionType, setActionType] = useState<"toggle" | "delete" | null>(null);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const toggleMutation = entity === "site" ? siteState : nodeState;
  const deleteMutation = entity === "site" ? deleteSite : deleteNode;
  const noun = entity === "site" ? "sede" : "espacio";
  const isPending = toggleMutation.isPending || deleteMutation.isPending;

  async function handleToggle() {
    setError("");
    try {
      await toggleMutation.mutateAsync({ id, active: !active });
      setActionType(null);
      onChanged?.();
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, `No se pudo actualizar la ${noun}.`));
    }
  }

  async function handleDelete() {
    setError("");
    try {
      await deleteMutation.mutateAsync(id);
      setActionType(null);
      navigate("/administracion/espacios", { replace: true });
    } catch (requestError) {
      setError(getApiErrorMessage(requestError, `No se pudo borrar la ${noun}.`));
    }
  }

  if (actionType === "toggle") {
    return (
      <div className="space-state-confirm" role="alert">
        <p>{active ? `¿Marcar esta ${noun} como No operativa? Se conservará su historial y el sistema validará dependencias.` : `¿Marcar esta ${noun} como Operativa? Volverá a estar disponible para nuevos registros.`}</p>
        {error && <small><WarningCircle weight="fill" />{error}</small>}
        <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
          <button type="button" className="button button-secondary" onClick={() => setActionType(null)}>Cancelar</button>
          <button type="button" className="button button-primary" onClick={() => void handleToggle()} disabled={isPending}>
            {isPending ? "Procesando…" : active ? "Confirmar inactividad" : "Confirmar activación"}
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
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
      <button 
        className="button button-secondary" 
        type="button" 
        onClick={() => setActionType("toggle")} 
        disabled={isPending}
      >
        {active ? <Archive /> : <ArrowCounterClockwise />}{active ? "No operativo" : "Operativo"}
      </button>
      <button 
        className="button button-secondary" 
        type="button" 
        onClick={() => setActionType("delete")} 
        disabled={isPending}
        style={{ color: "var(--error, #dc2626)", borderColor: "var(--error-border, #fca5a5)" }}
      >
        <Trash /> Borrar
      </button>
    </div>
  );
}

export function SpaceInspector({ node, site, treeNode, compact = false, onChanged }: SpaceInspectorProps) {
  const impactQuery = useSpaceImpact(node?.id);
  const childOptionsQuery = useSpaceOptions(node?.siteId, node?.id, Boolean(node));
  const impact = impactQuery.data;

  if (!node && !site) {
    return (
      <section className="space-inspector-empty">
        <Buildings weight="duotone" />
        <strong>Selecciona una sede o espacio</strong>
        <span>Podrás revisar su estructura, medidas y compatibilidad con mapas.</span>
      </section>
    );
  }

  if (site) {
    const siteTree = treeNode?.children ?? [];
    const siteEditUrl = `/administracion/espacios/${site.id}/editar?tipo=sede`;
    return (
      <section className={`space-inspector ${compact ? "is-compact" : ""}`} aria-labelledby="space-inspector-title">
        <header className="space-inspector-header">
          <div><span className="space-inspector-icon"><Buildings weight="duotone" /></span><div><p>Sede</p><h2 id="space-inspector-title">{site.name}</h2><code>{site.code}</code></div></div>
          <span className={`status ${site.active ? "status-success" : "status-neutral"}`}>{site.active ? "Activa" : "Archivada"}</span>
        </header>
        <dl className="space-inspector-facts">
          <div><dt>Dirección</dt><dd>{addressLabel(site) || "Pendiente de registrar"}</dd></div>
          <div><dt>Estructura activa</dt><dd>{siteTree.length} nodo{siteTree.length === 1 ? "" : "s"} raíz</dd></div>
        </dl>
        <div className="space-inspector-actions">
          <Link className="button button-secondary" to={siteEditUrl}><PencilSimple />Editar sede</Link>
          {site.active && <Link className="button button-primary" to={`/administracion/espacios/nuevo?sede=${site.id}`}><Plus />Crear primer nivel</Link>}
          <EntityActions entity="site" id={site.id} active={site.active} onChanged={onChanged} />
        </div>
        {siteTree.length > 0 && <p className="space-inspector-note"><InfoCircle />Archiva los nodos activos antes de archivar la sede.</p>}
      </section>
    );
  }

  const canAddChild = Boolean(node?.active && childOptionsQuery.data?.allowedNodeTypes.length);
  const detailUrl = `/administracion/espacios/${node!.id}`;
  const impactMessage = impact?.reason || (!impactQuery.isPending && impact && !impact.canArchive ? "Este espacio tiene dependencias activas." : "");

  return (
    <section className={`space-inspector ${compact ? "is-compact" : ""}`} aria-labelledby="space-inspector-title">
      <header className="space-inspector-header">
        <div>
          <span className="space-inspector-icon"><MapPin weight="duotone" /></span>
          <div><p>{spaceKindLabels[node!.kind]}</p><h2 id="space-inspector-title">{node!.name}</h2><code>{node!.pathCode}</code></div>
        </div>
        <span className={`status ${node!.active ? "status-success" : "status-neutral"}`}>{node!.active ? "Activo" : "Archivado"}</span>
      </header>
      <dl className="space-inspector-facts">
        <div><dt>Tipo</dt><dd>{spaceKindLabels[node!.kind]}</dd></div>
        <div><dt>Segmento</dt><dd>{node!.codeSegment}</dd></div>
        <div><dt>Ubicación heredada</dt><dd>{node!.legacyLocation ? <Link to={`/administracion/taxonomia/codigos/${node!.legacyLocation.id}`} className="button-link" style={{ padding: 0, textDecoration: "underline" }}>{node!.legacyLocation.displayName}</Link> : "Sin vincular"}</dd></div>
      </dl>
      {!compact && <SpaceMetricsPanel node={node!} />}
      {!compact && <SpacePhotoPanel node={node!} />}
      {!compact && <SpaceMapCompatibilityPanel node={node!} />}
      {!compact && impact && <dl className="space-impact-summary"><div><dt>Subespacios</dt><dd>{impact.childCount}</dd></div><div><dt>Bienes</dt><dd>{impact.assetCount}</dd></div><div><dt>Usuarios</dt><dd>{impact.userCount}</dd></div><div><dt>Mapas</dt><dd>{impact.mapCount}</dd></div></dl>}
      {impactMessage && <p className="space-inspector-note"><WarningCircle weight="fill" />{impactMessage}</p>}
      <div className="space-inspector-actions">
        <Link className="button button-secondary" to={`${detailUrl}/editar`}><PencilSimple />Editar</Link>
        {node!.active && canAddChild && <Link className="button button-primary" to={`/administracion/espacios/nuevo?sede=${node!.siteId}&padre=${node!.id}`}><Plus />Crear hijo</Link>}
        <EntityActions entity="node" id={node!.id} active={node!.active} onChanged={onChanged} />
        {compact && <Link className="button button-link" to={detailUrl}>Ver detalle <CaretRight /></Link>}
      </div>
      {node!.active && !compact && <Link className="space-inspector-detail-link" to={detailUrl}>Abrir ficha completa <ArrowSquareOut /></Link>}
    </section>
  );
}

function InfoCircle() {
  return <CheckCircle weight="duotone" />;
}

export function SpacePhotoPanel({ node }: { node: SpaceNode }) {
  const [photo, setPhoto] = useState<string | null>(() => {
    return localStorage.getItem(`space_photo_${node.id}`) || node.photoUrl || null;
  });

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (result) {
        setPhoto(result);
        localStorage.setItem(`space_photo_${node.id}`, result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemove = () => {
    setPhoto(null);
    localStorage.removeItem(`space_photo_${node.id}`);
  };

  if (node.nodeType === "MODULE") return null;

  return (
    <div className="space-metrics-panel" style={{ marginTop: "16px", marginBottom: "16px" }}>
      <header className="metrics-header">
        <div>
          <h3>Fotografía del espacio</h3>
          <p>Imagen de referencia para este nivel.</p>
        </div>
      </header>
      <div className="metrics-grid" style={{ gridTemplateColumns: "1fr", padding: "16px" }}>
        {photo ? (
          <div style={{ position: "relative", width: "100%", maxWidth: "400px", borderRadius: "8px", overflow: "hidden", border: "1px solid #e5e5e5" }}>
            <img src={photo} alt={`Fotografía de ${node.name}`} style={{ width: "100%", height: "auto", display: "block" }} />
            <button type="button" onClick={handleRemove} className="button button-secondary" style={{ position: "absolute", top: "8px", right: "8px", padding: "4px 8px", fontSize: "12px", background: "white" }}>Quitar</button>
          </div>
        ) : (
          <div style={{ padding: "24px", textAlign: "center", background: "#f8f9fa", borderRadius: "8px", border: "1px dashed #d4d4d4" }}>
            <p style={{ fontSize: "13px", color: "#666", marginBottom: "12px" }}>No hay imagen de referencia</p>
            <label className="button button-secondary" style={{ cursor: "pointer", display: "inline-flex" }}>
              <span>Subir imagen</span>
              <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
