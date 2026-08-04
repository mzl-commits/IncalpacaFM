import {
  ArrowSquareOut,
  ArrowsClockwise,
  CheckCircle,
  CornersOut,
  Crosshair,
  LinkBreak,
  MagnifyingGlass,
  MapTrifold,
  Minus,
  Plus,
  Tag,
  WarningCircle,
} from "@phosphor-icons/react";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { TaxonomySectionNav } from "../components/TaxonomySectionNav";
import {
  useFacilityPlan,
  useFacilityPlanImage,
  useFacilityPlans,
  useReconcileFacilityPlan,
} from "../facilityPlanQueries";
import {
  facilityPlanStatusLabels,
  type FacilityPlanMarker,
  type FacilityPlanMarkerStatus,
} from "../facilityPlanTypes";

const statusOptions: Array<{ value: FacilityPlanMarkerStatus; label: string }> = [
  { value: "MATCHED", label: "Vinculados" },
  { value: "TAXONOMY_ONLY", label: "Taxonomía reconocida" },
  { value: "PLACEHOLDER", label: "Pendientes" },
  { value: "UNKNOWN", label: "Sin resolver" },
];

const statusClass: Record<FacilityPlanMarkerStatus, string> = {
  MATCHED: "is-matched",
  TAXONOMY_ONLY: "is-taxonomy-only",
  PLACEHOLDER: "is-placeholder",
  UNKNOWN: "is-unknown",
};

type MarkerStyle = CSSProperties & {
  "--marker-x": string;
  "--marker-y": string;
};

function markerSearchText(marker: FacilityPlanMarker) {
  return [
    marker.rawCode,
    marker.label,
    marker.taxonomy?.prefix,
    marker.taxonomy?.name,
    marker.taxonomy?.category,
    marker.asset?.name,
    marker.asset?.displayCode,
  ]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("es-PE");
}

