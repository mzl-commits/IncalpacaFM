import { CaretLeft, CaretRight, Funnel, MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { entryTypeLabels, type RegisteredAsset } from "@/modules/assets/entryModel";
import { listRegisteredAssets } from "@/modules/assets/assetEntryRepository";

const statusClass = { Registrado: "status-success" } as const;

export function AssetEntryListPage() {
  const [registered, setRegistered] = useState<RegisteredAsset[]>([]);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    listRegisteredAssets().then(setRegistered).catch(() => setLoadError("No se pudo conectar con la base de datos."));
  }, []);

  const entries = useMemo(() => registered.map((item) => ({
    id: item.id, code: item.code, description: item.draft.name,
    entryType: entryTypeLabels[item.draft.entryType],
    date: new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(item.createdAt)),
    registeredBy: item.createdBy, status: "Registrado" as const,
  })).filter((entry) => {
    const textMatch = `${entry.code} ${entry.description} ${entry.registeredBy}`.toLowerCase().includes(search.toLowerCase());
    return textMatch && (!typeFilter || entry.entryType === typeFilter);
  }), [registered, search, typeFilter]);

  const assigned = registered.filter((item) => item.assignmentStatus === "Asignado").length;
  return <section className="entries-page">
    <div className="page-heading"><div><p className="breadcrumb">Inicio / Entradas</p><h1>Entrada de bienes</h1><p>Registra y valida los bienes que ingresan a la organización.</p></div><Link className="button button-primary desktop-new-entry" to="/bienes/entradas/nueva"><Plus size={18} weight="bold" />Registrar nuevo bien</Link></div>
    <div className="metrics-grid">
      <article className="metric-pending"><span>Pendientes de asignación</span><strong>{registered.length - assigned}</strong><small>Datos reales de la API</small></article>
      <article><span>Registrados</span><strong>{registered.length}</strong><small>En la base de datos</small></article>
      <article className="metric-error"><span>Observados</span><strong>0</strong><small>Sin observaciones vigentes</small></article>
      <article className="metric-success"><span>Asignados</span><strong>{assigned}</strong><small>Con responsable vigente</small></article>
    </div>
    <div className="data-panel">
      <div className="table-toolbar"><label className="search-field"><MagnifyingGlass size={18} /><input aria-label="Buscar entradas" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por código, descripción o responsable" /></label><button className="button button-secondary filter-toggle" type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((value) => !value)}><Funnel size={18} />Filtros</button></div>
      <div className={`filter-row ${filtersOpen ? "is-open" : ""}`}><select aria-label="Filtrar por tipo de ingreso" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="">Tipo de ingreso</option><option>Compra</option><option>Creación propia</option><option>Regalo o donación</option><option>Alquiler</option></select>{typeFilter && <button type="button" onClick={() => setTypeFilter("")}>Limpiar filtros</button>}</div>
      <div className="table-scroll"><table><thead><tr><th>Código</th><th>Descripción</th><th>Tipo de ingreso</th><th>Fecha</th><th>Registrado por</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>
        {entries.map((entry) => <tr key={entry.id}><td><strong>{entry.code}</strong></td><td>{entry.description}</td><td>{entry.entryType}</td><td>{entry.date}</td><td>{entry.registeredBy}</td><td><span className={`status ${statusClass[entry.status]}`}>{entry.status}</span></td><td><button className="table-action" type="button">Ver detalle <CaretRight /></button></td></tr>)}
        {!entries.length && <tr><td colSpan={7} className="empty-row">{loadError || "No encontramos entradas con esos criterios."}</td></tr>}
      </tbody></table></div>
      <div className="mobile-entry-list">{entries.map((entry) => <article className="mobile-entry-card" key={entry.id}><header><strong>{entry.code}</strong><span className="status status-success">{entry.status}</span></header><h2>{entry.description}</h2><p>{entry.entryType} · {entry.date}</p><small>Registrado por: {entry.registeredBy}</small><button type="button" aria-label={`Ver ${entry.code}`}><CaretRight /></button></article>)}{!entries.length && <p className="empty-row">{loadError || "No hay registros."}</p>}</div>
      <footer className="table-footer"><span>Mostrando {entries.length} de {registered.length} registros</span><div><button type="button" aria-label="Página anterior"><CaretLeft /></button><button className="is-current" type="button">1</button><button type="button" aria-label="Página siguiente"><CaretRight /></button></div></footer>
    </div>
    <Link className="mobile-register-fab" to="/bienes/entradas/nueva"><Plus weight="bold" />Registrar</Link>
  </section>;
}
