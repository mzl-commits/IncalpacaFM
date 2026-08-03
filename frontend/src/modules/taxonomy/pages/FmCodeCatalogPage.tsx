import {
  ArrowLeft,
  ArrowRight,
  ArrowsClockwise,
  Barcode,
  CaretRight,
  CheckCircle,
  LinkSimple,
  Plus,
  WarningCircle,
} from "@phosphor-icons/react";
import { useEffect, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  FilterSelect,
  ListFilterPanel,
  type ActiveFilter,
  type FilterOption,
} from "@/components/filters/ListFilterPanel";
import { useListFilterParams } from "@/components/filters/filterUtils";
import { TaxonomySectionNav } from "../components/TaxonomySectionNav";
import { useFmCodeAssets, useFmCodeSummary } from "../fmCodeQueries";
import type { FmCodeAsset, FmCodeSummaryOption } from "../types";

const FILTER_KEYS = ["q", "taxonomy", "operational", "assignment", "page"] as const;
const PAGE_SIZE = 25;
const EMPTY_ASSETS: FmCodeAsset[] = [];

function taxonomyLabel(asset: FmCodeAsset) {
  return [asset.taxonomyPrefix, asset.taxonomyName].filter(Boolean).join(" — ") || "Sin taxonomía";
}

function summaryOptions(options: FmCodeSummaryOption[]): FilterOption[] {
  return options.map((option) => ({
    value: option.value,
    label: option.label,
    count: option.count,
  }));
}

function administrativeStatusClass(status: string) {
  const normalized = status
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-PE");
  if (normalized.includes("revision") || normalized.includes("bloquead")) return "status-warning";
  if (
    normalized.includes("baja") ||
    normalized.includes("inactiv") ||
    normalized.includes("retirad")
  )
    return "status-neutral";
  if (normalized.includes("registrad") || normalized.includes("activ")) return "status-success";
  return "status-neutral";
}

function positivePage(value: string) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

