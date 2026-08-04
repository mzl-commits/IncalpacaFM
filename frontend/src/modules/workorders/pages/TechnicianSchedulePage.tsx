import { ArrowLeft, ArrowRight, CalendarBlank, Clock, ListChecks } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { getWorkOrderAssetDisplayCode, listWorkOrders } from "@/modules/workorders/workOrderRepository";
import { workOrderStatusLabels } from "@/modules/workorders/workOrderModel";

const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const HOUR_RAIL = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"];

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

function totalWorkedMinutes(order: Awaited<ReturnType<typeof listWorkOrders>>[number]) {
  const sessions = order.workSessions ?? [];
  if (sessions.length) {
    return sessions.reduce((total, session) => {
      const startedAt = new Date(session.startAt).getTime();
      const endedAt = session.endAt ? new Date(session.endAt).getTime() : Date.now();
      return total + Math.max(0, Math.round((endedAt - startedAt) / 60000));
    }, 0);
  }
  return (order.advances ?? []).reduce((total, advance) => total + (advance.workedMinutes ?? 0), 0);
}

function formatHistoryDate(value?: string) {
  if (!value) return "Fecha no registrada";
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
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
  const plannedMinutes = plannedHours * 60;
  const workedMinutes = orders.reduce(
    (total, order) => total + registeredMinutes(order, startKey, endKey),
    0,
  );
  const pendingMinutes = Math.max(plannedMinutes - workedMinutes, 0);
  const completed = weekOrders.filter((order) => order.progressPercentage === 100 || order.status === "CERRADA").length;
  const hoursProgress = plannedMinutes ? Math.min(100, Math.round((workedMinutes / plannedMinutes) * 100)) : 0;
  const completedHistory = orders
    .filter((order) => order.status === "CERRADA" || order.progressPercentage === 100)
    .sort((left, right) => new Date(right.closedAt ?? right.finishedAt ?? right.updatedAt).getTime() - new Date(left.closedAt ?? left.finishedAt ?? left.updatedAt).getTime())
    .slice(0, 8);
  const completedMinutes = completedHistory.reduce((total, order) => total + totalWorkedMinutes(order), 0);

  return (
    <section className="technician-schedule-page">
      <header className="technician-schedule-heading">
        <div>
          <p className="breadcrumb">Mi trabajo / Agenda semanal</p>
          <h1>Mi agenda de trabajo</h1>
          <p>Revisa lo programado, controla el tiempo que registra el temporizador y abre cada orden para actualizarla.</p>
        </div>
        <Link className="button button-secondary" to="/ordenes-trabajo"><ListChecks size={18} />Ver mis órdenes</Link>
      </header>

      <section className="technician-week-toolbar" aria-label="Semana mostrada">
        <button type="button" className="icon-button" aria-label="Semana anterior" onClick={() => setWeekStart((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() - 7))}><ArrowLeft size={20} /></button>
        <div><CalendarBlank size={20} /><strong>{days[0].toLocaleDateString("es-PE", { day: "2-digit", month: "short" })} — {days[6].toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}</strong></div>
        <button type="button" className="icon-button" aria-label="Semana siguiente" onClick={() => setWeekStart((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() + 7))}><ArrowRight size={20} /></button>
      </section>

      <section className="technician-hours-overview" aria-labelledby="hours-summary-title">
        <header><div><h2 id="hours-summary-title">Resumen de esta semana</h2><p>El tiempo se toma de las sesiones iniciadas y pausadas en cada orden.</p></div><strong>{hoursProgress}%</strong></header>
        <div className="technician-hours-progress"><div style={{ width: `${hoursProgress}%` }} /></div>
        <p className="technician-hours-progress-copy"><strong>{formatHours(workedMinutes)}</strong> registradas de <strong>{formatHours(plannedMinutes)}</strong> programadas</p>
        <dl className="technician-hours-summary">
          <div><dt>Por registrar</dt><dd>{formatHours(pendingMinutes)}</dd><small>Para completar tu carga programada</small></div>
          <div><dt>Órdenes listas</dt><dd>{completed} / {weekOrders.length}</dd><small>Finalizadas o cerradas esta semana</small></div>
        </dl>
      </section>

      {loading ? <div className="technician-schedule-loading" aria-label="Cargando agenda" /> : (
        <>
        <div className="technician-week-grid" aria-label="Cronograma semanal con escala horaria referencial">
          <aside className="technician-hour-rail" aria-label="Horas de la jornada referencial">
            <header><span>Hora</span></header>
            <div>{HOUR_RAIL.map((hour) => <span key={hour}>{hour}</span>)}</div>
          </aside>
          <div className="technician-week-days">
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
        </div>
        <div className="technician-mobile-days" aria-label="Agenda semanal detallada">
          {days.map((day, index) => {
            const dateKey = toDateKey(day);
            const dayOrders = weekOrders.filter((order) => order.scheduledDate === dateKey);
            const isToday = dateKey === toDateKey(new Date());
            return <section className={`technician-mobile-day ${isToday ? "is-today" : ""}`} key={dateKey}>
              <header><span>{isToday ? "Hoy · " : ""}{DAY_LABELS[index]}</span><strong>{day.toLocaleDateString("es-PE", { day: "numeric", month: "long" })}</strong><small>{dayOrders.length ? `${dayOrders.length} ${dayOrders.length === 1 ? "orden" : "órdenes"}` : "Sin tareas"}</small></header>
              {dayOrders.map((order) => {
                const orderMinutes = registeredMinutes(order, startKey, endKey);
                const executionPath = `/ordenes-trabajo/${order.id}${order.status === "PROGRAMADA" || order.status === "EN_PROCESO" ? "/ejecutar" : ""}`;
                return <Link to={executionPath} className="technician-mobile-task" key={order.id}>
                  <div><strong>{order.code}</strong><span>{getWorkOrderAssetDisplayCode(order) || order.requestCode}</span></div>
                  <i>{workOrderStatusLabels[order.status]}</i>
                  <dl><div><dt>Programado</dt><dd>{order.plannedHours || 2} h</dd></div><div><dt>Registrado</dt><dd>{formatHours(orderMinutes)}</dd></div><div><dt>Avance</dt><dd>{order.progressPercentage}%</dd></div></dl>
                </Link>;
              })}
            </section>;
          })}
        </div>
        </>
      )}

      <section className="technician-timesheet" aria-labelledby="timesheet-title">
        <header><div><h2 id="timesheet-title">Hoja resumen semanal</h2><p>Tiempo registrado por orden durante la semana seleccionada.</p></div></header>
        {weekOrders.length ? <div className="table-scroll"><table><thead><tr><th>Orden</th><th>Bien / solicitud</th><th>Programada</th><th>Previsto</th><th>Registrado</th><th>Avance</th></tr></thead><tbody>{weekOrders.map((order) => {
          const orderMinutes = registeredMinutes(order, startKey, endKey);
          return <tr key={order.id}><td><Link to={`/ordenes-trabajo/${order.id}`}>{order.code}</Link></td><td>{getWorkOrderAssetDisplayCode(order) || order.requestCode}</td><td>{new Date(`${order.scheduledDate}T00:00:00`).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}</td><td>{order.plannedHours || 2} h</td><td>{formatHours(orderMinutes)}</td><td>{order.progressPercentage} %</td></tr>;
        })}</tbody></table></div> : <div className="technician-empty-state"><CalendarBlank size={28} /><strong>No tienes órdenes programadas esta semana</strong><p>Cambia de semana para revisar tu agenda anterior o futura.</p></div>}
      </section>

      <section className="technician-work-history" aria-labelledby="work-history-title">
        <header><div><h2 id="work-history-title">Historial de trabajo realizado</h2><p>Últimas órdenes completadas y el tiempo registrado por el temporizador.</p></div>{completedHistory.length > 0 && <strong>{formatHours(completedMinutes)} acumuladas</strong>}</header>
        {completedHistory.length ? <div>{completedHistory.map((order) => {
          const completedAt = order.closedAt ?? order.finishedAt ?? order.updatedAt;
          return <Link key={order.id} to={`/ordenes-trabajo/${order.id}`}><span><strong>{order.code}</strong><small>{getWorkOrderAssetDisplayCode(order) || order.requestCode}</small></span><dl><div><dt>Finalizada</dt><dd>{formatHistoryDate(completedAt)}</dd></div><div><dt>Tiempo registrado</dt><dd>{formatHours(totalWorkedMinutes(order))}</dd></div><div><dt>Resultado</dt><dd>{workOrderStatusLabels[order.status]}</dd></div></dl></Link>;
        })}</div> : <div className="technician-history-empty"><Clock size={28} /><span><strong>Aún no hay órdenes finalizadas</strong><small>Cuando completes una OT, quedará registrada aquí junto con sus horas.</small></span></div>}
      </section>
    </section>
  );
}
