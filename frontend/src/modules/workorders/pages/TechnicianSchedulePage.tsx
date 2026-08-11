import { ArrowLeft, ArrowRight, CalendarBlank, Clock, ListChecks, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "@/modules/accounts/AuthContext";
import { getWorkOrderAssetDisplayCode, listWorkOrders } from "@/modules/workorders/workOrderRepository";
import { getWorkOrderStatusLabel } from "@/modules/workorders/workOrderModel";

const DAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const HOUR_RAIL = ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"];

type TechnicianOrder = Awaited<ReturnType<typeof listWorkOrders>>[number];
type TechnicianTaskTone = "active" | "pending" | "returned" | "done" | "closed";

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

function getTaskTone(order: TechnicianOrder): TechnicianTaskTone {
  if (order.status === "CANCELADA") return "closed";
  if (order.status === "EN_PROCESO") return "active";
  if (order.status === "DEVUELTA" || order.status === "REPROCESO") return "returned";
  if (
    order.progressPercentage >= 100 ||
    ["PENDIENTE_DE_SUPERVISION", "PENDIENTE_DE_VALIDACION", "PENDIENTE_DE_CONFORMIDAD", "CERRADA", "APROBADA_POR_SUPERVISOR"].includes(order.status)
  ) {
    return "done";
  }
  return "pending";
}

function getTaskLabel(order: TechnicianOrder) {
  const tone = getTaskTone(order);
  if (tone === "active") return "En proceso";
  if (tone === "done") return "Realizada";
  if (tone === "returned") return "Por corregir";
  if (tone === "closed") return "Cerrada";
  return "Por hacer";
}

function isCleaningOrder(order: TechnicianOrder) {
  return order.orderType === "OL" || order.code.startsWith("OL-");
}

function isRoutineCleaningOrder(order: TechnicianOrder) {
  return isCleaningOrder(order) && (order.administratorNotes || "").toLowerCase().includes("rutina generada");
}

function getOrderTypeLabel(order: TechnicianOrder) {
  if (!isCleaningOrder(order)) return "OT";
  return isRoutineCleaningOrder(order) ? "OL rutinaria" : "OL puntual";
}

function getOrderTypeClass(order: TechnicianOrder) {
  if (!isCleaningOrder(order)) return "is-ot";
  return isRoutineCleaningOrder(order) ? "is-ol-routine" : "is-ol";
}

function getTaskActionLabel(order: TechnicianOrder) {
  const tone = getTaskTone(order);
  if (tone === "active") return isCleaningOrder(order) ? "Continuar limpieza" : "Continuar trabajo";
  if (tone === "pending") return isCleaningOrder(order) ? "Iniciar limpieza" : "Iniciar trabajo";
  if (tone === "returned") return "Revisar corrección";
  return "Ver detalle";
}

function getTaskSortValue(order: TechnicianOrder) {
  const toneRank: Record<TechnicianTaskTone, number> = {
    active: 0,
    pending: 1,
    returned: 2,
    done: 3,
    closed: 4,
  };
  const hour = order.scheduledStartTime ? Number(order.scheduledStartTime.slice(0, 2)) : 8;
  return toneRank[getTaskTone(order)] * 1000 + hour;
}

function sortTechnicianTasks(left: TechnicianOrder, right: TechnicianOrder) {
  return getTaskSortValue(left) - getTaskSortValue(right);
}

function countByTone(orders: TechnicianOrder[]) {
  return orders.reduce((summary, order) => {
    summary[getTaskTone(order)] += 1;
    return summary;
  }, { active: 0, pending: 0, returned: 0, done: 0, closed: 0 } as Record<TechnicianTaskTone, number>);
}

function formatHours(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
}

function registeredMinutes(order: TechnicianOrder, startKey: string, endKey: string) {
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

function totalWorkedMinutes(order: TechnicianOrder) {
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

function getExecutionPath(order: TechnicianOrder) {
  const canExecute = order.status === "PROGRAMADA" || order.status === "EN_PROCESO";
  return `/ordenes-trabajo/${order.id}${canExecute ? "/ejecutar" : ""}`;
}

export function TechnicianSchedulePage() {
  const { user } = useAuth();
  const isAdministrator = user?.role === "ADMINISTRADOR";
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
  const todayKey = toDateKey(new Date());
  const technicianOrders = orders.filter((order) => order.orderType !== "OS" && !order.code.startsWith("OS-"));
  const weekOrders = technicianOrders.filter((order) => order.scheduledDate >= startKey && order.scheduledDate <= endKey);
  const todayOrders = weekOrders.filter((order) => order.scheduledDate === todayKey).sort(sortTechnicianTasks);
  const todaySummary = countByTone(todayOrders);
  const attentionNow = todayOrders.filter((order) => ["active", "pending", "returned"].includes(getTaskTone(order))).slice(0, 3);
  const plannedHours = weekOrders.reduce((total, order) => total + (order.plannedHours || 2), 0);
  const plannedMinutes = plannedHours * 60;
  const workedMinutes = technicianOrders.reduce((total, order) => total + registeredMinutes(order, startKey, endKey), 0);
  const pendingMinutes = Math.max(plannedMinutes - workedMinutes, 0);
  const completed = weekOrders.filter((order) => getTaskTone(order) === "done" || getTaskTone(order) === "closed").length;
  const hoursProgress = plannedMinutes ? Math.min(100, Math.round((workedMinutes / plannedMinutes) * 100)) : 0;
  const completedHistory = technicianOrders
    .filter((order) => order.status === "CERRADA" || order.progressPercentage === 100)
    .sort((left, right) => new Date(right.closedAt ?? right.finishedAt ?? right.updatedAt).getTime() - new Date(left.closedAt ?? left.finishedAt ?? left.updatedAt).getTime())
    .slice(0, 8);
  const completedMinutes = completedHistory.reduce((total, order) => total + totalWorkedMinutes(order), 0);
  const technicianSummary = useMemo(() => {
    const grouped = new Map<string, { name: string; total: number; pending: number; active: number; done: number; hours: number }>();
    weekOrders.forEach((order) => {
      const current = grouped.get(order.operatorId) ?? { name: order.operatorName || "Técnico sin nombre", total: 0, pending: 0, active: 0, done: 0, hours: 0 };
      const tone = getTaskTone(order);
      current.total += 1;
      current.hours += order.plannedHours || 2;
      if (tone === "pending" || tone === "returned") current.pending += 1;
      if (tone === "active") current.active += 1;
      if (tone === "done" || tone === "closed") current.done += 1;
      grouped.set(order.operatorId, current);
    });
    return [...grouped.values()].sort((left, right) => right.pending - left.pending || left.name.localeCompare(right.name));
  }, [weekOrders]);

  return (
    <section className="technician-schedule-page">
      <header className="technician-schedule-heading">
        <div>
          <p className="breadcrumb">Mi trabajo / Agenda semanal</p>
          <h1>{isAdministrator ? "Jornada del equipo técnico" : "Mi agenda de trabajo"}</h1>
          <p>Distingue rápido qué tienes pendiente, qué está en proceso y qué ya terminaste.</p>
        </div>
        <Link className="button button-secondary" to="/ordenes-trabajo"><ListChecks size={18} />Ver mis órdenes</Link>
      </header>

      <section className="technician-week-toolbar" aria-label="Semana mostrada">
        <button type="button" className="icon-button" aria-label="Semana anterior" onClick={() => setWeekStart((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() - 7))}><ArrowLeft size={20} /></button>
        <div><CalendarBlank size={20} /><strong>{days[0].toLocaleDateString("es-PE", { day: "2-digit", month: "short" })} - {days[6].toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}</strong></div>
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

      {isAdministrator && <section className="team-schedule-summary" aria-labelledby="team-schedule-summary-title">
        <header><div><span>Vista de supervisión</span><h2 id="team-schedule-summary-title">Carga por técnico</h2><p>Resumen de órdenes programadas en la semana seleccionada.</p></div><strong>{technicianSummary.length} técnicos</strong></header>
        {technicianSummary.length ? <div className="team-schedule-summary-grid">{technicianSummary.map((technician) => <article key={technician.name}><div className="team-schedule-avatar">{technician.name.slice(0, 2).toUpperCase()}</div><div className="team-schedule-person"><strong>{technician.name}</strong><span>{technician.total} OT · {technician.hours} h programadas</span></div><dl><div><dt>Por atender</dt><dd>{technician.pending}</dd></div><div><dt>En proceso</dt><dd>{technician.active}</dd></div><div><dt>Realizadas</dt><dd>{technician.done}</dd></div></dl></article>)}</div> : <div className="technician-empty-state"><CalendarBlank size={24} /><span>No hay órdenes asignadas al equipo en esta semana.</span></div>}
      </section>}

      <section className="technician-today-focus" aria-labelledby="today-focus-title">
        <header>
          <div>
            <span>Enfoque de hoy</span>
            <h2 id="today-focus-title">{todayOrders.length ? `${todayOrders.length} ${todayOrders.length === 1 ? "orden asignada" : "órdenes asignadas"}` : "Sin órdenes para hoy"}</h2>
          </div>
          <dl>
            <div><dt>En proceso</dt><dd>{todaySummary.active}</dd></div>
            <div><dt>Por hacer</dt><dd>{todaySummary.pending}</dd></div>
            <div><dt>Por corregir</dt><dd>{todaySummary.returned}</dd></div>
            <div><dt>Realizadas</dt><dd>{todaySummary.done + todaySummary.closed}</dd></div>
          </dl>
        </header>
        {attentionNow.length ? (
          <div className="technician-today-focus-list">
            {attentionNow.map((order) => (
              <Link key={order.id} to={getExecutionPath(order)} className={`technician-today-item is-${getTaskTone(order)} ${getOrderTypeClass(order)}`}>
                <span><b>{getTaskLabel(order)}</b><i>{getOrderTypeLabel(order)}</i></span>
                <strong>{order.code}</strong>
                <small>{getWorkOrderAssetDisplayCode(order) || order.requestCode}</small>
                <em>{getTaskActionLabel(order)}</em>
              </Link>
            ))}
          </div>
        ) : (
          <div className="technician-today-empty">
            <WarningCircle size={22} />
            <span>{todayOrders.length ? "Lo de hoy ya está realizado o en cierre." : "No tienes trabajos programados para hoy."}</span>
          </div>
        )}
      </section>

      <div className="technician-task-legend" aria-label="Leyenda de agenda">
        <span><i className="is-pending" />Por hacer</span>
        <span><i className="is-active" />En proceso</span>
        <span><i className="is-returned" />Por corregir</span>
        <span><i className="is-done" />Realizada</span>
        <span><i className="is-ol" />OL limpieza</span>
      </div>

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
                const dayOrders = weekOrders.filter((order) => order.scheduledDate === dateKey).sort(sortTechnicianTasks);
                const isToday = dateKey === toDateKey(new Date());
                return <section className={`technician-day ${isToday ? "is-today" : ""}`} key={dateKey}>
                  <header>
                    <span>{DAY_LABELS[index]}</span>
                    <div>
                      <strong>{day.getDate()}</strong>
                      <small>{dayOrders.length ? `${dayOrders.filter((order) => ["active", "pending", "returned"].includes(getTaskTone(order))).length} pendientes` : "Libre"}</small>
                    </div>
                  </header>
                  <div>
                    {dayOrders.length ? dayOrders.map((order) => (
                      <Link key={order.id} to={getExecutionPath(order)} className={`technician-task is-${getTaskTone(order)} ${getOrderTypeClass(order)}`}>
                        <span className="technician-task-topline"><b>{getOrderTypeLabel(order)}</b><i>{getTaskLabel(order)}</i></span>
                        <strong>{order.code}</strong>
                        <span>{getWorkOrderAssetDisplayCode(order) || order.requestCode}</span>
                        <small><Clock size={13} />{order.plannedHours || 2} h - {getWorkOrderStatusLabel(order)}</small>
                        <em>{getTaskActionLabel(order)}</em>
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
              const dayOrders = weekOrders.filter((order) => order.scheduledDate === dateKey).sort(sortTechnicianTasks);
              const isToday = dateKey === toDateKey(new Date());
              return <section className={`technician-mobile-day ${isToday ? "is-today" : ""}`} key={dateKey}>
                <header><span>{isToday ? "Hoy - " : ""}{DAY_LABELS[index]}</span><strong>{day.toLocaleDateString("es-PE", { day: "numeric", month: "long" })}</strong><small>{dayOrders.length ? `${dayOrders.length} ${dayOrders.length === 1 ? "orden" : "órdenes"}` : "Sin tareas"}</small></header>
                {dayOrders.map((order) => {
                  const orderMinutes = registeredMinutes(order, startKey, endKey);
                  return <Link to={getExecutionPath(order)} className={`technician-mobile-task is-${getTaskTone(order)} ${getOrderTypeClass(order)}`} key={order.id}>
                    <div><strong>{order.code}</strong><span>{getWorkOrderAssetDisplayCode(order) || order.requestCode}</span></div>
                    <i>{getOrderTypeLabel(order)} - {getTaskLabel(order)} - {getWorkOrderStatusLabel(order)}</i>
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
        {weekOrders.length ? <div className="table-scroll"><table><thead><tr><th>Orden</th><th>Tipo</th><th>Bien / solicitud</th><th>Programada</th><th>Previsto</th><th>Registrado</th><th>Avance</th></tr></thead><tbody>{[...weekOrders].sort(sortTechnicianTasks).map((order) => {
          const orderMinutes = registeredMinutes(order, startKey, endKey);
          return <tr key={order.id} className={`is-${getTaskTone(order)}`}><td><Link to={`/ordenes-trabajo/${order.id}`}>{order.code}</Link></td><td><span className={`technician-order-type ${getOrderTypeClass(order)}`}>{getOrderTypeLabel(order)}</span></td><td>{getWorkOrderAssetDisplayCode(order) || order.requestCode}</td><td>{new Date(`${order.scheduledDate}T00:00:00`).toLocaleDateString("es-PE", { day: "2-digit", month: "short" })}</td><td>{order.plannedHours || 2} h</td><td>{formatHours(orderMinutes)}</td><td>{getTaskLabel(order)} - {order.progressPercentage} %</td></tr>;
        })}</tbody></table></div> : <div className="technician-empty-state"><CalendarBlank size={28} /><strong>No tienes órdenes programadas esta semana</strong><p>Cambia de semana para revisar tu agenda anterior o futura.</p></div>}
      </section>

      <section className="technician-work-history" aria-labelledby="work-history-title">
        <header><div><h2 id="work-history-title">Historial de trabajo realizado</h2><p>Últimas órdenes completadas y el tiempo registrado por el temporizador.</p></div>{completedHistory.length > 0 && <strong>{formatHours(completedMinutes)} acumuladas</strong>}</header>
        {completedHistory.length ? <div>{completedHistory.map((order) => {
          const completedAt = order.closedAt ?? order.finishedAt ?? order.updatedAt;
          return <Link key={order.id} to={`/ordenes-trabajo/${order.id}`}><span><strong>{order.code}</strong><small>{getOrderTypeLabel(order)} - {getWorkOrderAssetDisplayCode(order) || order.requestCode}</small></span><dl><div><dt>Finalizada</dt><dd>{formatHistoryDate(completedAt)}</dd></div><div><dt>Tiempo registrado</dt><dd>{formatHours(totalWorkedMinutes(order))}</dd></div><div><dt>Resultado</dt><dd>{getWorkOrderStatusLabel(order)}</dd></div></dl></Link>;
        })}</div> : <div className="technician-history-empty"><Clock size={28} /><span><strong>Aún no hay órdenes finalizadas</strong><small>Cuando completes una orden, quedará registrada aquí junto con sus horas.</small></span></div>}
      </section>
    </section>
  );
}
