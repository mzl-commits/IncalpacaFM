import {
  ArrowClockwise,
  ArrowSquareOut,
  Archive,
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
import { useAuth } from "@/modules/accounts/AuthContext";
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

const PRINT_FORMATS = {
  COMPACT: { label: "Compacta", detail: "38 × 30 mm", widthMm: 38, heightMm: 30, qrMm: 20, columns: 5, gapMm: 1.5, perPage: 30 },
  STANDARD: { label: "Estándar", detail: "60 × 45 mm", widthMm: 60, heightMm: 45, qrMm: 32, columns: 3, gapMm: 4, perPage: 15 },
  LARGE: { label: "Grande", detail: "90 × 60 mm", widthMm: 90, heightMm: 60, qrMm: 44, columns: 2, gapMm: 4, perPage: 8 },
} as const;

type PrintFormat = keyof typeof PRINT_FORMATS;

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
    color: { dark: "#000000", light: "#ffffff" },
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
  const { user } = useAuth();
  const selectAllRef = useRef<HTMLInputElement>(null);

  const [assets, setAssets] = useState<RegisteredAsset[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [printFormat, setPrintFormat] = useState<PrintFormat>("STANDARD");
  const [copies, setCopies] = useState(1);
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

    const format = PRINT_FORMATS[printFormat];
    const normalizedCopies = Math.min(20, Math.max(1, copies));

    setActionMessage("");
    try {
      const labels = await Promise.all(
        items.flatMap((asset) => Array.from({ length: normalizedCopies }, async () => ({
          asset,
          dataUrl: await createQrDataUrl(asset.publicUrl, Math.max(240, format.qrMm * 8)),
        }))),
      );
      
      const style = document.createElement("style");
      style.textContent = `
        @page { size: A4; margin: ${format === PRINT_FORMATS.COMPACT ? "6mm" : "10mm"}; }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          color: #000;
          font-family: "Inter", "Helvetica Neue", Helvetica, Arial, sans-serif;
          background: #fff;
        }
        main {
          display: grid;
          grid-template-columns: repeat(${format.columns}, ${format.widthMm}mm);
          grid-auto-rows: ${format.heightMm}mm;
          justify-content: center;
          align-content: start;
          gap: ${format.gapMm}mm;
        }
        article {
          break-inside: avoid;
          display: grid;
          grid-template-columns: ${format.qrMm}mm minmax(0, 1fr);
          align-items: stretch;
          gap: ${format === PRINT_FORMATS.COMPACT ? 1.5 : Math.max(2, Math.round(format.gapMm / 1.5))}mm;
          height: ${format.heightMm}mm;
          padding: ${format === PRINT_FORMATS.COMPACT ? 1.5 : Math.max(2, Math.round(format.gapMm / 1.5))}mm;
          border: 1px solid #CCC;
          border-radius: 4px;
          overflow: hidden;
          background: #FFF;
        }
        .qr-image { 
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1mm;
        }
        img { 
          display: block; 
          width: 100%; 
          height: 100%; 
          object-fit: contain; 
        }
        .content {
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 1mm 1mm 1mm 0;
        }
        .brand-logo {
          display: flex;
          align-items: center;
          gap: 1.5mm;
          margin-bottom: ${format === PRINT_FORMATS.COMPACT ? 1 : 2}mm;
        }
        .brand-logo svg {
          width: ${format === PRINT_FORMATS.COMPACT ? 8 : format === PRINT_FORMATS.STANDARD ? 12 : 14}px;
          height: ${format === PRINT_FORMATS.COMPACT ? 8 : format === PRINT_FORMATS.STANDARD ? 12 : 14}px;
        }
        .brand-logo span {
          font-size: ${format === PRINT_FORMATS.COMPACT ? 7 : format === PRINT_FORMATS.STANDARD ? 9 : 11}px;
          font-weight: 800;
          letter-spacing: 0.05em;
          color: #000;
          line-height: 1;
        }
        strong { 
          font-family: "Courier New", Courier, monospace;
          margin: 0 0 ${format === PRINT_FORMATS.COMPACT ? 1 : 1.5}mm 0; 
          font-size: ${format === PRINT_FORMATS.COMPACT ? 9 : format === PRINT_FORMATS.STANDARD ? 13 : 15}px; 
          line-height: 1.1; 
          font-weight: 800;
          letter-spacing: -0.02em;
        }
        .name { 
          font-size: ${format === PRINT_FORMATS.COMPACT ? 7 : format === PRINT_FORMATS.STANDARD ? 9 : 11}px; 
          font-weight: 600; 
          line-height: 1.2;
          color: #333;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          margin-bottom: 1mm;
        }
        .technical { 
          color: #666; 
          font-size: ${format === PRINT_FORMATS.COMPACT ? 6.5 : format === PRINT_FORMATS.STANDARD ? 7.5 : 9}px; 
          line-height: 1.2; 
          margin-bottom: auto;
        }
        .instruction { 
          margin-top: auto; 
          color: #888; 
          font-size: ${format === PRINT_FORMATS.COMPACT ? 6 : format === PRINT_FORMATS.STANDARD ? 7 : 8}px; 
          line-height: 1.1; 
          font-style: italic;
        }
        @media print {
          body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
          article { border-color: #000; }
        }
      `;
      const main = document.createElement("main");

      labels.forEach(({ asset, dataUrl }) => {
        const label = document.createElement("article");
        
        const imageWrapper = document.createElement("div");
        imageWrapper.className = "qr-image";
        const image = document.createElement("img");
        image.src = dataUrl;
        image.alt = "";
        imageWrapper.appendChild(image);
        
        const copy = document.createElement("div");
        copy.className = "content";
        
        const logoDiv = document.createElement("div");
        logoDiv.className = "brand-logo";
        logoDiv.innerHTML = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="8" height="8" fill="#000"/><rect x="8" y="8" width="8" height="8" fill="#000"/><rect x="16" y="16" width="8" height="8" fill="#000"/></svg><span>FM INCALPACA</span>`;
        
        const code = document.createElement("strong");
        code.textContent = getAssetDisplayCode(asset);
        
        const name = document.createElement("div");
        name.className = "name";
        name.textContent = asset.draft.name;
        
        const technicalCode = document.createElement("div");
        technicalCode.className = "technical";
        technicalCode.textContent = asset.fmCode ? `ID: ${asset.code}` : "";
        
        const instruction = document.createElement("div");
        instruction.className = "instruction";
        instruction.textContent = "Escanea para más info";

        copy.append(logoDiv, code, name);
        if (asset.fmCode) copy.append(technicalCode);
        copy.append(instruction);
        
        label.append(imageWrapper, copy);
        main.append(label);
      });

      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      document.body.appendChild(iframe);
      
      const printWindow = iframe.contentWindow;
      if (!printWindow) return;
      
      printWindow.document.open();
      printWindow.document.write("<!DOCTYPE html><html><head></head><body></body></html>");
      printWindow.document.close();
      
      printWindow.document.head.append(style);
      printWindow.document.body.append(main);
      
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 300);
      });
      
      printWindow.focus();
      printWindow.print();
      
      window.setTimeout(() => {
        document.body.removeChild(iframe);
      }, 1000);

      setActionMessage(
        `${labels.length} ${labels.length === 1 ? "etiqueta preparada" : "etiquetas preparadas"} en formato ${format.label.toLocaleLowerCase("es")}.`,
      );
    } catch {
      setActionMessage(
        "No se pudieron preparar las etiquetas seleccionadas. Inténtalo nuevamente.",
      );
    }
  }, [copies, printFormat]);

  const unassignedCount = assets.filter((asset) => asset.assignmentStatus === "Sin asignar").length;
  const selectedLabelCount = selectedAssets.length * copies;
  const activePrintFormat = PRINT_FORMATS[printFormat];

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

          <section className="qr-inventory-print-settings" aria-labelledby="qr-print-settings-title">
            <div>
              <h2 id="qr-print-settings-title">Formato de impresión</h2>
              <p>Define la etiqueta antes de preparar la selección. El tamaño se respeta en una hoja A4.</p>
            </div>
            <label>
              <span>Tamaño de etiqueta</span>
              <select value={printFormat} onChange={(event) => setPrintFormat(event.target.value as PrintFormat)}>
                {Object.entries(PRINT_FORMATS).map(([value, option]) => (
                  <option key={value} value={value}>{option.label} · {option.detail}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Copias por código</span>
              <input
                type="number"
                min="1"
                max="20"
                value={copies}
                onChange={(event) => setCopies(Math.min(20, Math.max(1, Number(event.target.value) || 1)))}
              />
            </label>
            <output>
              <strong>{activePrintFormat.perPage} por hoja</strong>
              <span>{selectedAssets.length ? `${selectedLabelCount} etiqueta${selectedLabelCount === 1 ? "" : "s"} a imprimir` : "Selecciona bienes para imprimir"}</span>
            </output>
          </section>

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
                        {user?.role === "ADMINISTRADOR" && (
                          <Link
                            to={`/bienes/${asset.id}`}
                            title="Abre la ficha del bien para iniciar su evaluación de baja con diagnóstico técnico"
                          >
                            <Archive size={17} aria-hidden="true" />
                            Iniciar baja
                          </Link>
                        )}
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
