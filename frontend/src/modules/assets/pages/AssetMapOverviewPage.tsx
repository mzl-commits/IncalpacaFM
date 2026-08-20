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
import { useLocationMapImage, useLocations } from "../locationMapQueries";
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
function spaceNodesToLocations(nodes: SpaceNode[], usersMap: Map<string, any[]>): LocationOption[] {
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
      // area field is not used because SpaceNode has 3 levels, not 4.
      const zone = macro?.name ?? "Sin área macro";
      const building = area?.name ?? macro?.name ?? "Sin área";
      const locationArea = "";
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
        assignedUsers: node.legacyLocation ? usersMap.get(node.legacyLocation.id) || [] : [],
      } satisfies LocationOption;
    });
}

export function AssetMapOverviewPage() {
  const spaceNodesQuery = useQuery({
    queryKey: ["space-nodes", "map"],
    queryFn: () => listSpaceNodes({ active: "true" }),
  });
  const locationsQuery = useLocations();
  const assetsQuery = useQuery({ queryKey: ["assets", "map-overview"], queryFn: listRegisteredAssets });
  const [zone, setZone] = useState("");
  const [building, setBuilding] = useState("");
  const [area, setArea] = useState("");
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [query, setQuery] = useState("");
  const [imageFilter, setImageFilter] = useState<ImageFilter>("ALL");
  const [activeTab, setActiveTab] = useState<"assets" | "users">("assets");
  const navigate = useNavigate();

  const locationsData = locationsQuery.data ?? [];
  const locations = useMemo(() => {
    const usersMap = new Map(locationsData.map(l => [l.id, l.assignedUsers]));
    return spaceNodesToLocations(spaceNodesQuery.data ?? [], usersMap);
  }, [spaceNodesQuery.data, locationsData]);
  const assets = useMemo(() => assetsQuery.data ?? [], [assetsQuery.data]);
  const selectedLocation = locations.find((item) => item.id === selectedLocationId) ?? null;
  const locationImageQuery = useLocationMapImage(selectedLocation?.activeMap?.id);
  const assetsByLocation = useMemo(() => {
    const grouped = new Map<string, typeof assets>();
    const locationToSpace = new Map<string, string>();
    for (const node of spaceNodesQuery.data || []) {
      if (node.legacyLocation?.id) locationToSpace.set(node.legacyLocation.id, node.id);
    }
    for (const asset of assets) {
      const locId = asset.locationDetail?.id;
      if (locId) {
        const spaceId = locationToSpace.get(locId);
        if (spaceId) grouped.set(spaceId, [...(grouped.get(spaceId) ?? []), asset]);
      }
    }
    return grouped;
  }, [assets, spaceNodesQuery.data]);

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
  const selectedAreaNode = (!searchMode && building) ? spaceNodesQuery.data?.find((n: SpaceNode) => n.name === building && (n.nodeType === "AREA" || n.nodeType === "MACRO_AREA")) : null;
  const areaPhoto = selectedAreaNode ? (localStorage.getItem(`space_photo_${selectedAreaNode.id}`) || selectedAreaNode.photoUrl) : null;
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
    (asset: any) => asset.draft.criticality === "Crítica" || asset.draft.condition === "Requiere revisión",
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
              <><CaretRight /><span>{building}</span></>
            )}
            {searchMode && <><CaretRight /><span>Búsqueda global</span></>}
          </nav>

          <div className={`asset-map-grid-layout ${selectedLocation && searchMode ? "has-inspector" : ""}`}>
            <main className="asset-map-grid-panel">
              <header>
                <div>
                  <span className="asset-map-level-icon"><SquaresFour weight="duotone" /></span>
                  <div><h2>{levelTitle}</h2><p>{levelDescription}</p></div>
                </div>
                <span>{environmentLabel(scopedLocations.length)}</span>
              </header>
              {searchMode
                ? <EnvironmentGrid locations={scopedLocations} assetsByLocation={assetsByLocation} selectedId={selectedLocationId} onSelect={setSelectedLocationId} />
                : building
                ? <AreaModulesView locations={scopedLocations} assetsByLocation={assetsByLocation} photo={areaPhoto || null} areaName={building} />
                : zone
                ? <GroupGrid values={unique(scopedLocations.map((item) => item.building))} locations={scopedLocations} assetsByLocation={assetsByLocation} label="edificio" onOpen={openBuilding} />
                : <GroupGrid values={unique(scopedLocations.map((item) => item.zone))} locations={scopedLocations} assetsByLocation={assetsByLocation} label="zona" onOpen={openZone} />}
            </main>

            {selectedLocation && searchMode && (
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

function AreaModulesView({
  locations, assetsByLocation, photo, areaName
}: {
  locations: LocationOption[];
  assetsByLocation: Map<string, any[]>;
  photo: string | null;
  areaName: string;
}) {
  if (!locations.length) return <EmptyGrid />;
  return (
    <div className="asset-map-area-view">
      <div className="asset-map-area-photo" style={{ marginBottom: 24, borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e5e5', backgroundColor: '#f9fafb', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: photo ? 'auto' : 200 }}>
        {photo ? (
          <img src={photo} alt={`Fotografía de ${areaName}`} style={{ width: '100%', maxHeight: 400, objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
            <ImageSquare size={48} weight="duotone" style={{ marginBottom: 12, opacity: 0.5 }} />
            <p style={{ margin: 0, fontSize: 14 }}>Sin imagen referencial de área</p>
          </div>
        )}
      </div>
      <div className="asset-map-modules-list" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {locations.map((location) => {
          const assets = (assetsByLocation.get(location.id) || []) as any[];
          const users = location.assignedUsers || [];
          return (
            <div key={location.id} className="asset-map-module-card" style={{ border: '1px solid #e5e5e5', borderRadius: 8, padding: 16, background: '#fff' }}>
              <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid #f0f0f0', paddingBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#111827' }}>{location.room}</h3>
                  <code style={{ fontSize: 12, color: '#6b7280' }}>{location.locationCode || 'Código pendiente'}</code>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 13, color: '#4b5563' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Package /> {assets.length} {assets.length === 1 ? 'bien' : 'bienes'}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users /> {users.length} {users.length === 1 ? 'usuario' : 'usuarios'}</span>
                </div>
              </header>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                <div style={{ background: '#f9fafb', padding: 16, borderRadius: 8, border: '1px solid #f3f4f6' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.05em' }}>Bienes asignados</h4>
                  {assets.length > 0 ? (
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {assets.map(asset => (
                        <li key={asset.id} style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '8px 12px', borderRadius: 6, border: '1px solid #e5e5e5' }}>
                          <Link to={`/bienes/${asset.id}`} style={{ color: '#0369a1', textDecoration: 'none', fontWeight: 600, marginRight: 8 }}>{asset.fmCode ?? asset.code}</Link>
                          <span style={{ color: '#4b5563', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12 }}>{asset.draft.name}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ margin: 0, fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>No hay bienes asignados.</p>
                  )}
                </div>
                <div style={{ background: '#f9fafb', padding: 16, borderRadius: 8, border: '1px solid #f3f4f6' }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', color: '#6b7280', letterSpacing: '0.05em' }}>Usuarios</h4>
                  {users.length > 0 ? (
                    <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {users.map(user => (
                        <li key={user.id} style={{ fontSize: 13, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fff', padding: '8px 12px', borderRadius: 6, border: '1px solid #e5e5e5' }}>
                          <span style={{ color: '#111827', fontWeight: 600 }}>{user.name}</span>
                          <span style={{ color: '#6b7280', fontSize: 12 }}>{user.area || 'Sin área'}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p style={{ margin: 0, fontSize: 13, color: '#9ca3af', fontStyle: 'italic' }}>No hay usuarios asignados.</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
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
            <span className="asset-map-environment-path">{location.building}</span>
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
