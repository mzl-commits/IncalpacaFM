import { useQuery } from "@tanstack/react-query";
import { ClockCounterClockwise, Eye, MagnifyingGlass, ShieldCheck, UserCircle, WarningCircle, X } from "@phosphor-icons/react";
import { useMemo, useRef, useState } from "react";
import { fetchAuditEvents, type AuditEvent } from "../auditRepository";

const entityLabels: Record<string, string> = { Asset: "Bien", Assignment: "Asignación", Incident: "Incidencia", WorkOrder: "Orden de trabajo", Taxonomy: "Taxonomía", LocationMap: "Mapa de ambiente" };
const actionLabels: Record<string, string> = {
  ASSET_CREATED: "Bien registrado",
  ASSET_UPDATED: "Bien actualizado",
  ASSET_CLASSIFIED: "Bien clasificado",
  INCIDENT_CREATED: "Incidencia registrada",
  INCIDENT_UPDATED: "Incidencia actualizada",
  WORK_ORDER_CREATED: "Orden de trabajo creada",
  WORK_ORDER_START: "Orden de trabajo iniciada",
  WORK_ORDER_PROGRESS: "Avance de orden registrado",
  WORK_ORDER_DIAGNOSIS: "Diagnóstico de orden registrado",
  WORK_ORDER_SUPERVISOR_APPROVE: "Orden aprobada por supervisión",
  WORK_ORDER_SUPERVISOR_RETURN: "Orden devuelta por supervisión",
  WORK_ORDER_ADMIN_APPROVE: "Orden aprobada por administración",
  WORK_ORDER_ADMIN_RETURN: "Orden devuelta por administración",
  WORK_ORDER_CONFORM: "Conformidad registrada",
  WORK_ORDER_REOPEN: "Orden reabierta",
  RETIREMENT_REQUEST_CREATED: "Solicitud de baja creada",
  RETIREMENT_REQUEST_UPDATED: "Solicitud de baja actualizada",
  TAXONOMY_CREATED: "Taxonomía creada",
  TAXONOMY_UPDATED: "Taxonomía actualizada",
  TAXONOMY_ACTIVATED: "Taxonomía activada",
  TAXONOMY_DEACTIVATED: "Taxonomía desactivada",
  LOCATION_MAP_UPLOADED: "Imagen de ambiente cargada",
  LOCATION_MAP_REMOVED: "Imagen de ambiente retirada",
  FACILITY_PLAN_RECONCILED: "Plano de planta conciliado",
};

function readableAction(action: string) {
  return actionLabels[action] ?? action.toLocaleLowerCase("es").replaceAll("_", " ").replace(/^./, (letter) => letter.toLocaleUpperCase("es"));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value));
}

