import { ArrowLeft, Buildings, MapPin, WarningCircle } from "@phosphor-icons/react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { getApiErrorMessage } from "@/utils/httpError";
import { TaxonomySectionNav } from "@/modules/taxonomy/components/TaxonomySectionNav";
import { SpaceNodeForm, SpaceSiteForm } from "../components/SpaceForms";
import {
  useCreateSite,
  useCreateSpaceNode,
  useSite,
  useSpaceNode,
  useUpdateSite,
  useUpdateSpaceNode,
} from "../spacesQueries";
import type { SpaceNodeInput, SpaceSiteInput } from "../types";

export function SpaceFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEditing = Boolean(id);
  const isSite = searchParams.get("tipo") === "sede";
  const siteQuery = useSite(isEditing && isSite ? id : undefined);
  const nodeQuery = useSpaceNode(isEditing && !isSite ? id : undefined);
  const createSite = useCreateSite();
  const updateSite = useUpdateSite(id ?? "");
  const createNode = useCreateSpaceNode();
  const updateNode = useUpdateSpaceNode(id ?? "");
  const pending = createSite.isPending || updateSite.isPending || createNode.isPending || updateNode.isPending;
  const error = createSite.error || updateSite.error || createNode.error || updateNode.error;
  const defaultSiteId = searchParams.get("sede") ?? "";
  const defaultParentId = searchParams.get("padre");
  const backTo = isEditing && id ? `/administracion/espacios/${id}${isSite ? "?tipo=sede" : ""}` : "/administracion/espacios";

  async function submitSite(input: SpaceSiteInput) {
    try {
      const result = isEditing && id
        ? await updateSite.mutateAsync(input)
        : await createSite.mutateAsync(input);
      navigate(`/administracion/espacios/${result.id}?tipo=sede`, { state: { message: isEditing ? "Sede actualizada." : "Sede creada. Ya puedes organizar sus espacios." } });
    } catch {
      // The mutation state is rendered below with the field-independent API message.
    }
  }

  async function submitNode(input: SpaceNodeInput) {
    try {
      const result = isEditing && id
        ? await updateNode.mutateAsync(input)
        : await createNode.mutateAsync(input);
      navigate(`/administracion/espacios/${result.id}`, { state: { message: isEditing ? "Espacio actualizado." : "Espacio creado y agregado a la jerarquía." } });
    } catch {
      // The mutation state is rendered below with the field-independent API message.
    }
  }

  const loading = isEditing && (isSite ? siteQuery.isPending : nodeQuery.isPending);
  const loadError = isEditing && (isSite ? siteQuery.isError : nodeQuery.isError);

  return (
    <section className="space-form-page">
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Administración / Espacios y ambientes</p>
          <h1>{isEditing ? (isSite ? "Editar sede" : "Editar espacio") : (isSite ? "Nueva sede" : "Nuevo espacio")}</h1>
          <p>{isSite ? "Registra la sede y su ubicación geográfica antes de estructurar edificios, áreas y ambientes." : "Construye la jerarquía de infraestructura con códigos y medidas operativas consistentes."}</p>
        </div>
        <Link className="button button-secondary" to={backTo}><ArrowLeft />Volver</Link>
      </div>

      <TaxonomySectionNav />

      <div className="space-form-layout">
        <main>
          {loading ? <div className="space-form-loading">Cargando datos…</div>
          : loadError ? <div className="space-form-page-error" role="alert"><WarningCircle weight="fill" /><strong>No se pudieron cargar los datos para editar.</strong><Link to="/administracion/espacios">Volver al administrador</Link></div>
          : isSite ? <SpaceSiteForm site={siteQuery.data} busy={pending} submitLabel={isEditing ? "Guardar sede" : "Crear sede"} onSubmit={submitSite} />
          : <SpaceNodeForm node={nodeQuery.data} defaultSiteId={defaultSiteId} defaultParentId={defaultParentId} busy={pending} submitLabel={isEditing ? "Guardar espacio" : "Crear espacio"} onSubmit={submitNode} />}
          {error && <p className="space-form-page-error" role="alert"><WarningCircle weight="fill" />{getApiErrorMessage(error, "No se pudo guardar. Verifica los datos e inténtalo nuevamente.")}</p>}
        </main>
        <aside className="space-form-help surface-card">
          <span className="space-section-icon">{isSite ? <Buildings weight="duotone" /> : <MapPin weight="duotone" />}</span>
          <h2>{isSite ? "Antes de crear la sede" : "Reglas de la jerarquía"}</h2>
          {isSite ? <ul><li>El código tiene 3 letras y 1 número.</li><li>Una sede es la raíz; no se crea como nodo.</li><li>Su dirección no reemplaza la ubicación interna.</li></ul>
          : <ul><li>El servidor define los tipos válidos según el padre.</li><li>El código de ruta se deriva automáticamente.</li><li>Los m² y aforo son datos propios del espacio.</li><li>Los mapas siguen en el administrador existente.</li></ul>}
        </aside>
      </div>
    </section>
  );
}
