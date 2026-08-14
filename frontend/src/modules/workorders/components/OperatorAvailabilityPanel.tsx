import { CalendarBlank, CheckCircle, Clock, WarningCircle } from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { getWorkOrderStatusLabel } from "@/modules/workorders/workOrderModel";
import type { WorkOrder } from "@/modules/workorders/types";

const OCCUPIED_STATUSES = new Set([
  "PROGRAMADA",
  "ASIGNADA",
  "EN_PROCESO",
  "DEVUELTA",
  "REPROCESO",
]);

const VISIBLE_STATUSES = new Set([
  ...OCCUPIED_STATUSES,
  "PENDIENTE_DE_SUPERVISION",
  "PENDIENTE_DE_VALIDACION",
  "PENDIENTE_DE_CONFORMIDAD",
]);

interface AvailabilityInput {
  orders: WorkOrder[];
  operatorId: string;
  operatorName?: string;
  dates: string[];
  startTime: string;
  plannedHours: number;
  currentOrderId?: string;
}

interface OperatorAvailabilityPanelProps {
  orders: WorkOrder[];
  operatorId: string;
  operatorName?: string;
  selectedDate?: string;
  selectedDates?: string[];
  startTime: string;
  plannedHours: number;
  currentOrderId?: string;
  title?: string;
}

function toMinutes(value?: string) {
  const [hours = "8", minutes = "0"] = (value || "08:00").slice(0, 5).split(":");
  return Number(hours) * 60 + Number(minutes);
}

function formatTime(value?: string) {
  return (value || "08:00").slice(0, 5);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
  }).format(new Date(`${value}T00:00:00`));
}

function formatLongDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", { weekday: "long", day: "numeric", month: "long" })
    .format(new Date(`${value}T00:00:00`));
}

function startOfWeek(dateKey: string) {
  const date = new Date(`${dateKey || new Date().toISOString().slice(0, 10)}T00:00:00`);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function weekDates(anchorDate: string) {
  const start = startOfWeek(anchorDate);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return toDateKey(date);
  });
}

function isOrderOccupied(order: WorkOrder, currentOrderId?: string) {
  return (
    order.id !== currentOrderId &&
    order.orderType !== "OS" &&
    !order.code.startsWith("OS-") &&
    OCCUPIED_STATUSES.has(order.status)
  );
}
function isOrderVisibleInAvailability(order: WorkOrder, currentOrderId?: string) {
  return (
    order.id !== currentOrderId &&
    order.orderType !== "OS" &&
    !order.code.startsWith("OS-") &&
    VISIBLE_STATUSES.has(order.status)
  );
}

function normalize(value?: string) {
  return (value || "").trim().toLowerCase();
}

function belongsToOperator(order: WorkOrder, operatorId: string, operatorName?: string) {
  return order.operatorId === operatorId || (!!operatorName && normalize(order.operatorName) === normalize(operatorName));
}

function overlaps(order: WorkOrder, startTime: string, plannedHours: number) {
  const start = toMinutes(startTime);
  const end = start + Math.max(1, plannedHours || 1) * 60;
  const orderStart = toMinutes(order.scheduledStartTime);
  const orderEnd = orderStart + Math.max(1, order.plannedHours || 1) * 60;
  return start < orderEnd && orderStart < end;
}

export function findScheduleConflicts(input: AvailabilityInput) {
  if (!input.operatorId || !input.dates.length) return [];
  const dateSet = new Set(input.dates);
  return input.orders.filter(
    (order) =>
      belongsToOperator(order, input.operatorId, input.operatorName) &&
      dateSet.has(order.scheduledDate) &&
      isOrderOccupied(order, input.currentOrderId) &&
      overlaps(order, input.startTime, input.plannedHours),
  );
}

