import { CaretLeft, CaretRight, Funnel, MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { mockEntries } from "@/modules/assets/data/mockEntries";
import { entryTypeLabels, type RegisteredAsset } from "@/modules/assets/entryModel";
import { listRegisteredAssets } from "@/modules/assets/assetEntryRepository";

const statusClass = { Borrador: "status-neutral", Pendiente: "status-warning", Observado: "status-error", Registrado: "status-success" };

export function AssetEntryListPage() {
  const [registered, setRegistered] = useState<RegisteredAsset[]>(() => listRegisteredAssets());
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    const refresh = () => setRegistered(listRegisteredAssets());
    window.addEventListener("sgtb:asset-registered", refresh);
    window.addEventListener("storage", refresh);
    return () => { window.removeEventListener("sgtb:asset-registered", refresh); window.removeEventListener("storage", refresh); };
  }, []);

  const entries = useMemo(() => [
    ...registered.map((item) => ({
      id: item.id, code: item.code, description: item.draft.name,
      entryType: entryTypeLabels[item.draft.entryType],
      date: new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(item.createdAt)),
      registeredBy: item.createdBy, status: "Registrado" as const,
    })),
    ...mockEntries,
  ].filter((entry) => {
    const textMatch = `${entry.code} ${entry.description} ${entry.registeredBy}`.toLowerCase().includes(search.toLowerCase());
    return textMatch && (!typeFilter || entry.entryType === typeFilter) && (!statusFilter || entry.status === statusFilter);
  }), [registered, search, typeFilter, statusFilter]);

  return <section className="entries-page">
    <div className="page-heading"><div><p className="breadcrumb">Inicio / Entradas</p><h1>Entrada de bienes</h1><p>Registra y valida los bienes que ingresan a la organización.</p></div><Link className="button button-primary desktop-new-entry" to="/bienes/entradas/nueva"><Plus size={18} weight="bold" />Registrar nuevo bien</Link></div>
    <div className="metrics-grid">
      <article className="metric-pending"><span>Pendientes de validación</span><strong>24</strong><small>3 requieren atención hoy</small></article>
      <article><span>Registrados hoy</span><strong>{12 + registered.length}</strong><small>Actualizado en esta sesión</small></article>
      <article className="metric-error"><span>Observados</span><strong>3</strong><small>Documentación incompleta</small></article>
      <article className="metric-success"><span>Completados</span><strong>{145 + registered.length}</strong><small>Este mes</small></article>
    </div>
    <div className="data-panel">
      <div className="table-toolbar"><label className="search-field"><MagnifyingGlass size={18} /><input aria-label="Buscar entradas" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por código, descripción o responsable" /></label><button className="button button-secondary filter-toggle" type="button" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((value) => !value)}><Funnel size={18} />Filtros</button></div>
      <div className={`filter-row ${filtersOpen ? "is-open" : ""}`}>
        <select aria-label="Filtrar por tipo de ingreso" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}><option value="">Tipo de ingreso</option><option>Compra</option><option>Creación propia</option><option>Regalo o donación</option><option>Alquiler</option></select>
        <select aria-label="Filtrar por estado" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option value="">Estado</option>{Object.keys(statusClass).map((status) => <option key={status}>{status}</option>)}</select>
        {(typeFilter || statusFilter) && <button type="button" onClick={() => { setTypeFilter(""); setStatusFilter(""); }}>Limpiar filtros</button>}
      </div>
      <div className="table-scroll"><table><thead><tr><th>Código</th><th>Descripción</th><th>Tipo de ingreso</th><th>Fecha</th><th>Responsable</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>
        {entries.map((entry) => <tr key={entry.id}><td><strong>{entry.code}</strong></td><td>{entry.description}</td><td>{entry.entryType}</td><td>{entry.date}</td><td>{entry.registeredBy}</td><td><span className={`status ${statusClass[entry.status]}`}>{entry.status}</span></td><td><button className="table-action" type="button">Ver detalle <CaretRight /></button></td></tr>)}
        {!entries.length && <tr><td colSpan={7} className="empty-row">No encontramos entradas con esos criterios.</td></tr>}
      </tbody></table></div>
      <div className="mobile-entry-list">{entries.map((entry) => <article className="mobile-entry-card" key={entry.id}><header><strong>{entry.code}</strong><span className={`status ${statusClass[entry.status]}`}>{entry.status}</span></header><h2>{entry.description}</h2><p>{entry.entryType} · {entry.date}</p><small>Responsable: {entry.registeredBy}</small><button type="button" aria-label={`Ver ${entry.code}`}><CaretRight /></button></article>)}{!entries.length && <p className="empty-row">No encontramos entradas con esos criterios.</p>}</div>
      <footer className="table-footer"><span>Mostrando {entries.length} de {145 + registered.length} registros</span><div><button type="button" aria-label="Página anterior"><CaretLeft /></button><button className="is-current" type="button">1</button><button type="button">2</button><button type="button">3</button><button type="button" aria-label="Página siguiente"><CaretRight /></button></div></footer>
    </div>
    <Link className="mobile-register-fab" to="/bienes/entradas/nueva"><Plus weight="bold" />Registrar</Link>
  </section>;
}
