import {
  ArrowClockwise,
  SealCheck,
  WarningCircle,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/modules/accounts/AuthContext";
import {
  adminPriorityLabels,
  getWorkOrderStatusLabel,
  specialtyLabels,
  type WorkOrderStatus,
} from "@/modules/workorders/workOrderModel";
import {
  getWorkOrderAssetDisplayCode,
  listWorkOrders,
  WORK_ORDERS_UPDATED_EVENT,
} from "@/modules/workorders/workOrderRepository";

type ReviewTab = "pending" | "reviewed";

const statusClass: Record<WorkOrderStatus, string> = {
  PROGRAMADA: "status-neutral",
  PENDIENTE_REPROGRAMACION: "status-error",
  ASIGNADA: "status-warning",
  EN_PROCESO: "status-warning",
  PENDIENTE_DE_SUPERVISION: "status-neutral",
  PENDIENTE_DE_VALIDACION: "status-warning",
  PENDIENTE_DE_CONFORMIDAD: "status-warning",
  DEVUELTA: "status-error",
  REPROCESO: "status-error",
  APROBADA_POR_SUPERVISOR: "status-success",
  CERRADA: "status-success",
  CANCELADA: "status-error",
};

function formatEffectiveDuration(totalMinutes?: number) {
  if (totalMinutes === undefined || totalMinutes === null) return "Sin registro";
  if (totalMinutes <= 0) return "0 min";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

function samePersonName(a?: string | null, b?: string | null) {
  return Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());
}

export function SupervisorWorkOrderReviewPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof listWorkOrders>>>([]);
  const [activeTab, setActiveTab] = useState<ReviewTab>("pending");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    async function refresh() {
      setLoading(true);
      setLoadError("");
      try {
        const nextOrders = await listWorkOrders();
        if (!active) return;
        setOrders(nextOrders);
      } catch {
        if (active) setLoadError("No se pudo cargar la bandeja de supervisión. Comprueba tu conexión e inténtalo de nuevo.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void refresh();
    window.addEventListener(WORK_ORDERS_UPDATED_EVENT, refresh);
    return () => {
      active = false;
      window.removeEventListener(WORK_ORDERS_UPDATED_EVENT, refresh);
    };
  }, []);

  const assignedOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.orderType !== "OS" &&
          (!user?.id ||
            order.supervisorId === user.id ||
            samePersonName(order.supervisorName, user.fullName)),
      ),
    [orders, user?.fullName, user?.id],
  );
  const pendingOrders = useMemo(
    () => assignedOrders.filter((order) => order.status === "PENDIENTE_DE_SUPERVISION"),
    [assignedOrders],
  );
  const reviewedOrders = useMemo(
    () =>
      assignedOrders.filter((order) =>
        typeof order.supervisor_validation?.approved === "boolean"
      ),
    [assignedOrders],
  );
  const visibleOrders = activeTab === "pending" ? pendingOrders : reviewedOrders;
  const returnedOrders = assignedOrders.filter((order) => order.supervisor_validation?.approved === false).length;
  const approvedOrders = assignedOrders.filter((order) => order.supervisor_validation?.approved === true).length;

  function changeTab(tab: ReviewTab) {
    setActiveTab(tab);
  }

  function openWorkOrder(orderId: string) {
    navigate(`/ordenes-trabajo/${orderId}`);
  }

  function handleRowKeyDown(event: KeyboardEvent<HTMLTableRowElement>, orderId: string) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openWorkOrder(orderId);
  }

  return (
    <section className="supervisor-review-page">
      <div className="page-heading">
        <div className="supervisor-heading-copy">
          <p className="breadcrumb">Supervisión / Órdenes de trabajo</p>
          <h1>Revisión del supervisor</h1>
          <p>Revisa solo tus órdenes pendientes y las que ya validaste.</p>
        </div>
      </div>

      <div className="supervisor-review-toolbar">
        <span>Actualiza la bandeja para ver las últimas órdenes terminadas.</span>
        <button className="button button-secondary button-sm" type="button" onClick={() => { setLoading(true); void listWorkOrders().then(setOrders).catch(() => setLoadError("No se pudo actualizar la bandeja." )).finally(() => setLoading(false)); }} disabled={loading}>
          <ArrowClockwise size={16} className={loading ? "is-spinning" : ""} /> Actualizar
        </button>
      </div>

      {loadError && <div className="dashboard-partial-error" role="alert"><WarningCircle size={20} /><span>{loadError}</span></div>}

      <div className="metrics-grid">
        <article>
          <span>Pendientes</span>
          <strong>{pendingOrders.length}</strong>
          <small>Listas para tu revisión</small>
        </article>
        <article>
          <span>Aprobadas</span>
          <strong>{approvedOrders}</strong>
          <small>Enviadas al administrador como conformes</small>
        </article>
        <article className="metric-error">
          <span>Observadas</span>
          <strong>{returnedOrders}</strong>
          <small>Enviadas al administrador con comentario</small>
        </article>
        <article>
          <span>Total asignadas</span>
          <strong>{assignedOrders.length}</strong>
          <small>Órdenes vinculadas a tu usuario</small>
        </article>
      </div>

      {loading && !orders.length ? <div className="data-panel supervisor-loading-state"><div className="skeleton skeleton-block" /><span>Cargando órdenes de supervisión…</span></div> : <div className="supervisor-review-workspace">
        <article className="data-panel detail-card supervisor-review-table">
          <div className="detail-card-heading supervisor-review-heading">
            <div>
              <SealCheck size={22} />
              <div>
                <h2>Cola de supervisión</h2>
                <p>Selecciona una OT u OL para abrir su ficha completa, revisar evidencias y registrar tu decisión.</p>
              </div>
            </div>
            <div className="supervisor-tabs" role="tablist" aria-label="Filtro de supervisión">
              <button
                className={activeTab === "pending" ? "is-active" : ""}
                type="button"
                onClick={() => changeTab("pending")}
              >
                Pendientes <span>{pendingOrders.length}</span>
              </button>
              <button
                className={activeTab === "reviewed" ? "is-active" : ""}
                type="button"
                onClick={() => changeTab("reviewed")}
              >
                Revisadas <span>{reviewedOrders.length}</span>
              </button>
            </div>
          </div>

          <div className="table-scroll">
            <table>
            <thead>
              <tr>
                <th>Orden</th>
                <th>Solicitud</th>
                <th>Operario</th>
                <th>Especialidad</th>
                <th>Prioridad</th>
                <th>Tiempo</th>
                <th>Estado</th>
                <th><span className="sr-only">Accion</span></th>
              </tr>
            </thead>
            <tbody>
              {visibleOrders.map((order) => (
                <tr
                  aria-label={`Abrir detalle de ${order.code}`}
                  key={order.id}
                  onClick={() => openWorkOrder(order.id)}
                  onKeyDown={(event) => handleRowKeyDown(event, order.id)}
                  tabIndex={0}
                >
                  <td>
                    <strong>{order.code}</strong>
                  </td>
                  <td>
                    {order.requestCode}
                    {getWorkOrderAssetDisplayCode(order) && (
                      <><br /><small>Bien: {getWorkOrderAssetDisplayCode(order)}</small></>
                    )}
                  </td>
                  <td>{order.operatorName}</td>
                  <td>{specialtyLabels[order.specialty]}</td>
                  <td>{adminPriorityLabels[order.adminPriority]}</td>
                  <td>{formatEffectiveDuration(order.effectiveWorkMinutes)}</td>
                  <td>
                    <span className={`status ${statusClass[order.status]}`}>
                      {getWorkOrderStatusLabel(order)}
                    </span>
                  </td>
                  <td>
                    <button
                      className="table-action"
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        openWorkOrder(order.id);
                      }}
                    >
                      Abrir orden
                    </button>
                  </td>
                </tr>
              ))}

              {!visibleOrders.length && (
                <tr>
                  <td colSpan={8} className="empty-row">
                    {activeTab === "pending"
                      ? "No hay órdenes listas para revisar. Cuando el técnico termine una OT u OL, aparecerá aquí."
                      : "Aún no hay revisiones registradas. Tus aprobaciones y devoluciones aparecerán aquí."}
                  </td>
                </tr>
              )}
              </tbody>
            </table>
          </div>

          <div className="supervisor-order-cards" aria-label="Órdenes de supervisión">
            {visibleOrders.map((order) => (
              <button
                key={order.id}
                type="button"
                onClick={() => openWorkOrder(order.id)}
              >
                <span className="supervisor-card-topline">
                  <strong>{order.code}</strong>
                  <span className={`status ${statusClass[order.status]}`}>{getWorkOrderStatusLabel(order)}</span>
                </span>
                <span>{getWorkOrderAssetDisplayCode(order) || order.requestCode}</span>
                <small>{order.operatorName} · {formatEffectiveDuration(order.effectiveWorkMinutes)}</small>
              </button>
            ))}
            {!visibleOrders.length && <div className="supervisor-empty-state"><SealCheck size={24} /><strong>{activeTab === "pending" ? "Bandeja despejada" : "Sin revisiones registradas"}</strong><span>{activeTab === "pending" ? "Cuando el técnico termine una OT u OL, aparecerá aquí para tu revisión." : "Tus aprobaciones y devoluciones quedarán disponibles aquí."}</span></div>}
          </div>
        </article>
      </div>}
    </section>
  );
}
