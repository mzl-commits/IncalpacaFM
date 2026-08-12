import {
  ArrowLeft,
  Bell,
  CalendarBlank,
  Clock,
  PaperPlaneTilt,
  Plus,
  Star,
  WarningCircle,
  Wrench,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  listTechnicians,
  notifyTechnician,
  type Technician,
} from "@/modules/accounts/technicianRepository";
import {
  listWorkOrders,
  quickAssignWorkOrder,
} from "@/modules/workorders/workOrderRepository";
import { getWorkOrderStatusLabel } from "@/modules/workorders/workOrderModel";
import type { WorkOrder } from "@/modules/workorders/types";

const FINAL = new Set(["CERRADA", "CANCELADA"]);
const ASSIGNABLE_STATUSES = new Set(["PROGRAMADA", "PENDIENTE_REPROGRAMACION", "PENDIENTE_DE_REPROGRAMACION", "DEVUELTA"]);
const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function minutes(order: WorkOrder) {
  return order.effectiveWorkMinutes ?? 0;
}

function hours(value: number) {
  return `${Math.floor(value / 60)} h${value % 60 ? ` ${value % 60} min` : ""}`;
}

function monday(date: Date) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7));
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short" }).format(
    new Date(`${value}T00:00:00`),
  );
}

function assignmentError(error: unknown) {
  if (typeof error === "object" && error && "response" in error) {
    const response = (error as { response?: { data?: { detail?: string; scheduledStartTime?: string[] } } }).response;
    return response?.data?.detail ?? response?.data?.scheduledStartTime?.[0];
  }
  return undefined;
}

