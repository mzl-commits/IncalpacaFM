import { CaretRight, Funnel, MagnifyingGlass, Plus } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listAssignments, type AssignmentRecord } from "@/modules/assignments/assignmentRepository";

const typeLabel = { PERSONA: "Persona", AREA: "Área", ESPACIO_COMUN: "Espacio común" };
const stateLabel = { ASIGNADO: "Asignado", ENTREGADO: "Entregado", EN_TRASLADO: "En traslado", DEVUELTO: "Devuelto" };
const stateClass = (state: AssignmentRecord["delivery_status"]) =>
  state === "ENTREGADO" ? "status-success" : state === "DEVUELTO" ? "status-neutral" : "status-warning";

export function AssignmentListPage() {
  const [items, setItems] = useState<AssignmentRecord[]>([]);
  const [search, setSearch] = useState("");
  const [state, setState] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { listAssignments().then(setItems).catch(() => setError("No se pudieron cargar las asignaciones.")); }, []);
  const filtered = useMemo(() => items.filter((item) => {
    const matches = `${item.asset.code} ${item.asset.name} ${item.responsible.name}`.toLowerCase().includes(search.toLowerCase());
    return matches && (!state || item.delivery_status === state);
  }), [items, search, state]);
  const active = items.filter((x) => x.status === "ACTIVA");
  return <section className="assignments-page">
    <div className="page-heading"><div><p className="breadcrumb">Inicio / Asignaciones</p><h1>Asignaciones de bienes</h1><p>Gestiona responsables, entregas y movimientos con trazabilidad completa.</p></div><Link className="button button-primary" to="/asignaciones/nueva"><Plus weight="bold" />Nueva asignación</Link></div>
    <div className="metrics-grid assignment-metrics">
      <article><span>Asignaciones activas</span><strong>{active.length}</strong><small>Con responsable vigente</small></article>
      <article className="metric-pending"><span>Pendientes de entrega</span><strong>{active.filter((x) => x.delivery_status === "ASIGNADO").length}</strong><small>Requieren acta y firmas</small></article>
      <article className="metric-success"><span>Entregados</span><strong>{active.filter((x) => x.delivery_status === "ENTREGADO").length}</strong><small>Acta emitida</small></article>
      <article><span>Históricos</span><strong>{items.filter((x) => x.status !== "ACTIVA").length}</strong><small>Asignaciones cerradas</small></article>
    </div>
    <div className="data-panel">
      <div className="table-toolbar"><label className="search-field"><MagnifyingGlass /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por código, bien o responsable" /></label><label className="compact-filter"><Funnel /><select value={state} onChange={(e) => setState(e.target.value)}><option value="">Todos los estados</option><option value="ASIGNADO">Asignado</option><option value="ENTREGADO">Entregado</option><option value="EN_TRASLADO">En traslado</option><option value="DEVUELTO">Devuelto</option></select></label></div>
      <div className="table-scroll"><table><thead><tr><th>Bien</th><th>Responsable</th><th>Tipo</th><th>Ubicación</th><th>Inicio</th><th>Estado</th><th /></tr></thead><tbody>
        {filtered.map((item) => <tr key={item.id}><td><strong>{item.asset.code}</strong><small className="cell-subtitle">{item.asset.name}</small></td><td>{item.responsible.name}</td><td>{typeLabel[item.responsible.type]}</td><td>{item.location ? `${item.location.building} · ${item.location.room}` : "Por confirmar"}</td><td>{new Intl.DateTimeFormat("es-PE").format(new Date(item.start_date))}</td><td><span className={`status ${stateClass(item.delivery_status)}`}>{stateLabel[item.delivery_status]}</span></td><td><Link className="table-action" to={`/asignaciones/${item.id}`}>Ver detalle <CaretRight /></Link></td></tr>)}
        {!filtered.length && <tr><td colSpan={7} className="empty-row">{error || "No hay asignaciones con esos criterios."}</td></tr>}
      </tbody></table></div>
      <div className="assignment-cards">{filtered.map((item) => <article key={item.id}><header><strong>{item.asset.code}</strong><span className={`status ${stateClass(item.delivery_status)}`}>{stateLabel[item.delivery_status]}</span></header><h2>{item.asset.name}</h2><dl><div><dt>Responsable</dt><dd>{item.responsible.name}</dd></div><div><dt>Tipo</dt><dd>{typeLabel[item.responsible.type]}</dd></div><div><dt>Ubicación</dt><dd>{item.location?.room || "Por confirmar"}</dd></div></dl><Link to={`/asignaciones/${item.id}`}>Ver detalle <CaretRight /></Link></article>)}</div>
    </div>
  </section>;
}