export function AuditLogPage() {
  const [query, setQuery] = useState("");
  const [entity, setEntity] = useState("ALL");
  const [date, setDate] = useState("");
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const detailRef = useRef<HTMLDialogElement>(null);
  const events = useQuery({ queryKey: ["audit-events"], queryFn: fetchAuditEvents });

  const entities = useMemo(() => Array.from(new Set((events.data ?? []).map((item) => item.entity))).sort(), [events.data]);
  const rows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("es");
    return (events.data ?? []).filter((item) => {
      const matchesQuery = !normalized || [item.action, item.entity, item.entity_id, item.actor_name, item.correlation_id].join(" ").toLocaleLowerCase("es").includes(normalized);
      return matchesQuery && (entity === "ALL" || item.entity === entity) && (!date || item.created_at.slice(0, 10) === date);
    });
  }, [date, entity, events.data, query]);

  function openDetail(item: AuditEvent) {
    setSelected(item);
    detailRef.current?.showModal();
  }

  return (
    <section className="registry-page audit-page">
      <header className="page-heading registry-heading"><div><h1>Auditoría del sistema</h1><p>Revisa quién realizó cada cambio, sobre qué registro y con qué resultado.</p></div></header>
      <div className="audit-assurance"><ShieldCheck size={25} weight="duotone" /><div><strong>Bitácora inmutable</strong><span>Los eventos se conservan en orden cronológico y no pueden eliminarse desde la aplicación.</span></div><span>{events.data?.length ?? 0} eventos</span></div>

      <section className="registry-workspace" aria-labelledby="audit-results-title">
        <div className="registry-toolbar audit-toolbar">
          <label className="registry-search"><MagnifyingGlass size={19} /><span className="sr-only">Buscar en auditoría</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Acción, usuario, entidad o correlación" /></label>
          <label><span>Entidad</span><select value={entity} onChange={(event) => setEntity(event.target.value)}><option value="ALL">Todas las entidades</option>{entities.map((value) => <option value={value} key={value}>{entityLabels[value] ?? value}</option>)}</select></label>
          <label><span>Fecha exacta</span><input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
        </div>
        <div className="registry-result-heading"><div><h2 id="audit-results-title">Actividad registrada</h2><p>{rows.length} evento(s) con los filtros actuales</p></div>{(query || entity !== "ALL" || date) && <button className="button button-secondary" type="button" onClick={() => { setQuery(""); setEntity("ALL"); setDate(""); }}>Limpiar filtros</button>}</div>

        {events.isLoading ? <div className="registry-state" aria-busy="true">Cargando la bitácora...</div> : events.isError ? <div className="registry-state is-error"><WarningCircle size={28} /><strong>No se pudo consultar la auditoría</strong><button className="button button-secondary" type="button" onClick={() => events.refetch()}>Reintentar</button></div> : rows.length === 0 ? <div className="registry-state"><ClockCounterClockwise size={30} /><strong>No hay eventos para estos criterios</strong><span>Amplía la fecha o limpia los filtros.</span></div> : (
          <div className="registry-table-wrap"><table className="registry-table audit-table"><thead><tr><th>Fecha y hora</th><th>Acción</th><th>Entidad</th><th>Responsable</th><th>Referencia</th><th><span className="sr-only">Acción</span></th></tr></thead><tbody>{rows.map((item) => <tr key={item.id}><td>{formatDate(item.created_at)}</td><td><strong>{readableAction(item.action)}</strong></td><td><span className="audit-entity">{entityLabels[item.entity] ?? item.entity}</span></td><td><div className="audit-actor"><UserCircle size={19} /><span>{item.actor_name}</span></div></td><td><code>{item.entity_id}</code></td><td><button className="table-action" type="button" onClick={() => openDetail(item)}><Eye size={17} /> Detalle</button></td></tr>)}</tbody></table></div>
        )}
      </section>

      <dialog ref={detailRef} className="audit-detail-dialog" onClose={() => setSelected(null)} onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }}>
        {selected && <article><header><div><span>{entityLabels[selected.entity] ?? selected.entity}</span><h2>{readableAction(selected.action)}</h2></div><button type="button" aria-label="Cerrar detalle" onClick={() => detailRef.current?.close()}><X size={20} /></button></header><dl><div><dt>Responsable</dt><dd>{selected.actor_name}</dd></div><div><dt>Fecha y hora</dt><dd>{formatDate(selected.created_at)}</dd></div><div><dt>Entidad</dt><dd>{selected.entity_id}</dd></div><div><dt>IP registrada</dt><dd>{selected.ip_address || "No disponible"}</dd></div><div className="audit-correlation"><dt>ID de correlación</dt><dd><code>{selected.correlation_id}</code></dd></div></dl><div className="audit-change-grid"><section><h3>Estado anterior</h3><pre>{JSON.stringify(selected.before ?? {}, null, 2)}</pre></section><section><h3>Estado resultante</h3><pre>{JSON.stringify(selected.after ?? {}, null, 2)}</pre></section></div></article>}
      </dialog>
    </section>
  );
}