export function OperatorAvailabilityPanel({
  orders,
  operatorId,
  operatorName,
  selectedDate,
  selectedDates,
  startTime,
  plannedHours,
  currentOrderId,
  title = "Disponibilidad del operario",
}: OperatorAvailabilityPanelProps) {
  const [open, setOpen] = useState(true);
  const dates = selectedDates?.length ? selectedDates : selectedDate ? [selectedDate] : [];
  const anchorDate = dates[0] || new Date().toISOString().slice(0, 10);
  const calendarDates = weekDates(anchorDate);
  const conflicts = findScheduleConflicts({
    orders,
    operatorId,
    operatorName,
    dates,
    startTime,
    plannedHours,
    currentOrderId,
  });

  const occupiedByDate = useMemo(() => {
    const grouped = new Map<string, WorkOrder[]>();
    orders
      .filter((order) => belongsToOperator(order, operatorId, operatorName) && isOrderVisibleInAvailability(order, currentOrderId))
      .forEach((order) => {
        grouped.set(order.scheduledDate, [...(grouped.get(order.scheduledDate) ?? []), order]);
      });
    grouped.forEach((items, key) => {
      grouped.set(key, [...items].sort((left, right) => toMinutes(left.scheduledStartTime) - toMinutes(right.scheduledStartTime)));
    });
    return grouped;
  }, [currentOrderId, operatorId, operatorName, orders]);

  const weekOrders = calendarDates.flatMap((date) => occupiedByDate.get(date) ?? []);
  const weekHours = weekOrders.reduce((total, order) => total + Math.max(1, order.plannedHours || 1), 0);

  if (!operatorId) {
    return (
      <article className="operator-availability-card is-muted">
        <div>
          <CalendarBlank size={22} />
          <span>Elige un operario para revisar su disponibilidad.</span>
        </div>
      </article>
    );
  }

  return (
    <article className={`operator-availability-card ${conflicts.length ? "has-conflict" : "has-availability"}`}>
      <header>
        <div>
          <CalendarBlank size={22} />
          <span>{title}</span>
          <strong>{operatorName || "Operario seleccionado"}</strong>
        </div>
        <div className={`operator-availability-status ${conflicts.length ? "is-conflict" : "is-available"}`}>
          {conflicts.length ? <WarningCircle size={16} /> : <CheckCircle size={16} />}
          {conflicts.length ? "Cruce de horario" : "Disponible"}
        </div>
        <button className="button button-secondary operator-availability-toggle" type="button" onClick={() => setOpen((current) => !current)}>
          {open ? "Ocultar agenda" : "Ver agenda"}
        </button>
      </header>

      <div className="operator-availability-summary">
        <div><span>Fecha elegida</span><strong>{dates[0] ? formatLongDate(dates[0]) : "Selecciona una fecha"}</strong></div>
        <div><span>Horario de esta OT</span><strong>{formatTime(startTime)} · {Math.max(1, plannedHours || 1)} h</strong></div>
        <div><span>Carga semanal</span><strong>{weekHours} h · {weekOrders.length} OT{weekOrders.length === 1 ? "" : "s"}</strong></div>
      </div>

      {conflicts.length ? (
        <div className="operator-availability-warning">
          <WarningCircle size={20} />
          <span>Ese horario se cruza con {conflicts.length} orden programada. Elige otra hora o fecha.</span>
        </div>
      ) : (
        <p>El horario elegido no se cruza con órdenes programadas del operario.</p>
      )}

      {open && (
        <div className="operator-availability-calendar">
          {calendarDates.map((date) => {
            const dayOrders = occupiedByDate.get(date) ?? [];
            const selected = dates.includes(date);
            return (
              <section className={selected ? "is-selected" : ""} key={date}>
                <header>
                  <strong>{formatDate(date)}</strong>
                  <span>{dayOrders.length ? `${dayOrders.length} registrada${dayOrders.length === 1 ? "" : "s"}` : "Libre"}</span>
                </header>
                <div>
                  {dayOrders.length ? dayOrders.map((order) => (
                    <Link className={conflicts.some((item) => item.id === order.id) ? "is-conflict" : ""} key={order.id} to={`/ordenes-trabajo/${order.id}`}>
                      <strong>{order.code}</strong>
                      <span><Clock size={13} />{formatTime(order.scheduledStartTime)} · {order.plannedHours || 1} h</span>
                      <small>{getWorkOrderStatusLabel(order)}</small>
                    </Link>
                  )) : <p>Sin órdenes programadas.</p>}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </article>
  );
}
