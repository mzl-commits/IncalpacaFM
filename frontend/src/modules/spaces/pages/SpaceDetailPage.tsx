import { ArrowLeft, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { SpaceInspector } from "../components/SpaceInspector";
import { useSite, useSpaceNode } from "../spacesQueries";

export function SpaceDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const isSite = searchParams.get("tipo") === "sede";
  const siteQuery = useSite(isSite ? id : undefined);
  const nodeQuery = useSpaceNode(isSite ? undefined : id);
  const query = isSite ? siteQuery : nodeQuery;
  const message = (location.state as { message?: string } | null)?.message;

  return (
    <section className="space-detail-page">
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Administración / Espacios y ambientes / Detalle</p>
          <h1>{isSite ? "Ficha de sede" : "Ficha del espacio"}</h1>
          <p>Consulta la estructura, medidas y dependencias antes de realizar cambios.</p>
        </div>
        <Link className="button button-secondary" to="/administracion/espacios"><ArrowLeft />Volver al administrador</Link>
      </div>
      {message && <p className="space-page-message"><CheckCircle weight="fill" />{message}</p>}
      {query.isPending ? <div className="space-detail-loading">Cargando ficha…</div>
      : query.isError || !query.data ? <div className="space-detail-error" role="alert"><WarningCircle weight="fill" /><strong>No se pudo cargar esta ficha.</strong><Link to="/administracion/espacios">Volver a espacios</Link></div>
      : <SpaceInspector site={isSite ? siteQuery.data : null} node={isSite ? null : nodeQuery.data} />}
    </section>
  );
}
