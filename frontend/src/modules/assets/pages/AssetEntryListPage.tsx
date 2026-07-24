import { Funnel, MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { mockEntries } from "@/modules/assets/data/mockEntries";
import { entryTypeLabels, type RegisteredAsset } from "@/modules/assets/entryModel";
import { listRegisteredAssets } from "@/modules/assets/assetEntryRepository";

const statusClass = { Borrador: "status-neutral", Pendiente: "status-warning", Observado: "status-error", Registrado: "status-success" };

export function AssetEntryListPage() {
  const [registered, setRegistered] = useState<RegisteredAsset[]>(() => listRegisteredAssets());
  const [search, setSearch] = useState("");

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
  ].filter((entry) => `${entry.code} ${entry.description} ${entry.registeredBy}`.toLowerCase().includes(search.toLowerCase())), [registered, search]);

  return <section>
    <div className="page-heading"><div><p className="breadcrumb">Bienes / Entradas</p><h1>Entrada de bienes</h1><p>Registra, valida y consulta los bienes que ingresan a la organización.</p></div><Link className="button button-primary" to="/bienes/entradas/nueva"><Plus size={19} weight="bold" />Registrar nuevo bien</Link></div>
    <div className="metrics-grid">
      <article><span>Pendientes de validación</span><strong>8</strong><small>3 requieren atención hoy</small></article>
      <article><span>Registrados hoy</span><strong>{12 + registered.length}</strong><small>Incluye registros de esta sesión</small></article>
      <article><span>Observados</span><strong>3</strong><small>Documentación incompleta</small></article>
      <article><span>Completados este mes</span><strong>{187 + registered.length}</strong><small>98,4 % sin observaciones</small></article>
    </div>
    <div className="data-panel"><div className="table-toolbar"><label className="search-field"><MagnifyingGlass size={19} /><input aria-label="Buscar entradas" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por código, descripción o responsable" /></label><button className="button button-secondary" type="button"><Funnel size={18} />Filtros</button></div>
      <div className="table-scroll"><table><thead><tr><th>Código</th><th>Descripción</th><th>Tipo de ingreso</th><th>Fecha</th><th>Registrado por</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>
        {entries.map((entry) => <tr key={entry.id}><td><strong>{entry.code}</strong></td><td>{entry.description}</td><td>{entry.entryType}</td><td>{entry.date}</td><td>{entry.registeredBy}</td><td><span className={`status ${statusClass[entry.status]}`}>{entry.status}</span></td><td><button className="table-action" type="button">Ver detalle</button></td></tr>)}
        {!entries.length && <tr><td colSpan={7} className="empty-row">No encontramos entradas con esos criterios.</td></tr>}
      </tbody></table></div>
    </div>
  </section>;
}
