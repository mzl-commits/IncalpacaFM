import { CaretRight, Package, Plus, QrCode } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  FilterSelect,
  ListFilterPanel,
  type ActiveFilter,
} from "@/components/filters/ListFilterPanel";
import {
  buildFilterOptions,
  labelFor,
  useListFilterParams,
} from "@/components/filters/filterUtils";
import { listRegisteredAssets } from "@/modules/assets/assetEntryRepository";
import {
  entryTypeLabels,
  getAssetDisplayCode,
  type RegisteredAsset,
} from "@/modules/assets/entryModel";

const FILTER_KEYS = ["q", "assignment", "entryType", "condition", "criticality", "brand"] as const;

export function AssetInventoryPage() {
  const [assets, setAssets] = useState<RegisteredAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const { values, setValue, clearFilters } = useListFilterParams(FILTER_KEYS);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 50;

  useEffect(() => {
    setCurrentPage(1);
  }, [values]);

  useEffect(() => {
    setIsLoading(true);
    listRegisteredAssets()
      .then(setAssets)
      .catch(() => setError("No se pudo cargar el inventario."))
      .finally(() => setIsLoading(false));
  }, []);

  const assignmentOptions = useMemo(
    () => buildFilterOptions(assets.map((asset) => asset.assignmentStatus)),
    [assets],
  );
  const entryTypeOptions = useMemo(
    () =>
      buildFilterOptions(
        assets.map((asset) => asset.draft.entryType),
        entryTypeLabels,
      ),
    [assets],
  );
  const conditionOptions = useMemo(
    () => buildFilterOptions(assets.map((asset) => asset.draft.condition)),
    [assets],
  );
  const criticalityOptions = useMemo(
    () => buildFilterOptions(assets.map((asset) => asset.draft.criticality)),
    [assets],
  );
  const brandOptions = useMemo(
    () => buildFilterOptions(assets.map((asset) => asset.draft.brand)),
    [assets],
  );

  const filtered = useMemo(() => {
    const query = values.q.toLocaleLowerCase("es").trim();

    return assets.filter((asset) => {
      const searchable = [
        asset.code,
        asset.fmCode,
        asset.draft.name,
        asset.draft.description,
        asset.draft.brand,
        asset.draft.model,
        asset.draft.serialNumber,
      ]
        .join(" ")
        .toLocaleLowerCase("es");

      return (
        (!query || searchable.includes(query)) &&
        (!values.assignment || asset.assignmentStatus === values.assignment) &&
        (!values.entryType || asset.draft.entryType === values.entryType) &&
        (!values.condition || asset.draft.condition === values.condition) &&
        (!values.criticality || asset.draft.criticality === values.criticality) &&
        (!values.brand || asset.draft.brand === values.brand)
      );
    });
  }, [assets, values]);

  const activeFilters: ActiveFilter[] = [];
  if (values.q) {
    activeFilters.push({
      key: "q",
      label: "Búsqueda",
      value: values.q,
      onRemove: () => setValue("q", ""),
    });
  }
  if (values.assignment) {
    activeFilters.push({
      key: "assignment",
      label: "Asignación",
      value: values.assignment,
      onRemove: () => setValue("assignment", ""),
    });
  }
  if (values.entryType) {
    activeFilters.push({
      key: "entryType",
      label: "Ingreso",
      value: labelFor(values.entryType, entryTypeLabels),
      onRemove: () => setValue("entryType", ""),
    });
  }
  if (values.condition) {
    activeFilters.push({
      key: "condition",
      label: "Condición",
      value: values.condition,
      onRemove: () => setValue("condition", ""),
    });
  }
  if (values.criticality) {
    activeFilters.push({
      key: "criticality",
      label: "Criticidad",
      value: values.criticality,
      onRemove: () => setValue("criticality", ""),
    });
  }
  if (values.brand) {
    activeFilters.push({
      key: "brand",
      label: "Marca",
      value: values.brand,
      onRemove: () => setValue("brand", ""),
    });
  }

  const unassignedCount = assets.filter((asset) => asset.assignmentStatus === "Sin asignar").length;
  const regularCount = assets.filter((asset) => asset.draft.condition === "Regular").length;
  const reviewCount = assets.filter(
    (asset) => asset.draft.condition === "Requiere revisión",
  ).length;

  return (
    <section className="asset-inventory-page">
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Inicio / Bienes</p>
          <h1>Bienes</h1>
          <p>Inventario maestro, identificación y trazabilidad de todos los bienes.</p>
        </div>
        <Link className="button button-primary" to="/bienes/entradas/nueva">
          <Plus />
          Registrar bien
        </Link>
      </div>

      <div className="asset-inventory-summary">
        <span>
          <Package /> {assets.length} bienes registrados
        </span>
        <span>
          <QrCode /> {assets.length} identificados con QR
        </span>
      </div>

      <div className="data-panel">
        <ListFilterPanel
          title="Explorar inventario"
          description="Combina atributos administrativos y técnicos del bien."
          searchLabel="Buscar bienes"
          searchPlaceholder="Código, nombre, marca, modelo o número de serie"
          searchValue={values.q}
          onSearchChange={(value) => setValue("q", value)}
          resultCount={filtered.length}
          totalCount={assets.length}
          activeFilters={activeFilters}
          onClear={clearFilters}
          quickFilters={[
            {
              key: "unassigned",
              label: "Sin asignar",
              count: unassignedCount,
              active: values.assignment === "Sin asignar",
              onSelect: () =>
                setValue("assignment", values.assignment === "Sin asignar" ? "" : "Sin asignar"),
            },
            {
              key: "regular",
              label: "Condición regular",
              count: regularCount,
              active: values.condition === "Regular",
              onSelect: () =>
                setValue("condition", values.condition === "Regular" ? "" : "Regular"),
            },
            {
              key: "review",
              label: "Requieren revisión",
              count: reviewCount,
              active: values.condition === "Requiere revisión",
              onSelect: () =>
                setValue(
                  "condition",
                  values.condition === "Requiere revisión" ? "" : "Requiere revisión",
                ),
            },
          ]}
        >
          <FilterSelect
            label="Estado de asignación"
            value={values.assignment}
            onChange={(value) => setValue("assignment", value)}
            options={assignmentOptions}
            allLabel="Cualquier estado"
          />
          <FilterSelect
            label="Tipo de ingreso"
            value={values.entryType}
            onChange={(value) => setValue("entryType", value)}
            options={entryTypeOptions}
            allLabel="Todos los tipos"
          />
          <FilterSelect
            label="Condición"
            value={values.condition}
            onChange={(value) => setValue("condition", value)}
            options={conditionOptions}
            allLabel="Cualquier condición"
          />
          <FilterSelect
            label="Criticidad"
            value={values.criticality}
            onChange={(value) => setValue("criticality", value)}
            options={criticalityOptions}
            allLabel="Cualquier criticidad"
          />
          <FilterSelect
            label="Marca"
            value={values.brand}
            onChange={(value) => setValue("brand", value)}
            options={brandOptions}
            allLabel="Todas las marcas"
          />
        </ListFilterPanel>

        <div className="asset-master-list">
          {isLoading && (
            <div className="skeleton skeleton-block" style={{ gridColumn: "1 / -1", minHeight: "200px", borderRadius: "8px", border: "none" }} aria-label="Cargando inventario" />
          )}
          {!isLoading && filtered.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((asset) => (
            <Link to={`/bienes/${asset.id}`} key={asset.id} className="asset-master-row">
              <div className="asset-master-icon">
                {asset.photoUrl ? <img src={asset.photoUrl} alt="" /> : <Package />}
              </div>
              <div>
                <strong>{asset.draft.name}</strong>
                <span>
                  {getAssetDisplayCode(asset)} ·{" "}
                  {[asset.draft.brand, asset.draft.model].filter(Boolean).join(" ") ||
                    "Sin marca o modelo"}
                </span>
              </div>
              <span
                className={`status ${
                  asset.assignmentStatus === "Sin asignar" ? "status-neutral" : "status-success"
                }`}
              >
                {asset.assignmentStatus}
              </span>
              <span className="asset-master-qr">
                <QrCode /> QR activo
              </span>
              <CaretRight className="asset-master-caret" />
            </Link>
          ))}
          {!isLoading && !filtered.length && (
            <p className="empty-row">{error || "No encontramos bienes con esos criterios."}</p>
          )}
        </div>

        {!isLoading && Math.ceil(filtered.length / ITEMS_PER_PAGE) > 1 && (
          <div style={{ display: "flex", justifyContent: "center", gap: "12px", padding: "24px 0", borderTop: "1px solid var(--border)" }}>
            <button
              type="button"
              className="button button-secondary"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => p - 1)}
            >
              Anterior
            </button>
            <span style={{ display: "flex", alignItems: "center", fontSize: "0.875rem", color: "var(--text-muted)" }}>
              Página {currentPage} de {Math.ceil(filtered.length / ITEMS_PER_PAGE)}
            </span>
            <button
              type="button"
              className="button button-secondary"
              disabled={currentPage === Math.ceil(filtered.length / ITEMS_PER_PAGE)}
              onClick={() => setCurrentPage((p) => p + 1)}
            >
              Siguiente
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