export function FmCodeCatalogPage() {
  const location = useLocation();
  const { values, setValues, clearFilters } = useListFilterParams(FILTER_KEYS);
  const page = positivePage(values.page);
  const filters = useMemo(
    () => ({
      state: "issued" as const,
      search: values.q,
      taxonomyId: values.taxonomy,
      operationalStatus: values.operational,
      assignmentStatus: values.assignment,
      ordering: "fm_code" as const,
      page,
      pageSize: PAGE_SIZE,
    }),
    [page, values.assignment, values.operational, values.q, values.taxonomy],
  );
  const assetsQuery = useFmCodeAssets(filters);
  const summaryQuery = useFmCodeSummary();
  const pageData = assetsQuery.data;
  const codes = pageData?.items ?? EMPTY_ASSETS;
  const summary = summaryQuery.data;
  const successMessage = (location.state as { message?: string } | null)?.message;
  const taxonomyOptions = summaryOptions(summary?.taxonomies ?? []);
  const operationalOptions = summaryOptions(summary?.operationalStatuses ?? []);
  const assignmentOptions = summaryOptions(summary?.assignmentStatuses ?? []);
  const hasFilters = Boolean(
    values.q || values.taxonomy || values.operational || values.assignment,
  );
  const resultCount = pageData?.count ?? 0;
  const totalCount = summary?.issuedCount ?? (!hasFilters ? resultCount : 0);
  const totalPages = Math.max(1, Math.ceil(resultCount / PAGE_SIZE));
  const noIssuedCodes = summary
    ? summary.issuedCount === 0
    : !hasFilters && !assetsQuery.isPending && resultCount === 0;

  useEffect(() => {
    if (!assetsQuery.isSuccess || resultCount === 0 || page <= totalPages) return;
    setValues({ page: totalPages === 1 ? "" : String(totalPages) });
  }, [assetsQuery.isSuccess, page, resultCount, setValues, totalPages]);

  function updateFilter(key: "q" | "taxonomy" | "operational" | "assignment", value: string) {
    setValues({ [key]: value, page: "" });
  }

  function setPage(nextPage: number) {
    setValues({ page: nextPage <= 1 ? "" : String(nextPage) });
  }

  const activeFilters: ActiveFilter[] = [];
  if (values.q)
    activeFilters.push({
      key: "q",
      label: "Búsqueda",
      value: values.q,
      onRemove: () => updateFilter("q", ""),
    });
  if (values.taxonomy)
    activeFilters.push({
      key: "taxonomy",
      label: "Taxonomía",
      value:
        taxonomyOptions.find((option) => option.value === values.taxonomy)?.label ?? "Seleccionada",
      onRemove: () => updateFilter("taxonomy", ""),
    });
  if (values.operational)
    activeFilters.push({
      key: "operational",
      label: "Estado operativo",
      value: values.operational,
      onRemove: () => updateFilter("operational", ""),
    });
  if (values.assignment)
    activeFilters.push({
      key: "assignment",
      label: "Asignación",
      value: values.assignment,
      onRemove: () => updateFilter("assignment", ""),
    });

  const firstResult = resultCount ? (page - 1) * PAGE_SIZE + 1 : 0;
  const lastResult = resultCount ? Math.min(page * PAGE_SIZE, resultCount) : 0;

  return (
    <section className="taxonomy-page fm-code-page">
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Administración / Taxonomía / Códigos FM</p>
          <h1>Códigos FM</h1>
          <p>Consulta los identificadores operativos emitidos y su vínculo con cada bien.</p>
        </div>
        <Link className="button button-primary" to="/administracion/taxonomia/codigos/nuevo">
          <Plus /> Asignar código FM
        </Link>
      </div>

      <TaxonomySectionNav />

      {successMessage && (
        <div className="taxonomy-page-message is-success" role="status">
          <CheckCircle size={20} weight="fill" /> {successMessage}
        </div>
      )}

      {summaryQuery.isError && (
        <div className="taxonomy-page-message is-warning" role="status">
          <WarningCircle size={20} weight="fill" />
          <span>El resumen no está disponible; el listado puede seguir consultándose.</span>
          <button type="button" onClick={() => summaryQuery.refetch()}>
            Reintentar resumen
          </button>
        </div>
      )}

      <dl className="taxonomy-summary fm-code-summary" aria-label="Resumen de códigos FM">
        <div>
          <dt>Códigos emitidos</dt>
          <dd>{summaryQuery.isPending ? "—" : (summary?.issuedCount ?? "—")}</dd>
        </div>
        <div>
          <dt>Clasificaciones en uso</dt>
          <dd>{summaryQuery.isPending ? "—" : (summary?.taxonomyCount ?? "—")}</dd>
        </div>
        <div>
          <dt>Bienes sin código</dt>
          <dd>{summaryQuery.isPending ? "—" : (summary?.pendingCount ?? "—")}</dd>
        </div>
        <div>
          <dt>Sin asignar</dt>
          <dd>{summaryQuery.isPending ? "—" : (summary?.unassignedCount ?? "—")}</dd>
        </div>
      </dl>

      <div
        className="data-panel taxonomy-data-panel"
        aria-busy={assetsQuery.isFetching ? "true" : undefined}
      >
        {assetsQuery.isPending ? (
          <div className="taxonomy-table-loading" aria-busy="true">
            {Array.from({ length: 6 }, (_, index) => (
              <span key={index} />
            ))}
            <span className="sr-only">Cargando códigos FM</span>
          </div>
        ) : assetsQuery.isError ? (
          <div className="taxonomy-state-panel" role="alert">
            <WarningCircle size={32} weight="duotone" />
            <strong>No se pudieron cargar los códigos FM</strong>
            <p>La consulta no está disponible. No se modificó ningún bien.</p>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => assetsQuery.refetch()}
            >
              <ArrowsClockwise /> Reintentar
            </button>
          </div>
        ) : noIssuedCodes ? (
          <div className="taxonomy-state-panel">
            <Barcode size={32} weight="duotone" />
            <strong>Aún no hay códigos FM emitidos</strong>
            <p>Asigna una clasificación a un bien existente para generar su primer código.</p>
            <Link className="button button-primary" to="/administracion/taxonomia/codigos/nuevo">
              <LinkSimple /> Asignar código FM
            </Link>
          </div>
        ) : (
          <>
            <ListFilterPanel
              title="Explorar códigos emitidos"
              description="Filtra por clasificación y situación operativa del bien."
              searchLabel="Buscar código o bien"
              searchPlaceholder="Código FM, ID técnico, nombre, marca o modelo"
              searchValue={values.q}
              onSearchChange={(value) => updateFilter("q", value)}
              resultCount={resultCount}
              totalCount={totalCount}
              activeFilters={activeFilters}
              onClear={clearFilters}
              quickFilters={[
                {
                  key: "unassigned",
                  label: "Sin asignar",
                  count: summary?.unassignedCount,
                  active: values.assignment === "Sin asignar",
                  onSelect: () =>
                    updateFilter(
                      "assignment",
                      values.assignment === "Sin asignar" ? "" : "Sin asignar",
                    ),
                },
              ]}
            >
              <FilterSelect
                label="Taxonomía"
                value={values.taxonomy}
                onChange={(value) => updateFilter("taxonomy", value)}
                options={taxonomyOptions}
                allLabel="Todas las taxonomías"
                disabled={summaryQuery.isPending || summaryQuery.isError}
              />
              <FilterSelect
                label="Estado operativo"
                value={values.operational}
                onChange={(value) => updateFilter("operational", value)}
                options={operationalOptions}
                allLabel="Cualquier estado"
                disabled={summaryQuery.isPending || summaryQuery.isError}
              />
              <FilterSelect
                label="Asignación"
                value={values.assignment}
                onChange={(value) => updateFilter("assignment", value)}
                options={assignmentOptions}
                allLabel="Cualquier situación"
                disabled={summaryQuery.isPending || summaryQuery.isError}
              />
            </ListFilterPanel>

            <div className="table-scroll taxonomy-table-wrap">
              <table className="taxonomy-table fm-code-table">
                <thead>
                  <tr>
                    <th>Código FM</th>
                    <th>Bien</th>
                    <th>Taxonomía</th>
                    <th>Estado</th>
                    <th>Asignación</th>
                    <th>
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((asset) => (
                    <tr key={asset.id}>
                      <td>
                        <code className="fm-code-value">{asset.fmCode}</code>
                        <small>ID técnico: {asset.technicalCode}</small>
                      </td>
                      <td>
                        <strong>{asset.name}</strong>
                        <small>
                          {[asset.brand, asset.model].filter(Boolean).join(" · ") ||
                            "Sin marca o modelo"}
                        </small>
                      </td>
                      <td>
                        <strong>{taxonomyLabel(asset)}</strong>
                        <small>
                          {[asset.taxonomyCategory, asset.taxonomySubcategory]
                            .filter(Boolean)
                            .join(" / ")}
                        </small>
                      </td>
                      <td>
                        <span
                          className={`status ${administrativeStatusClass(asset.administrativeStatus)}`}
                        >
                          {asset.administrativeStatus}
                        </span>
                        <small>{asset.operationalStatus}</small>
                      </td>
                      <td>{asset.assignmentStatus}</td>
                      <td>
                        <Link
                          className="fm-code-detail-link"
                          to={`/bienes/${asset.id}`}
                          aria-label={`Ver detalle de ${asset.fmCode}`}
                        >
                          Ver detalle <CaretRight />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="taxonomy-mobile-list fm-code-mobile-list">
              {codes.map((asset) => (
                <article key={asset.id}>
                  <header>
                    <code>{asset.fmCode}</code>
                    <span
                      className={`status ${administrativeStatusClass(asset.administrativeStatus)}`}
                    >
                      {asset.administrativeStatus}
                    </span>
                  </header>
                  <h2>{asset.name}</h2>
                  <p>ID técnico: {asset.technicalCode}</p>
                  <dl>
                    <div>
                      <dt>Taxonomía</dt>
                      <dd>{taxonomyLabel(asset)}</dd>
                    </div>
                    <div>
                      <dt>Asignación</dt>
                      <dd>{asset.assignmentStatus}</dd>
                    </div>
                  </dl>
                  <Link to={`/bienes/${asset.id}`} aria-label={`Ver detalle de ${asset.fmCode}`}>
                    <CaretRight />
                  </Link>
                </article>
              ))}
            </div>

            {!codes.length && (
              <div className="taxonomy-filter-empty">
                <Barcode size={26} />
                <strong>No hay códigos que coincidan</strong>
                <p>Ajusta o restablece los filtros para ampliar la búsqueda.</p>
                <button type="button" onClick={clearFilters}>
                  Restablecer filtros
                </button>
              </div>
            )}

            {resultCount > 0 && (
              <nav className="fm-code-pagination" aria-label="Paginación de códigos FM">
                <p aria-live="polite">
                  Mostrando{" "}
                  <strong>
                    {firstResult}–{lastResult}
                  </strong>{" "}
                  de {resultCount}
                </p>
                <div>
                  <button
                    type="button"
                    disabled={!pageData?.previous || assetsQuery.isFetching}
                    onClick={() => setPage(page - 1)}
                  >
                    <ArrowLeft /> Anterior
                  </button>
                  <span>
                    Página <strong>{page}</strong> de {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={!pageData?.next || assetsQuery.isFetching}
                    onClick={() => setPage(page + 1)}
                  >
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
