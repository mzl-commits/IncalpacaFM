import {
  ArrowLeft,
  ArrowSquareOut,
  Buildings,
  CaretRight,
  CheckCircle,
  ImageSquare,
  MagnifyingGlass,
  MapPin,
  Package,
  SquaresFour,
  Users,
  WarningCircle,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listRegisteredAssets } from "../assetEntryRepository";
import { useLocationMapImage } from "../locationMapQueries";
import type { LocationOption } from "../locationMapTypes";
import { listSpaceNodes } from "../../spaces/spacesRepository";
import type { SpaceNode } from "../../spaces/types";

type ImageFilter = "ALL" | "WITH_MAP" | "WITHOUT_MAP";
type AssetPinStyle = CSSProperties & { "--asset-x": string; "--asset-y": string };

function unique(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, "es"));
}

function fullLocation(location: LocationOption) {
  return `${location.zone} / ${location.building} / ${location.area} / ${location.room}`;
}

function environmentLabel(count: number) {
  return `${count} ${count === 1 ? "espacio" : "espacios"}`;
}

function capacityLabel(location: LocationOption) {
  const users = location.assignedUsers.length;
  return location.headcount == null ? `${users} usuarios` : `${users}/${location.headcount} usuarios`;
}

function areaLabel(squareMeters: number | null) {
  return squareMeters == null
    ? "m² pendiente"
    : `${new Intl.NumberFormat("es-PE", { maximumFractionDigits: 2 }).format(squareMeters)} m²`;
}

/** Converts the SpaceNode hierarchy (MACRO_AREA → AREA → MODULE) into
 *  the LocationOption shape used by the map UI.
 *  Only leaf nodes at each level are shown to avoid duplicates:
 *  - MACRO_AREA shown only if it has no AREA children
 *  - AREA shown only if it has no MODULE children
 *  - MODULE always shown */
function spaceNodesToLocations(nodes: SpaceNode[]): LocationOption[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // Build a set of parent IDs that have children of a "deeper" type
  const hasAreaChildren = new Set<string>();
  const hasModuleChildren = new Set<string>();
  for (const node of nodes) {
    if (!node.parentId) continue;
    if (node.nodeType === "AREA") hasAreaChildren.add(node.parentId);
    if (node.nodeType === "MODULE") hasModuleChildren.add(node.parentId);
  }

  function ancestorOfType(node: SpaceNode, type: string): SpaceNode | null {
    let current: SpaceNode | null = node;
    while (current) {
      if (current.nodeType === type) return current;
      current = current.parentId ? (byId.get(current.parentId) ?? null) : null;
    }
    return null;
  }

  return nodes
    .filter((node) => {
      // Skip MACRO_AREA if it already has AREA children (they will represent it)
      if (node.nodeType === "MACRO_AREA" && hasAreaChildren.has(node.id)) return false;
      // Skip AREA if it already has MODULE children (they will represent it)
      if (node.nodeType === "AREA" && hasModuleChildren.has(node.id)) return false;
      return true;
    })
    .map((node) => {
      const macro = ancestorOfType(node, "MACRO_AREA");
      const area = ancestorOfType(node, "AREA");

      // zone = Área Macro name
      // building = Área name (or macro if no area)
      // area field = node name when it IS the area, or area name when node is module
      const zone = macro?.name ?? "Sin área macro";
      const building = area?.name ?? macro?.name ?? "Sin área";
      const locationArea = node.nodeType === "MODULE" ? (area?.name ?? building) : node.name;
      const room = node.name;
      const locationCode = node.pathCode ?? node.codeSegment;

      return {
        id: node.id,
        locationCode,
        sourceCompany: "",
        sourceVersion: "",
        requiresReview: false,
        reviewNotes: "",
        zone,
        building,
        area: locationArea,
        room,
        specificLocation: "",
        headcount: node.headcount,
        squareMeters: node.squareMeters,
        buildingSquareMeters: null,
        commonSpace: node.commonSpace,
        active: node.active,
        displayName: `${locationCode} · ${room}`,
        activeMap: null,
        assignedUsers: [],
      } satisfies LocationOption;
    });
}

