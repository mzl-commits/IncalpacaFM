import {
  ArrowsClockwise,
  Barcode,
  CaretRight,
  CheckCircle,
  PencilSimple,
  Plus,
  Power,
  Tag,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  FilterSelect,
  ListFilterPanel,
  type ActiveFilter,
} from "@/components/filters/ListFilterPanel";
import { buildFilterOptions, useListFilterParams } from "@/components/filters/filterUtils";
import { TaxonomySectionNav } from "../components/TaxonomySectionNav";
import { useSetTaxonomyActive, useTaxonomyCatalog } from "../taxonomyQueries";
import { taxonomyReviewLabels, type TaxonomyRecord, type TaxonomyReviewStatus } from "../types";

const FILTER_KEYS = [
  "q",
  "status",
  "review",
  "type",
  "category",
  "specialty",
  "maintenance",
] as const;
const EMPTY_CATALOG: TaxonomyRecord[] = [];

export function TaxonomyCatalogPage() {
  const location = useLocation();
  const { values, setValue, clearFilters } = useListFilterParams(FILTER_KEYS);
  const catalogQuery = useTaxonomyCatalog({});
  const activation = useSetTaxonomyActive();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [target, setTarget] = useState<TaxonomyRecord | null>(null);
  const [actionError, setActionError] = useState("");
  const catalog = catalogQuery.data ?? EMPTY_CATALOG;
  const successMessage = (location.state as { message?: string } | null)?.message;

  const filtered = useMemo(() => {
    const query = values.q.trim().toLocaleLowerCase("es-PE");
    return catalog.filter((item) => {
      const searchable = [
        item.prefix,
        item.name,
        item.assetType,
        item.category,
        item.subcategory,
        item.specialty,
        ...item.aliases,
      ]
        .join(" ")
        .toLocaleLowerCase("es-PE");
      return (
        (!query || searchable.includes(query)) &&
        (!values.status || item.active === (values.status === "active")) &&
        (!values.review || item.reviewStatus === values.review) &&
        (!values.type || item.assetType === values.type) &&
        (!values.category || item.category === values.category) &&
        (!values.specialty || item.specialty === values.specialty) &&
        (!values.maintenance || item.requiresMaintenance === (values.maintenance === "true"))
      );
    });
  }, [catalog, values]);

  const activeFilters: ActiveFilter[] = [];
  const addFilter = (key: (typeof FILTER_KEYS)[number], label: string, value: string) => {
    if (!value) return;
    activeFilters.push({ key, label, value, onRemove: () => setValue(key, "") });
  };
  addFilter("q", "Búsqueda", values.q);
  addFilter(
    "status",
    "Estado",
    values.status === "active" ? "Activa" : values.status === "inactive" ? "Inactiva" : "",
  );
  addFilter(
    "review",
    "Validación",
    values.review ? taxonomyReviewLabels[values.review as TaxonomyReviewStatus] : "",
  );
  addFilter("type", "Tipo", values.type);
  addFilter("category", "Categoría", values.category);
  addFilter("specialty", "Especialidad", values.specialty);
  addFilter(
    "maintenance",
    "Mantenimiento",
    values.maintenance === "true"
      ? "Requerido"
      : values.maintenance === "false"
        ? "No requerido"
        : "",
  );

  const activeCount = catalog.filter((item) => item.active).length;
  const reviewCount = catalog.filter((item) => item.reviewStatus === "REVIEW").length;
  const inactiveCount = catalog.filter((item) => !item.active).length;
  const blockedCount = catalog.filter((item) => !item.issuanceEnabled).length;
  const typeOptions = buildFilterOptions(catalog.map((item) => item.assetType));
  const categoryOptions = buildFilterOptions(catalog.map((item) => item.category));
  const specialtyOptions = buildFilterOptions(catalog.map((item) => item.specialty));

  function askForStateChange(item: TaxonomyRecord) {
    setTarget(item);
    setActionError("");
    dialogRef.current?.showModal();
  }

  async function confirmStateChange() {
    if (!target) return;
    setActionError("");
    try {
      await activation.mutateAsync({ id: target.id, active: !target.active });
      dialogRef.current?.close();
    } catch {
      setActionError(
        "No se pudo actualizar el estado. Verifica la conexión e inténtalo nuevamente.",
      );
    }
  }

  return (
    <section className="taxonomy-page">
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Administración / Taxonomía</p>
          <h1>Taxonomía de bienes</h1>
          <p>Gobierna prefijos, clasificación y reglas para los nuevos códigos FM.</p>
        </div>
        <Link className="button button-primary" to="/administracion/taxonomia/nueva">
          <Plus /> Nueva taxonomía
        </Link>
      </div>

      <TaxonomySectionNav />

      {successMessage && (
        <div className="taxonomy-page-message is-success" role="status">
          <CheckCircle size={20} weight="fill" /> {successMessage}
        </div>
      )}

      <dl className="taxonomy-summary" aria-label="Resumen del catálogo">
        <div>
          <dt>Activas</dt>
          <dd>{activeCount}</dd>
        </div>
        <div>
          <dt>En revisión</dt>
          <dd>{reviewCount}</dd>
        </div>
        <div>
          <dt>Inactivas</dt>
          <dd>{inactiveCount}</dd>
        </div>
        <div>
          <dt>Emisión bloqueada</dt>
          <dd>{blockedCount}</dd>
        </div>
      </dl>

      <div className="data-panel taxonomy-data-panel">
        {catalogQuery.isPending ? (
          <div className="taxonomy-table-loading" aria-busy="true">
            {Array.from({ length: 6 }, (_, index) => (
              <span key={index} />
            ))}
            <span className="sr-only">Cargando catálogo de taxonomía</span>
          </div>
        ) : catalogQuery.isError ? (
          <div className="taxonomy-state-panel" role="alert">
            <WarningCircle size={32} weight="duotone" />
            <strong>No se pudo cargar la taxonomía</strong>
            <p>El catálogo no está disponible. Los datos existentes no fueron modificados.</p>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => catalogQuery.refetch()}
            >
              <ArrowsClockwise /> Reintentar
            </button>
          </div>
        ) : !catalog.length ? (
          <div className="taxonomy-state-panel">
            <Tag size={32} weight="duotone" />
            <strong>Aún no existe una taxonomía operativa</strong>
            <p>
              Crea el primer prefijo para habilitar la clasificación y generación de códigos FM.
            </p>
            <Link className="button button-primary" to="/administracion/taxonomia/nueva">
              <Plus /> Crear primera taxonomía
            </Link>
          </div>
        ) : (
          <>
            <ListFilterPanel
              title="Explorar taxonomía"
              description="Filtra por jerarquía, validación y disponibilidad para nuevos códigos."
              searchLabel="Buscar prefijo o clasificación"
              searchPlaceholder="AAP, aire acondicionado, especialidad o alias"
              searchValue={values.q}
              onSearchChange={(value) => setValue("q", value)}
              resultCount={filtered.length}
              totalCount={catalog.length}
              activeFilters={activeFilters}
              onClear={clearFilters}
              quickFilters={[
                {
                  key: "active",
                  label: "Activas",
                  count: activeCount,
                  active: values.status === "active",
                  onSelect: () => setValue("status", values.status === "active" ? "" : "active"),
                },
                {
                  key: "review",
                  label: "Requieren revisión",
                  count: reviewCount,
                  active: values.review === "REVIEW",
                  onSelect: () => setValue("review", values.review === "REVIEW" ? "" : "REVIEW"),
                },
                {
                  key: "inactive",
                  label: "Inactivas",
                  count: inactiveCount,
                  active: values.status === "inactive",
                  onSelect: () =>
                    setValue("status", values.status === "inactive" ? "" : "inactive"),
                },
              ]}
            >
              <FilterSelect
                label="Estado"
                value={values.status}
                onChange={(value) => setValue("status", value)}
                options={[
                  { value: "active", label: "Activa", count: activeCount },
                  { value: "inactive", label: "Inactiva", count: inactiveCount },
                ]}
                allLabel="Cualquier estado"
              />
              <FilterSelect
                label="Validación"
                value={values.review}
                onChange={(value) => setValue("review", value)}
                options={[
                  { value: "VALIDATED", label: "Validada" },
                  { value: "REVIEW", label: "Requiere revisión" },
                ]}
                allLabel="Cualquier validación"
              />
              <FilterSelect
                label="Tipo de bien"
                value={values.type}
                onChange={(value) => setValue("type", value)}
                options={typeOptions}
                allLabel="Todos los tipos"
              />
              <FilterSelect
                label="Categoría"
                value={values.category}
                onChange={(value) => setValue("category", value)}
                options={categoryOptions}
                allLabel="Todas las categorías"
              />
              <FilterSelect
                label="Especialidad"
                value={values.specialty}
                onChange={(value) => setValue("specialty", value)}
                options={specialtyOptions}
                allLabel="Todas las especialidades"
              />
              <FilterSelect
                label="Mantenimiento"
                value={values.maintenance}
                onChange={(value) => setValue("maintenance", value)}
                options={[
                  { value: "true", label: "Requerido" },
                  { value: "false", label: "No requerido" },
                ]}
                allLabel="Cualquier regla"
              />
            </ListFilterPanel>

            <div className="table-scroll taxonomy-table-wrap">
              <table className="taxonomy-table">
                <thead>
                  <tr>
                    <th>Prefijo</th>
                    <th>Nombre y jerarquía</th>
                    <th>Especialidad</th>
                    <th>Secuencia</th>
                    <th>Uso</th>
                    <th>Estado</th>
                    <th>
                      <span className="sr-only">Acciones</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <code className="taxonomy-prefix-code">{item.prefix}</code>
                      </td>
                      <td>
                        <strong>{item.name}</strong>
                        <small>
                          {item.assetType} / {item.category} / {item.subcategory}
                        </small>
                      </td>
                      <td>{item.specialty}</td>
                      <td>
                        <strong>
                          {item.prefix}-{"0".repeat(item.sequenceDigits)}
                        </strong>
                        <small>
                          Último:{" "}
                          {item.lastSequence
                            ? `${item.prefix}-${String(item.lastSequence).padStart(item.sequenceDigits, "0")}`
                            : "Sin emisiones"}
                        </small>
                      </td>
                      <td>
                        <strong>{item.assetCount}</strong>
                        <small>bienes</small>
                      </td>
                      <td>
                        <span
                          className={`status ${!item.active ? "status-neutral" : item.reviewStatus === "REVIEW" || !item.issuanceEnabled ? "status-warning" : "status-success"}`}
                        >
                          {!item.active
                            ? "Inactiva"
                            : !item.issuanceEnabled
                              ? "Emisión bloqueada"
                              : taxonomyReviewLabels[item.reviewStatus]}
                        </span>
                      </td>
                      <td>
                        <div className="taxonomy-row-actions">
                          <Link
                            to={`/administracion/taxonomia/codigos?taxonomy=${encodeURIComponent(item.id)}`}
                            aria-label={`Ver códigos de ${item.prefix}`}
                          >
                            <Barcode />
                          </Link>
                          <Link
                            to={`/administracion/taxonomia/${item.id}/editar`}
                            aria-label={`Editar ${item.prefix}`}
                          >
                            <PencilSimple />
                          </Link>
                          <button
                            type="button"
                            onClick={() => askForStateChange(item)}
                            aria-label={`${item.active ? "Desactivar" : "Activar"} ${item.prefix}`}
                          >
                            <Power />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="taxonomy-mobile-list">
              {filtered.map((item) => (
                <article className="taxonomy-classification-card" key={item.id}>
                  <header>
                    <code>{item.prefix}</code>
                    <span className={`status ${item.active ? "status-success" : "status-neutral"}`}>
                      {item.active ? "Activa" : "Inactiva"}
                    </span>
                  </header>
                  <h2>{item.name}</h2>
                  <p>
                    {item.assetType} / {item.category}
                  </p>
                  <dl>
                    <div>
                      <dt>Formato</dt>
                      <dd>
                        {item.prefix}-{"0".repeat(item.sequenceDigits)}
                      </dd>
                    </div>
                    <div>
                      <dt>Bienes</dt>
                      <dd>{item.assetCount}</dd>
                    </div>
                  </dl>
                  <div className="taxonomy-mobile-actions">
                    <Link
                      to={`/administracion/taxonomia/codigos?taxonomy=${encodeURIComponent(item.id)}`}
                      aria-label={`Ver códigos de ${item.prefix}`}
                    >
                      <Barcode /> Códigos
                    </Link>
                    <Link
                      to={`/administracion/taxonomia/${item.id}/editar`}
                      aria-label={`Editar ${item.prefix}`}
                    >
                      Editar <CaretRight />
                    </Link>
                    <button type="button" onClick={() => askForStateChange(item)}>
                      <Power /> {item.active ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {!filtered.length && (
              <div className="taxonomy-filter-empty">
                <Tag size={26} />
                <strong>No hay coincidencias</strong>
                <p>Ajusta o restablece los filtros para ampliar la búsqueda.</p>
                <button type="button" onClick={clearFilters}>
                  Restablecer filtros
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <dialog
        ref={dialogRef}
        className="taxonomy-action-dialog"
        aria-labelledby="taxonomy-action-title"
        onClose={() => setTarget(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) dialogRef.current?.close();
        }}
      >
        {target && (
          <section>
            <header>
              <div>
                <span>{target.active ? "Desactivar taxonomía" : "Activar taxonomía"}</span>
                <h2 id="taxonomy-action-title">
                  {target.prefix} — {target.name}
                </h2>
              </div>
              <button type="button" onClick={() => dialogRef.current?.close()} aria-label="Cerrar">
                <X />
              </button>
            </header>
            <p>
              {target.active
                ? `Dejará de estar disponible para nuevos registros. Los ${target.assetCount} bienes existentes conservarán su código e historial.`
                : "Volverá a estar disponible para clasificar bienes y emitir nuevos códigos FM."}
            </p>
            {actionError && (
              <div className="taxonomy-dialog-error" role="alert">
                <WarningCircle /> {actionError}
              </div>
            )}
            <footer>
              <button
                className="button button-secondary"
                type="button"
                onClick={() => dialogRef.current?.close()}
              >
                Cancelar
              </button>
              <button
                className={`button ${target.active ? "button-danger" : "button-primary"}`}
                type="button"
                disabled={activation.isPending}
                onClick={confirmStateChange}
              >
                {activation.isPending ? "Guardando…" : target.active ? "Desactivar" : "Activar"}
              </button>
            </footer>
          </section>
        )}
      </dialog>
    </section>
  );
}