export function TechnicianDetailPage() {
  const { id } = useParams();
  const [technician, setTechnician] = useState<Technician>();
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [template, setTemplate] = useState<"REMINDER" | "TRACEABILITY" | "SCHEDULE" | "CUSTOM">("REMINDER");
  const [deliveryChannel, setDeliveryChannel] = useState<"SISTEMA" | "CORREO">("SISTEMA");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [assigningOrderId, setAssigningOrderId] = useState<string>();
  const [assignmentNotice, setAssignmentNotice] = useState("");

  useEffect(() => {
    void Promise.all([listTechnicians(), listWorkOrders()]).then(([people, work]) => {
      setTechnician(people.find((person) => person.id === id));
      setOrders(work);
    });
  }, [id]);

  const assigned = orders.filter((order) => order.operatorId === id);
  const planned = assigned.reduce((sum, order) => sum + order.plannedHours * 60, 0);
  const worked = assigned.reduce((sum, order) => sum + minutes(order), 0);
  const active = assigned.filter((order) => !FINAL.has(order.status));
  const evaluations = assigned.filter((order) => order.satisfaction?.rating);
  const rating = evaluations.length
    ? evaluations.reduce((sum, order) => sum + (order.satisfaction?.rating ?? 0), 0) / evaluations.length
    : 0;
  const pendingOrders = orders
    .filter((order) => ASSIGNABLE_STATUSES.has(order.status) && order.progressPercentage < 100)
    .sort((left, right) => left.scheduledDate.localeCompare(right.scheduledDate))
    .slice(0, 5);
  const week = monday(new Date());
  const dayOrders = DAYS.map((_, index) => {
    const key = new Date(week);
    key.setDate(week.getDate() + index);
    return assigned.filter((order) => order.scheduledDate === key.toISOString().slice(0, 10));
  });

  async function sendManual(event: React.FormEvent) {
    event.preventDefault();
    if (!id) return;
    setSending(true);
    setNotice("");
    try {
      const response = await notifyTechnician(id, { template, deliveryChannel, subject, body });
      setNotice(response.detail);
      setSubject("");
      setBody("");
    } catch {
      setNotice(
        deliveryChannel === "CORREO"
          ? "No se pudo enviar. Verifica que el técnico tenga un correo activo."
          : "No se pudo publicar el aviso en la bandeja del técnico.",
      );
    } finally {
      setSending(false);
    }
  }

  async function assignPendingOrder(order: WorkOrder) {
    if (!id) return;
    setAssigningOrderId(order.id);
    setAssignmentNotice("");
    try {
      const updated = await quickAssignWorkOrder(order.id, id);
      setOrders((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setAssignmentNotice(`${updated.code} quedó asignada a ${technician?.full_name ?? "el técnico"}.`);
    } catch (error) {
      setAssignmentNotice(
        assignmentError(error) ?? "No se pudo asignar la OT. Revisa los cruces de horario e inténtalo otra vez.",
      );
    } finally {
      setAssigningOrderId(undefined);
    }
  }

  if (!technician) return <section className="empty-state"><p>Cargando técnico…</p></section>;

  return (
    <section className="technician-detail-page">
      <Link className="back-link" to="/administracion/tecnicos"><ArrowLeft size={18} />Volver al equipo técnico</Link>
      <header className="technician-detail-heading">
        <div>
          <p className="breadcrumb">Administración / Técnicos / Detalle</p>
          <h1>{technician.full_name}</h1>
          <p>{technician.specialty || "Sin especialidad"} · {technician.worker_code}</p>
        </div>
        <span className="status status-success">Activo</span>
      </header>

      <section className="technician-detail-metrics">
        <article><CalendarBlank size={21} /><span>OT asignadas</span><strong>{assigned.length}</strong><small>{active.length} en curso</small></article>
        <article><Clock size={21} /><span>Horas registradas</span><strong>{hours(worked)}</strong><small>de {hours(planned)} planificadas</small></article>
        <article><Wrench size={21} /><span>OT completadas</span><strong>{assigned.filter((order) => order.status === "CERRADA").length}</strong><small>historial disponible</small></article>
        <article><Star size={21} /><span>Satisfacción</span><strong>{rating ? `${rating.toFixed(1)} / 5` : "—"}</strong><small>{evaluations.length} evaluación(es)</small></article>
      </section>

      <div className="technician-schedule-layout">
        <section className="technician-calendar data-panel">
          <header><div><h2>Cronograma semanal</h2><p>Vista visual de las OT asignadas y su avance.</p></div><span>Horario referencial · 08:00–18:00</span></header>
          <div className="technician-calendar-grid">
            <aside>{["08:00", "10:00", "12:00", "14:00", "16:00", "18:00"].map((time) => <span key={time}>{time}</span>)}</aside>
            <div className="technician-calendar-days">
              {dayOrders.map((items, index) => (
                <section key={DAYS[index]}>
                  <header><span>{DAYS[index]}</span><strong>{new Date(week.getFullYear(), week.getMonth(), week.getDate() + index).getDate()}</strong></header>
                  {items.length
                    ? items.map((order) => <Link key={order.id} to={`/ordenes-trabajo/${order.id}`}><strong>{order.code}</strong><span>{order.assetDisplayCode || order.assetCode || "Sin bien"}</span><small>{order.plannedHours} h · {order.progressPercentage}%</small></Link>)
                    : <p>Sin tareas</p>}
                </section>
              ))}
            </div>
          </div>
        </section>

        <aside className="technician-pending-orders data-panel" aria-live="polite">
          <header>
            <div><h2>OT pendientes</h2><p>Asigna una orden disponible sin salir de la agenda.</p></div>
            <span>{pendingOrders.length}</span>
          </header>
          {assignmentNotice && <p className="technician-assignment-feedback">{assignmentNotice}</p>}
          {pendingOrders.length ? (
            <div className="technician-pending-order-list">
              {pendingOrders.map((order) => (
                <article key={order.id}>
                  <div>
                    <Link to={`/ordenes-trabajo/${order.id}`}>{order.code}</Link>
                    <strong>{order.assetDisplayCode || order.assetCode || "Sin bien asociado"}</strong>
                    <small>{formatDate(order.scheduledDate)} · {order.scheduledStartTime?.slice(0, 5) || "08:00"} · {order.plannedHours} h</small>
                    <small>{getWorkOrderStatusLabel(order)}</small>
                  </div>
                  <button className="button button-primary" type="button" disabled={assigningOrderId === order.id} onClick={() => void assignPendingOrder(order)}>
                    <Plus size={16} />{assigningOrderId === order.id ? "Asignando…" : "Asignar"}
                  </button>
                </article>
              ))}
            </div>
          ) : <p className="technician-pending-empty">No hay OT pendientes compatibles para asignar a este técnico.</p>}
          <Link className="technician-pending-link" to="/ordenes-trabajo">Ver todas las órdenes</Link>
        </aside>
      </div>

      <div className="technician-detail-layout">
        <section className="technician-manual-notice data-panel">
          <header><Bell size={22} /><div><h2>Enviar notificación</h2><p>Envía una plantilla o un aviso personalizado al técnico.</p></div></header>
          <form onSubmit={sendManual}>
            <label className="field"><span>Tipo de aviso</span><select value={template} onChange={(event) => setTemplate(event.target.value as typeof template)}><option value="REMINDER">Recordatorio de jornada</option><option value="TRACEABILITY">Actualizar trazabilidad</option><option value="SCHEDULE">Cambio de programación</option><option value="CUSTOM">Mensaje personalizado</option></select></label>
            <label className="field"><span>Canal de envío</span><select value={deliveryChannel} onChange={(event) => setDeliveryChannel(event.target.value as typeof deliveryChannel)}><option value="SISTEMA">Solo sistema</option><option value="CORREO">Solo correo</option></select><small>{deliveryChannel === "SISTEMA" ? "El aviso aparecerá en la bandeja y como alerta del técnico." : "Se enviará al correo registrado del técnico, sin crear un aviso interno."}</small></label>
            {template === "CUSTOM" && <><label className="field"><span>Asunto</span><input required value={subject} onChange={(event) => setSubject(event.target.value)} /></label><label className="field"><span>Mensaje</span><textarea required rows={4} value={body} onChange={(event) => setBody(event.target.value)} /></label></>}
            {notice && <p className="manual-notice-feedback">{notice}</p>}
            <button className="button button-primary" disabled={sending}><PaperPlaneTilt size={18} />{sending ? "Enviando…" : "Enviar aviso"}</button>
          </form>
        </section>
        <aside className="technician-alert-panel"><header><WarningCircle size={22} /><div><h2>Alertas y seguimiento</h2><p>Exceso de tiempo y trazabilidad pendiente.</p></div></header><p className="technician-alert-empty">Las alertas activas aparecerán aquí y en la bandeja del técnico.</p></aside>
      </div>

      <section className="technician-satisfaction data-panel">
        <header><div><Star size={22} weight="fill" /><div><h2>Satisfacción del servicio</h2><p>Registro privado de las evaluaciones del solicitante.</p></div></div><strong>{rating ? `${rating.toFixed(1)} / 5` : "Sin evaluaciones"}<small>{evaluations.length} respuestas</small></strong></header>
        {evaluations.length ? <div className="satisfaction-records">{evaluations.map((order) => <article key={order.id}><div><Link to={`/ordenes-trabajo/${order.id}`}>{order.code}</Link><span>{order.satisfaction?.accepted ? "Atención confirmada" : "Solicitó revisión"}</span></div><div className="satisfaction-score"><Star size={17} weight="fill" /><strong>{order.satisfaction?.rating}/5</strong></div><p>{order.satisfaction?.comment || "Sin comentario."}</p></article>)}</div> : <div className="technician-satisfaction-empty">Aún no hay evaluaciones registradas.</div>}
      </section>
    </section>
  );
}
