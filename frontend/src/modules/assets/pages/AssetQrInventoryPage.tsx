import {
  ArrowClockwise,
  ArrowSquareOut,
  CalendarBlank,
  CheckCircle,
  MagnifyingGlass,
  MapPin,
  Package,
  Plus,
  Printer,
  QrCode,
  WarningCircle,
} from "@phosphor-icons/react";
import QRCode from "qrcode";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import {
  FilterSelect,
  ListFilterPanel,
  type ActiveFilter,
} from "@/components/filters/ListFilterPanel";
import { buildFilterOptions, useListFilterParams } from "@/components/filters/filterUtils";
import { listRegisteredAssets } from "@/modules/assets/assetEntryRepository";
import { getAssetDisplayCode, type RegisteredAsset } from "@/modules/assets/entryModel";

const assignmentOrder: RegisteredAsset["assignmentStatus"][] = [
  "Sin asignar",
  "Asignado",
  "Entregado",
  "En traslado",
  "Devuelto",
];

const FILTER_KEYS = ["q", "category", "assignment", "condition", "criticality"] as const;

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getCategory(asset: RegisteredAsset) {
  return asset.draft.category?.trim() || "Sin categoría";
}

function getLocation(asset: RegisteredAsset) {
  if (asset.draft.locationPending) return "Ubicación por confirmar";

  const path = [
    asset.draft.zone,
    asset.draft.building,
    asset.draft.locationArea,
    asset.draft.room,
  ].filter(Boolean);

  return path.length ? path.join(" / ") : "Ubicación no registrada";
}

function matchesSearch(asset: RegisteredAsset, search: string) {
  const normalizedSearch = search.trim().toLocaleLowerCase("es");
  if (!normalizedSearch) return true;

  return [
    asset.code,
    asset.fmCode,
    asset.draft.name,
    asset.draft.brand,
    asset.draft.model,
    getCategory(asset),
    getLocation(asset),
  ]
    .join(" ")
    .toLocaleLowerCase("es")
    .includes(normalizedSearch);
}

async function createQrDataUrl(publicUrl: string, width = 320) {
  return QRCode.toDataURL(publicUrl, {
    width,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#002b58", light: "#ffffff" },
  });
}

function AssetQrPreview({ asset }: { asset: RegisteredAsset }) {
  const [dataUrl, setDataUrl] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setDataUrl("");
    setFailed(false);

    createQrDataUrl(asset.publicUrl, 220)
      .then((value) => {
        if (active) setDataUrl(value);
      })
      .catch(() => {
        if (active) setFailed(true);
      });

    return () => {
      active = false;
    };
  }, [asset.publicUrl]);

  if (failed) {
    return (
      <span className="qr-inventory-preview-state is-error" role="status">
        <WarningCircle size={24} aria-hidden="true" />
        <span>No se pudo generar el QR</span>
      </span>
    );
  }

  if (!dataUrl) {
    return (
      <span
        className="qr-inventory-preview-state is-loading"
        aria-label={`Generando código QR de ${getAssetDisplayCode(asset)}`}
      >
        <QrCode size={30} aria-hidden="true" />
      </span>
    );
  }

  return (
    <img
      className="qr-inventory-preview-image"
      src={dataUrl}
      alt={`Código QR del bien ${getAssetDisplayCode(asset)}`}
      loading="lazy"
    />
  );
}

