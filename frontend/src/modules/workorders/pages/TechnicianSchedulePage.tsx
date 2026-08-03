import { ArrowLeft, ArrowRight, CalendarBlank, Clock, ListChecks } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { getWorkOrderAssetDisplayCode, listWorkOrders } from "@/modules/workorders/workOrderRepository";
import { workOrderStatusLabels } from "@/modules/workorders/workOrderModel";

const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfWeek(date: Date) {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7));
  return copy;
}

function weekDays(start: Date) {
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

function formatHours(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
}

function registeredMinutes(
  order: Awaited<ReturnType<typeof listWorkOrders>>[number],
  startKey: string,
  endKey: string,
) {
  const sessions = order.workSessions ?? [];
  if (sessions.length) {
    return sessions.reduce((total, session) => {
      const startedAt = new Date(session.startAt);
      const key = toDateKey(startedAt);
      if (key < startKey || key > endKey) return total;
      const endedAt = session.endAt ? new Date(session.endAt) : new Date();
      return total + Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000));
    }, 0);
  }
  return (order.advances ?? []).filter((advance) => {
    const key = advance.createdAt.slice(0, 10);
    return key >= startKey && key <= endKey;
  }).reduce((total, advance) => total + (advance.workedMinutes ?? 0), 0);
}

export function TechnicianSchedulePage() {
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof listWorkOrders>>>([]);
  const [loading, setLoading] = useState(true);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));

  useEffect(() => {
    let active = true;
    void listWorkOrders().then((result) => {
      if (active) setOrders(result);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const startKey = toDateKey(days[0]);
  const endKey = toDateKey(days[6]);
  const weekOrders = orders.filter((order) => order.scheduledDate >= startKey && order.scheduledDate <= endKey);
  const plannedHours = weekOrders.reduce((total, order) => total + (order.plannedHours || 2), 0);
  const workedMinutes = orders.reduce(
    (total, order) => total + registeredMinutes(order, startKey, endKey),
    0,
  );
  const pendingMinutes = Math.max(plannedHours * 60 - workedMinutes, 0);
  const completed = weekOrders.filter((order) => order.progressPercentage === 100 || order.status === "CERRADA").length;

  return (
    <section className="technician-schedule-page">
      <header className="technician-schedule-heading">
        <div>
          <p className="breadcrumb">Mi trabajo / Agenda semanal</p>
          <h1>Mi agenda de trabajo</h1>
          <p>Consulta tus órdenes asignadas y registra el tiempo realmente dedicado en cada avance.</p>
        </div>
        <Link className="button button-secondary" to="/ordenes-trabajo"><ListChecks size={18} />Ver mis órdenes</Link>
      </header>

      <section className="technician-week-toolbar" aria-label="Semana mostrada">
        <button type="button" className="icon-button" aria-label="Semana anterior" onClick={() => setWeekStart((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() - 7))}><ArrowLeft size={20} /></button>
        <div><CalendarBlank size={20} /><strong>{days[0].toLocaleDateString("es-PE", { day: "2-digit", month: "short" })} — {days[6].toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}</strong></div>
        <button type="button" className="icon-button" aria-label="Semana siguiente" onClick={() => setWeekStart((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() + 7))}><ArrowRight size={20} /></button>
      </section>

      <dl className="technician-hours-summary">
        <div><dt>Horas previstas</dt><dd>{plannedHours} h</dd><small>Según órdenes programadas</small></div>
        <div><dt>Horas registradas</dt><dd>{formatHours(workedMinutes)}</dd><small>Desde las sesiones de trabajo</small></div>
        <div><dt>Por registrar</dt><dd>{formatHours(pendingMinutes)}</dd><small>Frente a la carga prevista</small></div>
        <div><dt>Órdenes completadas</dt><dd>{completed} / {weekOrders.length}</dd><small>De esta semana</small></div>
      </dl>

      {loading ? <div className="technician-schedule-loading" aria-label="Cargando agenda" /> : (
        <div className="technician-week-grid">
          {days.map((day, index) => {
            const dateKey = toDateKey(day);
            const dayOrders = weekOrders.filter((order) => order.scheduledDate === dateKey);
            const isToday = dateKey === toDateKey(new Date());
            return <section className={`technician-day ${isToday ? "is-today" : ""}`} key={dateKey}>
              <header><span>{DAY_LABELS[index]}</span><strong>{day.getDate()}</strong></header>
              <div>
                {dayOrders.length ? dayOrders.map((order) => (
                  <Link key={order.id} to={`/ordenes-trabajo/${order.id}${order.status === "PROGRAMADA" || order.status === "EN_PROCESO" ? "/ejecutar" : ""}`} className="technician-task">
                    <strong>{order.code}</strong><span>{getWorkOrderAssetDisplayCode(order) || order.requestCode}</span><small><Clock size={13} />{order.plannedHours || 2} h · {workOrderStatusLabels[order.status]}</small>
                  </Link>
                )) : <p className="technician-day-empty">Sin tareas</p>}
              </div>
            </section>;
          })}
        </div>
      )}

      <section className="technician-timesheet" aria-labelledby="timesheet-title">
        <header><div><h2 id="timesheet-title">Hoja resumen semanal</h2><p>Tiempo registrado por orden durante la semana seleccionada.</p></div></header>
        {weekOrders.length ? <div className="table-scroll"><table><thead><tr><th>Orden</th><th>Bien / solicitud</th><th>Programada</th><th>Previsto</th><th>Registrado</th><th>Avance</th></tr></thead><tbody>{weekOrders.map((order) => {
          const orderMinutes = registeredMinutes(order, startKey, endKey);
          return <tr key={order.id}><td><Link to={`/ordenes-trabajo/${order.id}`}>{order.code}</Link></td><td>{getWorkOrderAssetDisplayCode(order) || order.requestCode}</td><td>{new Date(`${order.scheduledDate}T00:00:00`).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}</td><td>{order.plannedHours || 2} h</td><td>{formatHours(orderMinutes)}</td><td>{order.progressPercentage} %</td></tr>;
        })}</tbody></table></div> : <div className="technician-empty-state"><CalendarBlank size={28} /><strong>No tienes órdenes programadas esta semana</strong><p>Cambia de semana para revisar tu agenda anterior o futura.</p></div>}
      </section>
    </section>
  );
}