export function AssetMapOverviewPage() {
  const spaceNodesQuery = useQuery({
    queryKey: ["space-nodes", "map"],
    queryFn: () => listSpaceNodes({ active: "true" }),
  });
  const assetsQuery = useQuery({ queryKey: ["assets", "map-overview"], queryFn: listRegisteredAssets });
  const [zone, setZone] = useState("");
  const [building, setBuilding] = useState("");
  const [area, setArea] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [query, setQuery] = useState("");
  const [imageFilter, setImageFilter] = useState<ImageFilter>("ALL");
  const [activeTab, setActiveTab] = useState<"assets" | "users">("assets");
  const navigate = useNavigate();

  const locations = useMemo(
    () => spaceNodesToLocations(spaceNodesQuery.data ?? []),
    [spaceNodesQuery.data],
  );
  const assets = useMemo(() => assetsQuery.data ?? [], [assetsQuery.data]);
  const selectedLocation = locations.find((item) => item.id === selectedLocationId) ?? null;
  const locationImageQuery = useLocationMapImage(selectedLocation?.activeMap?.id);
  const assetsByLocation = useMemo(() => {
    const grouped = new Map<string, typeof assets>();
    for (const asset of assets) {
      const id = asset.locationDetail?.id;
      if (id) grouped.set(id, [...(grouped.get(id) ?? []), asset]);
    }
    return grouped;
  }, [assets]);

  const normalizedQuery = query.trim().toLocaleLowerCase("es-PE");
  const filteredLocations = useMemo(
    () =>
      locations.filter((item) => {
        const matchesImage =
          imageFilter === "ALL" || (imageFilter === "WITH_MAP" ? item.activeMap : !item.activeMap);
        const haystack =
          `${item.locationCode} ${item.zone} ${item.building} ${item.area} ${item.room}`.toLocaleLowerCase("es-PE");
        return matchesImage && (!normalizedQuery || haystack.includes(normalizedQuery));
      }),
    [imageFilter, locations, normalizedQuery],
  );

  const searchMode = normalizedQuery.length > 0;
  const scopedLocations = searchMode
    ? filteredLocations
    : filteredLocations.filter(
        (item) =>
          (!zone || item.zone === zone) &&
          (!building || item.building === building) &&
          (!area || item.area === area),
      );
  const mappedCount = locations.filter((item) => item.activeMap).length;
  const selectedAssets = selectedLocation ? assetsByLocation.get(selectedLocation.id) ?? [] : [];
  const selectedAlerts = selectedAssets.filter(
    (asset) => asset.draft.criticality === "Crítica" || asset.draft.condition === "Requiere revisión",
  ).length;
  const ready = !spaceNodesQuery.isPending && !assetsQuery.isPending;
  const hasError = spaceNodesQuery.isError || assetsQuery.isError;

  function resetToRoot() {
    setZone(""); setBuilding(""); setArea(""); setSelectedLocationId("");
  }
  function openZone(value: string) {
    setZone(value); setBuilding(""); setArea(""); setSelectedLocationId(""); setQuery("");
  }
  function openBuilding(value: string) {
    setBuilding(value); setArea(""); setSelectedLocationId("");
  }
  function openArea(value: string) {
    setArea(value); setSelectedLocationId("");
  }

  const levelTitle = searchMode
    ? `Resultados para "${query.trim()}"`
    : area ? area : building ? building : zone ? zone : "Toda la planta";
  const levelDescription = searchMode
    ? `${environmentLabel(scopedLocations.length)} ${scopedLocations.length === 1 ? "coincide" : "coinciden"} con la búsqueda.`
    : area ? "Selecciona un espacio para consultar sus bienes."
    : building ? "La cuadrícula separa los espacios por área funcional."
    : zone ? "Selecciona un área para ver sus espacios."
    : "Explora la estructura oficial de ubicaciones sin depender de un plano físico.";

  return (
    <section className="asset-map-overview-page">
      <div className="page-heading asset-map-overview-heading">
        <div>
          <p className="breadcrumb">Bienes / Explorador de espacios</p>
          <h1>Mapa administrativo</h1>
          <p>Ubicaciones organizadas por la jerarquía de espacios. Las imágenes se usan únicamente como referencia dentro de cada ambiente.</p>
        </div>
        <Link className="button button-secondary" to="/administracion/mapas-ambientes">
          Gestionar imágenes <ArrowSquareOut />
        </Link>
      </div>

      {!ready ? (
        <div className="asset-map-overview-loading" aria-busy="true">
          <span className="sr-only">Cargando espacios</span>
        </div>
      ) : hasError ? (
        <div className="taxonomy-state-panel" role="alert">
          <WarningCircle size={32} />
          <strong>No se pudo cargar el catálogo de espacios</strong>
          <p>Verifica la conexión e inténtalo nuevamente.</p>
        </div>
      ) : (
        <>
          <div className="asset-map-toolbar">
            <label className="asset-map-search">
              <MagnifyingGlass />
              <span className="sr-only">Buscar espacio</span>
              <input
                value={query}
                onChange={(event) => { setQuery(event.target.value); setSelectedLocationId(""); }}
                placeholder="Buscar código, zona, área o módulo"
              />
            </label>
            <label>
              <span>Referencia visual</span>
              <select
                value={imageFilter}
                onChange={(event) => { setImageFilter(event.target.value as ImageFilter); setSelectedLocationId(""); }}
              >
                <option value="ALL">Todos los espacios</option>
                <option value="WITH_MAP">Con imagen</option>
                <option value="WITHOUT_MAP">Pendientes de imagen</option>
              </select>
            </label>
            <div className="asset-map-toolbar-summary">
              <span><Package /> {assets.length} bienes</span>
              <span><Buildings /> {locations.length} espacios</span>
              <span><ImageSquare /> {mappedCount} con imagen</span>
            </div>
          </div>

          <nav className="asset-map-drill-path" aria-label="Ruta de ubicación">
            <button type="button" onClick={resetToRoot} aria-current={!zone && !searchMode ? "page" : undefined}>
              Toda la planta
            </button>
            {!searchMode && zone && (
              <><CaretRight /><button type="button" onClick={() => openZone(zone)} aria-current={!building ? "page" : undefined}>{zone}</button></>
            )}
            {!searchMode && building && (
              <><CaretRight /><button type="button" onClick={() => openBuilding(building)} aria-current={!area ? "page" : undefined}>{building}</button></>
            )}
            {!searchMode && area && <><CaretRight /><span>{area}</span></>}
            {searchMode && <><CaretRight /><span>Búsqueda global</span></>}
          </nav>

          <div className={`asset-map-grid-layout ${selectedLocation ? "has-inspector" : ""}`}>
            <main className="asset-map-grid-panel">
              <header>
                <div>
                  <span className="asset-map-level-icon"><SquaresFour weight="duotone" /></span>
                  <div><h2>{levelTitle}</h2><p>{levelDescription}</p></div>
                </div>
                <span>{environmentLabel(scopedLocations.length)}</span>
              </header>
              {searchMode || area
                ? <EnvironmentGrid locations={scopedLocations} assetsByLocation={assetsByLocation} selectedId={selectedLocationId} onSelect={setSelectedLocationId} />
                : building
                ? <GroupGrid values={unique(scopedLocations.map((item) => item.area))} locations={scopedLocations} assetsByLocation={assetsByLocation} label="área" onOpen={openArea} />
                : zone
                ? <GroupGrid values={unique(scopedLocations.map((item) => item.building))} locations={scopedLocations} assetsByLocation={assetsByLocation} label="edificio" onOpen={openBuilding} />
                : <GroupGrid values={unique(scopedLocations.map((item) => item.zone))} locations={scopedLocations} assetsByLocation={assetsByLocation} label="zona" onOpen={openZone} />}
            </main>

            {selectedLocation && (
              <aside className="asset-map-overview-inspector" aria-live="polite">
                <header>
                  <button className="asset-map-inspector-back" type="button" onClick={() => setSelectedLocationId("")}>
                    <ArrowLeft /> Cerrar detalle
                  </button>
                  <span>{selectedLocation.zone} / {selectedLocation.building} / {selectedLocation.area}</span>
                  <h2>{selectedLocation.locationCode ? `${selectedLocation.locationCode} · ` : ""}{selectedLocation.room}</h2>
                </header>
                <dl className="asset-map-location-summary">
                  <div><dt>Bienes</dt><dd>{selectedAssets.length}</dd></div>
                  <div><dt>Usuarios</dt><dd>{capacityLabel(selectedLocation)}</dd></div>
                  <div><dt>Superficie</dt><dd>{areaLabel(selectedLocation.squareMeters)}</dd></div>
                  <div><dt>Alertas</dt><dd>{selectedAlerts}</dd></div>
                </dl>
                {selectedLocation.activeMap ? (
                  <section className="asset-map-room-preview">
                    <header>
                      <strong>Imagen referencial</strong>
                      <span>Versión {selectedLocation.activeMap.version}</span>
                    </header>
                    {locationImageQuery.data ? (
                      <div>
                        <img src={locationImageQuery.data} alt={`Referencia visual de ${selectedLocation.room}`} />
                        {selectedAssets.map((asset) => {
                          const marker = asset.locationDetail?.marker;
                          if (!marker || marker.mapId !== selectedLocation.activeMap?.id) return null;
                          const style: AssetPinStyle = { "--asset-x": `${marker.x * 100}%`, "--asset-y": `${marker.y * 100}%` };
                          return (
                            <Link to={`/bienes/${asset.id}`} className="asset-map-room-pin" style={style} key={asset.id} aria-label={`Abrir ${asset.draft.name}`}>
                              <MapPin weight="fill" />
                            </Link>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="asset-map-image-loading">Cargando imagen protegida…</div>
                    )}
                  </section>
                ) : (
                  <section className="asset-map-reference-empty">
                    <ImageSquare weight="duotone" />
                    <div>
                      <strong>Sin imagen referencial</strong>
                      <p>La ubicación taxonómica sigue disponible. Puedes cargar una imagen desde Administración.</p>
                    </div>
                    <Link to="/administracion/mapas-ambientes">Agregar imagen</Link>
                  </section>
                )}
                <section className="asset-map-location-tabs">
                  <div className="tab-list">
                    <button type="button" role="tab" aria-selected={activeTab === "assets"} className={activeTab === "assets" ? "is-active" : ""} onClick={() => setActiveTab("assets")}>
                      Bienes ({selectedAssets.length})
                    </button>
                    <button type="button" role="tab" aria-selected={activeTab === "users"} className={activeTab === "users" ? "is-active" : ""} onClick={() => setActiveTab("users")}>
                      Usuarios ({selectedLocation.assignedUsers?.length || 0})
                    </button>
                  </div>
                  {activeTab === "assets" ? (
                    <div className="tab-panel">
                      {selectedAssets.length ? (
                        <div className="asset-map-location-assets">
                          {selectedAssets.map((asset) => (
                            <Link to={`/bienes/${asset.id}`} key={asset.id}>
                              <span><strong>{asset.fmCode ?? asset.code}</strong><small>{asset.draft.name}</small></span>
                              <i className={`status ${asset.assignmentStatus === "Sin asignar" ? "status-warning" : "status-success"}`}>{asset.assignmentStatus}</i>
                              <ArrowSquareOut />
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <div className="asset-map-no-assets"><Package /><span>No hay bienes registrados en este espacio.</span></div>
                      )}
                    </div>
                  ) : (
                    <div className="tab-panel">
                      {selectedLocation.assignedUsers?.length ? (
                        <div className="asset-map-location-assets">
                          {selectedLocation.assignedUsers.map((user) => (
                            <button type="button" className="asset-map-user-link" onClick={() => navigate(`/usuarios/${user.id}`)} key={user.id}>
                              <span><strong>{user.name}</strong><small>{user.area || "Sin área específica"}</small></span>
                              <ArrowSquareOut />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="asset-map-no-assets"><Users /><span>No hay usuarios asignados a bienes en este espacio.</span></div>
                      )}
                    </div>
                  )}
                </section>
                <p className="asset-map-location-path"><CheckCircle weight="fill" />{fullLocation(selectedLocation)}</p>
              </aside>
            )}
          </div>
        </>
      )}
    </section>
  );
}

function GroupGrid({
  values, locations, assetsByLocation, label, onOpen,
}: {
  values: string[];
  locations: LocationOption[];
  assetsByLocation: Map<string, unknown[]>;
  label: string;
  onOpen: (value: string) => void;
}) {
  if (!values.length) return <EmptyGrid />;
  return (
    <div className="asset-map-taxonomy-grid">
      {values.map((value) => {
        const children = locations.filter((item) =>
          label === "zona" ? item.zone === value : label === "edificio" ? item.building === value : item.area === value,
        );
        const assets = children.reduce((total, item) => total + (assetsByLocation.get(item.id)?.length ?? 0), 0);
        const mapped = children.filter((item) => item.activeMap).length;
        return (
          <button type="button" className="asset-map-group-tile" key={value} onClick={() => onOpen(value)}>
            <span className="asset-map-tile-icon"><Buildings weight="duotone" /></span>
            <span className="asset-map-tile-copy">
              <strong>{value}</strong>
              <small>{environmentLabel(children.length)} · {assets} bienes</small>
            </span>
            <span className="asset-map-tile-coverage"><ImageSquare /> {mapped}/{children.length}</span>
            <CaretRight />
          </button>
        );
      })}
    </div>
  );
}

function EnvironmentGrid({
  locations, assetsByLocation, selectedId, onSelect,
}: {
  locations: LocationOption[];
  assetsByLocation: Map<string, unknown[]>;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  if (!locations.length) return <EmptyGrid />;
  return (
    <div className="asset-map-environment-grid">
      {locations.map((location) => {
        const count = assetsByLocation.get(location.id)?.length ?? 0;
        return (
          <button
            type="button"
            className={`asset-map-environment-tile ${selectedId === location.id ? "is-selected" : ""}`}
            key={location.id}
            onClick={() => onSelect(location.id)}
            aria-pressed={selectedId === location.id}
          >
            <span className="asset-map-environment-heading">
              <i className={location.activeMap ? "has-image" : ""}>
                <ImageSquare weight={location.activeMap ? "fill" : "regular"} />
              </i>
              <span>
                <strong>{location.room}</strong>
                <small>{location.locationCode || "Código pendiente"}</small>
              </span>
            </span>
            <span className="asset-map-environment-path">{location.building} · {location.area}</span>
            <span className="asset-map-environment-meta">
              <b><Package /> {count} {count === 1 ? "bien" : "bienes"}</b>
              <em>{areaLabel(location.squareMeters)}</em>
            </span>
            <span className="asset-map-capacity"><Users /> {capacityLabel(location)}</span>
            {location.requiresReview && <span className="asset-map-review-flag"><WarningCircle /> Requiere revisión</span>}
          </button>
        );
      })}
    </div>
  );
}

function EmptyGrid() {
  return (
    <div className="asset-map-overview-empty">
      <MagnifyingGlass />
      <strong>No encontramos espacios</strong>
      <p>Ajusta la búsqueda o cambia el filtro de imagen referencial.</p>
    </div>
  );
}