export function AssetQrInventoryPage() {
  const selectAllRef = useRef<HTMLInputElement>(null);

  const [assets, setAssets] = useState<RegisteredAsset[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const { values, setValue, clearFilters } = useListFilterParams(FILTER_KEYS);

  const loadAssets = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const records = await listRegisteredAssets();
      const recordIds = new Set(records.map((asset) => asset.id));
      setAssets(records);
      setSelectedIds((current) => current.filter((id) => recordIds.has(id)));
    } catch {
      setError(
        "No se pudo actualizar el inventario QR. Revisa la conexión e inténtalo nuevamente.",
      );
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  }, []);

  useEffect(() => {
    void loadAssets();
  }, [loadAssets]);

  const categories = useMemo(() => buildFilterOptions(assets.map(getCategory)), [assets]);

  const assignmentStatuses = useMemo(() => {
    const counts = new Map<string, number>();
    assets.forEach((asset) => {
      counts.set(asset.assignmentStatus, (counts.get(asset.assignmentStatus) ?? 0) + 1);
    });
    return assignmentOrder
      .filter((status) => counts.has(status))
      .map((status) => ({ value: status, label: status, count: counts.get(status) }));
  }, [assets]);

  const conditionOptions = useMemo(
    () => buildFilterOptions(assets.map((asset) => asset.draft.condition)),
    [assets],
  );
  const criticalityOptions = useMemo(
    () => buildFilterOptions(assets.map((asset) => asset.draft.criticality)),
    [assets],
  );

  const filteredAssets = useMemo(
    () =>
      assets.filter(
        (asset) =>
          matchesSearch(asset, values.q) &&
          (!values.category || getCategory(asset) === values.category) &&
          (!values.assignment || asset.assignmentStatus === values.assignment) &&
          (!values.condition || asset.draft.condition === values.condition) &&
          (!values.criticality || asset.draft.criticality === values.criticality),
      ),
    [assets, values],
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const visibleIds = useMemo(() => filteredAssets.map((asset) => asset.id), [filteredAssets]);
  const selectedAssets = useMemo(
    () => assets.filter((asset) => selectedSet.has(asset.id)),
    [assets, selectedSet],
  );
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedSet.has(id));
  const activeFilters: ActiveFilter[] = [];
  if (values.q) {
    activeFilters.push({
      key: "q",
      label: "Búsqueda",
      value: values.q,
      onRemove: () => setValue("q", ""),
    });
  }
  if (values.category) {
    activeFilters.push({
      key: "category",
      label: "Categoría",
      value: values.category,
      onRemove: () => setValue("category", ""),
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
  const filtersActive = activeFilters.length > 0;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected && !allVisibleSelected;
    }
  }, [allVisibleSelected, someVisibleSelected]);

  const toggleSelection = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const toggleVisibleSelection = () => {
    setSelectedIds((current) => {
      if (allVisibleSelected) {
        const visibleSet = new Set(visibleIds);
        return current.filter((id) => !visibleSet.has(id));
      }

      return Array.from(new Set([...current, ...visibleIds]));
    });
  };

  const printAssets = useCallback(async (items: RegisteredAsset[]) => {
    if (!items.length) return;

    setActionMessage("");
    const printWindow = window.open("", "sgtb-qr-print", "width=960,height=720");

    if (!printWindow) {
      setActionMessage(
        "El navegador bloqueó la ventana de impresión. Habilita las ventanas emergentes e inténtalo nuevamente.",
      );
      return;
    }

    printWindow.opener = null;
    printWindow.document.title = "Etiquetas QR · SGTB Incalpaca";
    printWindow.document.body.textContent = "Preparando etiquetas QR…";

    try {
      const labels = await Promise.all(
        items.map(async (asset) => ({
          asset,
          dataUrl: await createQrDataUrl(asset.publicUrl),
        })),
      );
      const document = printWindow.document;
      const style = document.createElement("style");
      style.textContent = `
        @page { size: A4; margin: 12mm; }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          color: #10233f;
          font: 14px/1.4 Inter, "Segoe UI", sans-serif;
        }
        main {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8mm;
        }
        article {
          break-inside: avoid;
          display: grid;
          grid-template-columns: 42mm minmax(0, 1fr);
          align-items: center;
          gap: 6mm;
          min-height: 54mm;
          padding: 6mm;
          border: 1px solid #9eabb9;
        }
        img { width: 42mm; height: 42mm; }
        strong, span, small { display: block; }
        strong { margin: 3mm 0 1mm; font-size: 16px; }
        span { font-weight: 700; }
        small { margin-top: 1.5mm; color: #536170; }
        @media print {
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `;
      const main = document.createElement("main");

      labels.forEach(({ asset, dataUrl }) => {
        const label = document.createElement("article");
        const image = document.createElement("img");
        const copy = document.createElement("div");
        const organization = document.createElement("span");
        const code = document.createElement("strong");
        const name = document.createElement("span");
        const technicalCode = document.createElement("small");
        const categoryText = document.createElement("small");
        const instruction = document.createElement("small");

        image.src = dataUrl;
        image.alt = "";
        organization.textContent = "SGTB · INCALPACA";
        code.textContent = getAssetDisplayCode(asset);
        name.textContent = asset.draft.name;
        technicalCode.textContent = asset.fmCode ? `ID técnico: ${asset.code}` : "";
        categoryText.textContent = getCategory(asset);
        instruction.textContent = "Escanea para consultar la ficha pública autorizada.";

        copy.append(organization, code, name);
        if (asset.fmCode) copy.append(technicalCode);
        copy.append(categoryText, instruction);
        label.append(image, copy);
        main.append(label);
      });

      document.head.replaceChildren(style);
      document.body.replaceChildren(main);
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 120);
      });
      printWindow.focus();
      printWindow.print();
      setActionMessage(
        `${items.length} ${items.length === 1 ? "etiqueta preparada" : "etiquetas preparadas"} para impresión.`,
      );
    } catch {
      printWindow.close();
      setActionMessage(
        "No se pudieron preparar las etiquetas seleccionadas. Inténtalo nuevamente.",
      );
    }
  }, []);

  const unassignedCount = assets.filter((asset) => asset.assignmentStatus === "Sin asignar").length;

  return (
    <section className="qr-inventory-page" aria-labelledby="qr-inventory-title" aria-busy={loading}>
      <header className="qr-inventory-heading">
        <div>
          <nav className="qr-inventory-breadcrumb" aria-label="Ruta de navegación">
            <ol>
              <li>
                <Link to="/bienes">Bienes</Link>
              </li>
              <li aria-current="page">Códigos QR</li>
            </ol>
          </nav>
          <h1 id="qr-inventory-title">Inventario de códigos QR</h1>
          <p>Consulta, imprime y abre la ficha pública autorizada de cada bien registrado.</p>
        </div>

        <div className="qr-inventory-heading-actions">
          <button
            className="qr-inventory-button is-secondary"
            type="button"
            onClick={() => void loadAssets()}
            disabled={loading}
            aria-busy={loading}
          >
            <ArrowClockwise
              className={`qr-inventory-refresh-icon ${loading ? "is-loading" : ""}`}
              size={18}
              aria-hidden="true"
            />
            {loading ? "Actualizando…" : "Actualizar"}
          </button>
          <Link className="qr-inventory-button is-primary" to="/bienes/entradas/nueva">
            <Plus size={18} weight="bold" aria-hidden="true" />
            Registrar bien
          </Link>
        </div>
      </header>

      {error && (
        <div className="qr-inventory-message is-error" role="alert">
          <WarningCircle size={20} aria-hidden="true" />
          <span>{error}</span>
          <button type="button" onClick={() => void loadAssets()}>
            Reintentar
          </button>
        </div>
      )}

      <p className="qr-inventory-action-message" role="status" aria-live="polite">
        {actionMessage}
      </p>

      {loading && !hasLoaded ? (
        <div className="qr-inventory-loading" role="status">
          <span className="sr-only">Cargando inventario QR</span>
          {[0, 1, 2].map((item) => (
            <div key={item} aria-hidden="true" />
          ))}
        </div>
      ) : (
        <>
          <dl className="qr-inventory-summary">
            <div>
              <dt>Bienes identificados</dt>
              <dd>{assets.length}</dd>
            </div>
            <div>
              <dt>Sin responsable</dt>
              <dd>{unassignedCount}</dd>
            </div>
            <div>
              <dt>Seleccionados</dt>
              <dd>{selectedIds.length}</dd>
            </div>
          </dl>

          <ListFilterPanel
            title="Preparar etiquetas QR"
            description="Ubica bienes por clasificación, asignación, condición y criticidad."
            searchLabel="Buscar bienes"
            searchPlaceholder="Código, nombre, marca, modelo o ubicación"
            searchValue={values.q}
            onSearchChange={(value) => setValue("q", value)}
            resultCount={filteredAssets.length}
            totalCount={assets.length}
            activeFilters={activeFilters}
            onClear={clearFilters}
            quickFilters={[
              {
                key: "unassigned",
                label: "Sin responsable",
                count: unassignedCount,
                active: values.assignment === "Sin asignar",
                onSelect: () =>
                  setValue("assignment", values.assignment === "Sin asignar" ? "" : "Sin asignar"),
              },
              {
                key: "review",
                label: "Requieren revisión",
                count: assets.filter((asset) => asset.draft.condition === "Requiere revisión")
                  .length,
                active: values.condition === "Requiere revisión",
                onSelect: () =>
                  setValue(
                    "condition",
                    values.condition === "Requiere revisión" ? "" : "Requiere revisión",
                  ),
              },
              {
                key: "critical",
                label: "Criticidad alta",
                count: assets.filter(
                  (asset) =>
                    asset.draft.criticality === "Alta" || asset.draft.criticality === "Crítica",
                ).length,
                active: values.criticality === "Alta" || values.criticality === "Crítica",
                onSelect: () =>
                  setValue(
                    "criticality",
                    values.criticality === "Alta" || values.criticality === "Crítica" ? "" : "Alta",
                  ),
              },
            ]}
          >
            <FilterSelect
              label="Categoría"
              value={values.category}
              onChange={(value) => setValue("category", value)}
              options={categories}
              allLabel="Todas las categorías"
            />
            <FilterSelect
              label="Estado de asignación"
              value={values.assignment}
              onChange={(value) => setValue("assignment", value)}
              options={assignmentStatuses}
              allLabel="Todos los estados"
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
          </ListFilterPanel>

          <div className="qr-inventory-selection-bar">
            <label className="qr-inventory-select-all">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={allVisibleSelected}
                onChange={toggleVisibleSelection}
                disabled={!filteredAssets.length}
              />
              <span>Seleccionar resultados visibles</span>
            </label>

            <p aria-live="polite">
              {filteredAssets.length} de {assets.length} {assets.length === 1 ? "bien" : "bienes"}
            </p>

            <button
              className="qr-inventory-button is-secondary"
              type="button"
              disabled={!selectedAssets.length}
              onClick={() => void printAssets(selectedAssets)}
            >
              <Printer size={18} aria-hidden="true" />
              Imprimir selección
              {selectedAssets.length > 0 && ` (${selectedAssets.length})`}
            </button>
          </div>

          {filteredAssets.length ? (
            <ul className="qr-inventory-grid" aria-label="Bienes con código QR">
              {filteredAssets.map((asset) => {
                const selected = selectedSet.has(asset.id);

                return (
                  <li key={asset.id}>
                    <article className={`qr-inventory-card ${selected ? "is-selected" : ""}`}>
                      <div className="qr-inventory-card-selection">
                        <label>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleSelection(asset.id)}
                          />
                          <span>Seleccionar {getAssetDisplayCode(asset)}</span>
                        </label>
                        <span
                          className={`qr-inventory-status is-${asset.assignmentStatus
                            .toLocaleLowerCase("es")
                            .replaceAll(" ", "-")}`}
                        >
                          {asset.assignmentStatus}
                        </span>
                      </div>

                      <div className="qr-inventory-preview">
                        <AssetQrPreview asset={asset} />
                      </div>

                      <div className="qr-inventory-card-content">
                        <Link className="qr-inventory-asset-link" to={`/bienes/${asset.id}`}>
                          <span>{getAssetDisplayCode(asset)}</span>
                          <strong>{asset.draft.name}</strong>
                          {asset.fmCode && <small>ID técnico: {asset.code}</small>}
                        </Link>

                        <dl className="qr-inventory-card-facts">
                          <div>
                            <dt>
                              <Package size={16} aria-hidden="true" />
                              Categoría
                            </dt>
                            <dd>{getCategory(asset)}</dd>
                          </div>
                          <div>
                            <dt>
                              <MapPin size={16} aria-hidden="true" />
                              Ubicación
                            </dt>
                            <dd>{getLocation(asset)}</dd>
                          </div>
                          <div>
                            <dt>
                              <CalendarBlank size={16} aria-hidden="true" />
                              Registro
                            </dt>
                            <dd>{formatDate(asset.createdAt)}</dd>
                          </div>
                        </dl>
                      </div>

                      <footer className="qr-inventory-card-actions">
                        <button type="button" onClick={() => void printAssets([asset])}>
                          <Printer size={17} aria-hidden="true" />
                          Imprimir
                        </button>
                        <a
                          href={asset.publicUrl}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Abrir ficha pública de ${getAssetDisplayCode(asset)} en una pestaña nueva`}
                        >
                          <ArrowSquareOut size={17} aria-hidden="true" />
                          Ficha pública
                        </a>
                      </footer>
                    </article>
                  </li>
                );
              })}
            </ul>
          ) : (
            <section className="qr-inventory-empty" aria-labelledby="qr-empty-title">
              {filtersActive ? (
                <>
                  <MagnifyingGlass size={34} aria-hidden="true" />
                  <h2 id="qr-empty-title">No encontramos bienes</h2>
                  <p>Ajusta la búsqueda o elimina los filtros para revisar todo el inventario.</p>
                  <button
                    className="qr-inventory-button is-secondary"
                    type="button"
                    onClick={clearFilters}
                  >
                    Limpiar filtros
                  </button>
                </>
              ) : (
                <>
                  <QrCode size={34} aria-hidden="true" />
                  <h2 id="qr-empty-title">Aún no hay bienes registrados</h2>
                  <p>Registra el primer bien para generar su identificación y ficha pública.</p>
                  <Link className="qr-inventory-button is-primary" to="/bienes/entradas/nueva">
                    <CheckCircle size={18} aria-hidden="true" />
                    Registrar primer bien
                  </Link>
                </>
              )}
            </section>
          )}
        </>
      )}
    </section>
  );
}