export function FacilityMapPage() {
  const plansQuery = useFacilityPlans();
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [query, setQuery] = useState("");
  const [taxonomyPrefix, setTaxonomyPrefix] = useState("");
  const [status, setStatus] = useState<FacilityPlanMarkerStatus | "">("");
  const [selectedMarkerId, setSelectedMarkerId] = useState("");
  const [zoom, setZoom] = useState(1);
  const [message, setMessage] = useState("");
  const detailQuery = useFacilityPlan(selectedPlanId);
  const reconcile = useReconcileFacilityPlan();

  useEffect(() => {
    if (!selectedPlanId && plansQuery.data?.length) {
      setSelectedPlanId(plansQuery.data[0].id);
    }
  }, [plansQuery.data, selectedPlanId]);

  useEffect(() => {
    setSelectedMarkerId("");
    setQuery("");
    setTaxonomyPrefix("");
    setStatus("");
    setZoom(1);
    setMessage("");
  }, [selectedPlanId]);

  const plan = detailQuery.data;
  const planImageQuery = useFacilityPlanImage(
    selectedPlanId,
    plan?.updatedAt,
    Boolean(plan?.imageUrl),
  );
  const taxonomyOptions = useMemo(() => {
    const entries = new Map<string, string>();
    for (const marker of plan?.markers ?? []) {
      if (marker.taxonomy) entries.set(marker.taxonomy.prefix, marker.taxonomy.name);
    }
    return [...entries].sort(([left], [right]) =>
      left.localeCompare(right, "es-PE", { numeric: true }),
    );
  }, [plan]);

  const filteredMarkers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("es-PE");
    return (plan?.markers ?? []).filter(
      (marker) =>
        (!normalizedQuery || markerSearchText(marker).includes(normalizedQuery)) &&
        (!taxonomyPrefix || marker.taxonomy?.prefix === taxonomyPrefix) &&
        (!status || marker.status === status),
    );
  }, [plan, query, taxonomyPrefix, status]);

  const selectedMarker =
    plan?.markers.find((marker) => marker.id === selectedMarkerId) ?? null;
  const visibleIds = useMemo(
    () => new Set(filteredMarkers.map((marker) => marker.id)),
    [filteredMarkers],
  );

  useEffect(() => {
    if (selectedMarkerId && !visibleIds.has(selectedMarkerId)) {
      setSelectedMarkerId("");
    }
  }, [selectedMarkerId, visibleIds]);

  async function handleReconcile() {
    if (!plan) return;
    setMessage("");
    try {
      const updated = await reconcile.mutateAsync(plan.id);
      setMessage(
        `${updated.summary.matched} marcadores vinculados; ${updated.summary.taxonomyOnly} continúan pendientes de inventario.`,
      );
    } catch {
      setMessage("No se pudo conciliar el plano. Los vínculos existentes no fueron modificados.");
    }
  }

  const activeFilters = Boolean(query || taxonomyPrefix || status);

  return (
    <section className="facility-map-page">
      <div className="page-heading facility-map-heading">
        <div>
          <p className="breadcrumb">Administración / Taxonomía / Mapa</p>
          <h1>Mapa de bienes</h1>
          <p>Ubica códigos del plano y concílialos con su clasificación e inventario.</p>
        </div>
        <button
          className="button button-secondary"
          type="button"
          disabled={!plan || reconcile.isPending}
          onClick={handleReconcile}
        >
          <ArrowsClockwise className={reconcile.isPending ? "is-spinning" : ""} />
          {reconcile.isPending ? "Conciliando…" : "Conciliar inventario"}
        </button>
      </div>

      <TaxonomySectionNav />

      <div className="facility-map-principle" role="note">
        <MapTrifold size={21} weight="duotone" />
        <p>
          <strong>El plano posiciona; la taxonomía clasifica.</strong>
          <span>
            Un marcador reconocido no crea un bien ni cambia su código FM. Se vincula únicamente
            cuando existe el mismo código en el inventario.
          </span>
        </p>
      </div>

      {message && (
        <div className="taxonomy-page-message" role="status">
          {reconcile.isError ? <WarningCircle size={20} /> : <CheckCircle size={20} weight="fill" />}
          {message}
        </div>
      )}

      {plansQuery.isPending ? (
        <div className="facility-map-loading" aria-busy="true">
          <span />
          <span />
          <span className="sr-only">Cargando planos de planta</span>
        </div>
      ) : plansQuery.isError ? (
        <div className="taxonomy-state-panel" role="alert">
          <WarningCircle size={32} weight="duotone" />
          <strong>No se pudieron cargar los planos</strong>
          <p>Comprueba la conexión e inténtalo nuevamente.</p>
          <button className="button button-secondary" type="button" onClick={() => plansQuery.refetch()}>
            <ArrowsClockwise /> Reintentar
          </button>
        </div>
      ) : !plansQuery.data?.length ? (
        <div className="taxonomy-state-panel">
          <MapTrifold size={34} weight="duotone" />
          <strong>No hay planos importados</strong>
          <p>
            Importa una versión validada del DWG para detectar códigos y relacionarlos con la
            taxonomía sin modificar el archivo original.
          </p>
        </div>
      ) : (
        <>
          <div className="facility-map-planbar">
            <label>
              <span>Plano activo</span>
              <select value={selectedPlanId} onChange={(event) => setSelectedPlanId(event.target.value)}>
                {plansQuery.data.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.name} · {item.version}
                  </option>
                ))}
              </select>
            </label>
            {plan && (
              <div>
                <span className="status status-success">Versión controlada</span>
                <small>
                  {plan.levelName || "Planta general"} · {plan.sourceFilename || plan.code}
                </small>
              </div>
            )}
          </div>

          {detailQuery.isPending ? (
            <div className="facility-map-loading" aria-busy="true">
              <span />
              <span />
              <span className="sr-only">Cargando marcadores del plano</span>
            </div>
          ) : detailQuery.isError || !plan ? (
            <div className="taxonomy-state-panel" role="alert">
              <WarningCircle size={32} weight="duotone" />
              <strong>No se pudo abrir este plano</strong>
              <button className="button button-secondary" type="button" onClick={() => detailQuery.refetch()}>
                Reintentar
              </button>
            </div>
          ) : (
            <>
              <dl className="facility-map-summary" aria-label="Conciliación del plano">
                <div>
                  <dt>Marcadores leídos</dt>
                  <dd>{plan.summary.total}</dd>
                </div>
                <div>
                  <dt>Vinculados</dt>
                  <dd>{plan.summary.matched}</dd>
                </div>
                <div>
                  <dt>Taxonomía reconocida</dt>
                  <dd>{plan.summary.taxonomyOnly}</dd>
                </div>
                <div>
                  <dt>Códigos pendientes</dt>
                  <dd>{plan.summary.placeholders}</dd>
                </div>
              </dl>

              <div className="facility-map-filterbar">
                <label className="facility-map-search">
                  <span className="sr-only">Buscar en el plano</span>
                  <MagnifyingGlass size={18} />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Código FM, prefijo o tipo de bien"
                  />
                </label>
                <label>
                  <span className="sr-only">Filtrar por taxonomía</span>
                  <select value={taxonomyPrefix} onChange={(event) => setTaxonomyPrefix(event.target.value)}>
                    <option value="">Todas las taxonomías</option>
                    {taxonomyOptions.map(([prefix, name]) => (
                      <option value={prefix} key={prefix}>
                        {prefix} · {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="sr-only">Filtrar por conciliación</span>
                  <select
                    value={status}
                    onChange={(event) => setStatus(event.target.value as FacilityPlanMarkerStatus | "")}
                  >
                    <option value="">Cualquier conciliación</option>
                    {statusOptions.map((option) => (
                      <option value={option.value} key={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                {activeFilters && (
                  <button
                    className="facility-map-clear"
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setTaxonomyPrefix("");
                      setStatus("");
                    }}
                  >
                    Restablecer
                  </button>
                )}
                <output aria-live="polite">
                  {filteredMarkers.length} de {plan.markers.length}
                </output>
              </div>

              <div className="facility-map-layout">
                <section className="facility-map-board" aria-label={`Plano ${plan.name}`}>
                  <header>
                    <div>
                      <strong>{plan.name}</strong>
                      <small>{plan.levelName || "Planta general"}</small>
                    </div>
                    <div className="facility-map-zoom" aria-label="Controles de zoom">
                      <button
                        type="button"
                        onClick={() => setZoom((value) => Math.max(0.7, value - 0.15))}
                        disabled={zoom <= 0.7}
                        aria-label="Alejar plano"
                      >
                        <Minus />
                      </button>
                      <output>{Math.round(zoom * 100)}%</output>
                      <button
                        type="button"
                        onClick={() => setZoom((value) => Math.min(2.2, value + 0.15))}
                        disabled={zoom >= 2.2}
                        aria-label="Acercar plano"
                      >
                        <Plus />
                      </button>
                      <button type="button" onClick={() => setZoom(1)} aria-label="Ajustar plano">
                        <CornersOut />
                      </button>
                    </div>
                  </header>

                  <div className="facility-map-scroll" tabIndex={0}>
                    <div
                      className="facility-map-stage"
                      style={{ width: `${zoom * 100}%`, minWidth: `${920 * zoom}px` }}
                    >
                      {planImageQuery.data ? (
                        <img src={planImageQuery.data} alt={`Plano ${plan.name}, ${plan.version}`} />
                      ) : (
                        <div className="facility-map-missing-image">
                          <MapTrifold size={30} />
                          <span>
                            {planImageQuery.isPending
                              ? "Cargando geometría protegida…"
                              : "La geometría protegida no está disponible."}
                          </span>
                        </div>
                      )}
                      {plan.markers.map((marker) => {
                        const visible = visibleIds.has(marker.id);
                        const selected = marker.id === selectedMarkerId;
                        const style: MarkerStyle = {
                          "--marker-x": `${marker.normalizedX * 100}%`,
                          "--marker-y": `${marker.normalizedY * 100}%`,
                        };
                        return (
                          <button
                            className={`facility-map-marker ${statusClass[marker.status]} ${selected ? "is-selected" : ""}`}
                            style={style}
                            type="button"
                            key={marker.id}
                            hidden={!visible}
                            onClick={() => setSelectedMarkerId(marker.id)}
                            aria-pressed={selected}
                            aria-label={`${marker.rawCode}: ${facilityPlanStatusLabels[marker.status]}`}
                          >
                            <span><Crosshair weight="bold" /></span>
                            <small>{marker.rawCode}</small>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <footer className="facility-map-legend" aria-label="Leyenda de conciliación">
                    <span className="is-matched"><i /> Vinculado</span>
                    <span className="is-taxonomy-only"><i /> Taxonomía reconocida</span>
                    <span className="is-placeholder"><i /> Pendiente</span>
                  </footer>
                </section>

                <aside className="facility-map-inspector" aria-live="polite">
                  {selectedMarker ? (
                    <>
                      <header>
                        <span className={`facility-map-marker-state ${statusClass[selectedMarker.status]}`}>
                          {selectedMarker.status === "MATCHED" ? <CheckCircle weight="fill" /> : <LinkBreak />}
                          {facilityPlanStatusLabels[selectedMarker.status]}
                        </span>
                        <code>{selectedMarker.rawCode}</code>
                        <h2>{selectedMarker.asset?.name ?? selectedMarker.taxonomy?.name ?? "Código pendiente"}</h2>
                      </header>
                      <dl>
                        <div>
                          <dt>Taxonomía</dt>
                          <dd>
                            {selectedMarker.taxonomy
                              ? `${selectedMarker.taxonomy.prefix} · ${selectedMarker.taxonomy.name}`
                              : "Sin resolver"}
                          </dd>
                        </div>
                        <div>
                          <dt>Clasificación</dt>
                          <dd>
                            {selectedMarker.taxonomy?.category || "Pendiente de revisión"}
                          </dd>
                        </div>
                        <div>
                          <dt>Capa DWG</dt>
                          <dd>{selectedMarker.layer}</dd>
                        </div>
                        <div>
                          <dt>Coordenada</dt>
                          <dd>{selectedMarker.sourceX.toFixed(2)}, {selectedMarker.sourceY.toFixed(2)}</dd>
                        </div>
                      </dl>
                      {selectedMarker.asset ? (
                        <Link className="facility-map-detail-link" to={`/bienes/${selectedMarker.asset.id}`}>
                          Abrir ficha del bien <ArrowSquareOut />
                        </Link>
                      ) : selectedMarker.taxonomy ? (
                        <Link
                          className="facility-map-detail-link"
                          to={`/administracion/taxonomia/codigos?taxonomy=${encodeURIComponent(selectedMarker.taxonomy.id)}`}
                        >
                          Revisar códigos {selectedMarker.taxonomy.prefix} <ArrowSquareOut />
                        </Link>
                      ) : null}
                    </>
                  ) : (
                    <div className="facility-map-inspector-empty">
                      <Crosshair size={30} weight="duotone" />
                      <strong>Selecciona un marcador</strong>
                      <p>Consulta su código, taxonomía, estado de conciliación y ficha asociada.</p>
                    </div>
                  )}

                  <section className="facility-map-source">
                    <Tag size={18} />
                    <div>
                      <strong>Trazabilidad del plano</strong>
                      <span>{plan.sourceFilename || "Origen controlado"}</span>
                      <code>{plan.sourceSha256 ? `${plan.sourceSha256.slice(0, 12)}…` : plan.version}</code>
                    </div>
                  </section>
                </aside>
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
