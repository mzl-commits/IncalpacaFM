import {
  ArrowLeft,
  ArrowRight,
  ArrowsClockwise,
  MapPin,
  CaretRight,
  CheckCircle,
  Buildings,
  WarningCircle,
} from "@phosphor-icons/react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  FilterSelect,
  ListFilterPanel,
  type ActiveFilter,
} from "@/components/filters/ListFilterPanel";
import { useListFilterParams } from "@/components/filters/filterUtils";
import { TaxonomySectionNav } from "../components/TaxonomySectionNav";
import { useSpaces } from "@/modules/spaces/spacesQueries";
import { spaceKindLabels, type SpaceKind } from "@/modules/spaces/types";

const FILTER_KEYS = ["q", "kind", "active", "page"] as const;
const PAGE_SIZE = 50;

export function FmCodeCatalogPage() {
  const { values, setValues, clearFilters } = useListFilterParams(FILTER_KEYS);
  
  const page = Number(values.page) || 1;
  const filters = useMemo(() => ({
    q: values.q,
    kind: values.kind as SpaceKind | "",
    active: values.active as "true" | "false" | "",
  }), [values.q, values.kind, values.active]);

  const spacesQuery = useSpaces(filters);
  const allSpaces = spacesQuery.data ?? [];
  
  const totalCount = allSpaces.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  
  const firstResult = (page - 1) * PAGE_SIZE;
  const spaces = allSpaces.slice(firstResult, firstResult + PAGE_SIZE);

  const activeCount = allSpaces.filter(s => s.active).length;
  const archivedCount = allSpaces.filter(s => !s.active).length;

  function updateFilter(key: "q" | "kind" | "active", value: string) {
    setValues({ [key]: value, page: "" });
  }

  const activeFilters: ActiveFilter[] = [];
  if (values.q) {
    activeFilters.push({ key: "q", label: "Búsqueda", value: values.q, onRemove: () => updateFilter("q", "") });
  }
  if (values.kind) {
    activeFilters.push({ key: "kind", label: "Clasificación", value: spaceKindLabels[values.kind as SpaceKind] || values.kind, onRemove: () => updateFilter("kind", "") });
  }
  if (values.active) {
    activeFilters.push({ key: "active", label: "Estado", value: values.active === "true" ? "Operativo" : "Inactivo", onRemove: () => updateFilter("active", "") });
  }

  const kindOptions = Object.entries(spaceKindLabels).map(([value, label]) => ({ value, label }));
  const stateOptions = [
    { value: "true", label: "Operativo (Activo)" },
    { value: "false", label: "Inactivo (Archivado)" }
  ];

  return (
    <section className="taxonomy-page fm-code-page">
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Inicio / Administración / Directorio de espacios</p>
          <h1>Directorio de espacios</h1>
          <p>Consulta general de todos los ambientes, clasificaciones y estado operativo.</p>
        </div>
        <Link className="button button-primary" to="/administracion/espacios/nuevo">
          <Buildings weight="bold" /> Nuevo espacio
        </Link>
      </div>

      <TaxonomySectionNav />

      <dl className="taxonomy-summary fm-code-summary" aria-label="Resumen de espacios">
        <div>
          <header className="taxonomy-summary-card-header">
            <Buildings size={20} weight="bold" />
            <dt>TOTAL ESPACIOS</dt>
          </header>
          <dd>{spacesQuery.isPending ? "—" : totalCount}</dd>
        </div>
        <div>
          <header className="taxonomy-summary-card-header">
            <CheckCircle size={20} weight="bold" />
            <dt>OPERATIVOS</dt>
          </header>
          <dd>{spacesQuery.isPending ? "—" : activeCount}</dd>
        </div>
        <div>
          <header className="taxonomy-summary-card-header">
            <WarningCircle size={20} weight="bold" />
            <dt>INACTIVOS</dt>
          </header>
          <dd>{spacesQuery.isPending ? "—" : archivedCount}</dd>
        </div>
      </dl>

      <div className="data-panel taxonomy-data-panel" aria-busy={spacesQuery.isFetching ? "true" : undefined}>
        {spacesQuery.isPending ? (
          <div className="taxonomy-table-loading" aria-busy="true">
            {Array.from({ length: 6 }, (_, index) => <span key={index} />)}
          </div>
        ) : spacesQuery.isError ? (
          <div className="taxonomy-state-panel" role="alert">
            <WarningCircle size={32} weight="duotone" />
            <strong>No se pudieron cargar los espacios</strong>
            <button className="button button-secondary" type="button" onClick={() => spacesQuery.refetch()}>
              <ArrowsClockwise /> Reintentar
            </button>
          </div>
        ) : (
          <>
            <ListFilterPanel
              title="Lista de ambientes"
              description="Filtra por clasificación y estado operativo del sitio."
              searchLabel="Buscar"
              searchPlaceholder="Buscar por código o nombre"
              searchValue={values.q}
              onSearchChange={(value) => updateFilter("q", value)}
              resultCount={totalCount}
              totalCount={totalCount}
              activeFilters={activeFilters}
              onClear={clearFilters}
              quickFilters={[]}
            >
              <FilterSelect
                label="Clasificación"
                value={values.kind}
                onChange={(value) => updateFilter("kind", value)}
                options={kindOptions}
                allLabel="Cualquier clasificación"
              />
              <FilterSelect
                label="Estado operativo"
                value={values.active}
                onChange={(value) => updateFilter("active", value)}
                options={stateOptions}
                allLabel="Cualquier estado"
              />
            </ListFilterPanel>

            <div className="table-scroll taxonomy-table-wrap">
              <table className="taxonomy-table fm-code-table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Ambiente</th>
                    <th>Clasificación</th>
                    <th>Estado</th>
                    <th>Bienes asignados</th>
                    <th><span className="sr-only">Acciones</span></th>
                  </tr>
                </thead>
                <tbody>
                  {spaces.map((space) => (
                    <tr key={space.id}>
                      <td>
                        <code className="fm-code-value">{space.pathCode || space.code}</code>
                      </td>
                      <td>
                        <strong>{space.name}</strong>
                        <small>{space.legacyLocation?.displayName || "Sin referencia legacy"}</small>
                      </td>
                      <td>
                        <strong>{spaceKindLabels[space.kind as SpaceKind] || space.kind}</strong>
                      </td>
                      <td>
                        <span className={`status ${space.active ? "status-success" : "status-neutral"}`}>
                          {space.active ? "Operativo" : "Inactivo"}
                        </span>
                      </td>
                      <td>
                        {space.usage?.activeAssignments || 0} bienes
                      </td>
                      <td>
                        <Link className="fm-code-detail-link" to={`/administracion/espacios/${space.id}`}>
                          Ver detalle <CaretRight />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!spaces.length && (
              <div className="taxonomy-filter-empty">
                <MapPin size={26} />
                <strong>No hay ambientes que coincidan</strong>
                <p>Ajusta o restablece los filtros para ampliar la búsqueda.</p>
                <button type="button" onClick={clearFilters}>Restablecer filtros</button>
              </div>
            )}

            {totalCount > PAGE_SIZE && (
              <nav className="fm-code-pagination" aria-label="Paginación">
                <p aria-live="polite">
                  Mostrando <strong>{firstResult + 1}–{Math.min(firstResult + PAGE_SIZE, totalCount)}</strong> de {totalCount}
                </p>
                <div>
                  <button type="button" disabled={page <= 1} onClick={() => setValues({ page: String(page - 1) })}>
                    <ArrowLeft /> Anterior
                  </button>
                  <span>Página <strong>{page}</strong> de {totalPages}</span>
                  <button type="button" disabled={page >= totalPages} onClick={() => setValues({ page: String(page + 1) })}>
                    Siguiente <ArrowRight />
                  </button>
                </div>
              </nav>
            )}
          </>
        )}
      </div>
    </section>
  );
}
