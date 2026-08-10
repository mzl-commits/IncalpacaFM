import {
  ArrowSquareOut,
  ArrowClockwise,
  Camera,
  CheckCircle,
  NotePencil,
  SealCheck,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

import {
  adminPriorityLabels,
  getWorkOrderStatusLabel,
  specialtyLabels,
  type WorkOrderStatus,
} from "@/modules/workorders/workOrderModel";
import {
  getWorkOrderAssetDisplayCode,
  listWorkOrders,
  superviseWorkOrder,
  WORK_ORDERS_UPDATED_EVENT,
} from "@/modules/workorders/workOrderRepository";
import type { WorkOrder } from "@/modules/workorders/types";
import { api } from "@/services/api";

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

function formatDateTime(value?: string) {
  if (!value) return "No registrado";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDuration(start?: string, end?: string) {
  if (!start) return "Aún no inicia";
  if (!end) return "En curso";

  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return "No disponible";

  const totalMinutes = Math.round(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

function getReviewComment(order?: WorkOrder) {
  const value = order?.supervisor_validation?.comment;
  return typeof value === "string" && value.trim() ? value : "Sin comentario registrado";
}

function WorkOrderPhoto({ url, label }: { url?: string | null; label: string }) {
  const [source, setSource] = useState<string>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl = "";
    if (!url) {
      setSource(undefined);
      return;
    }
    const path = url.startsWith("/api/v1") ? url.slice("/api/v1".length) : url;
    void api.get<Blob>(path, { responseType: "blob" }).then(({ data }) => {
      objectUrl = URL.createObjectURL(data);
      setSource(objectUrl);
    }).catch(() => setFailed(true));
    return () => { if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [url]);

  return <figure className="supervisor-photo-card">
    <figcaption>{label}</figcaption>
    {source && !failed ? <img src={source} alt={`${label} de la orden`} /> : <div className="supervisor-photo-empty"><WarningCircle size={22} /><span>{url ? "No se pudo cargar la evidencia" : "No registrada"}</span></div>}
  </figure>;
}

export function SupervisorWorkOrderReviewPage() {
  const [searchParams] = useSearchParams();
  const requestedOrderId = searchParams.get("workOrder");
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [comment, setComment] = useState("");
  const [activeTab, setActiveTab] = useState<ReviewTab>("pending");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    async function refresh() {
      setLoading(true);
      setLoadError("");
      try {
        const nextOrders = await listWorkOrders();
        if (!active) return;
        setOrders(nextOrders);
        const requestedOrder = requestedOrderId
          ? nextOrders.find((order) => order.id === requestedOrderId)
          : undefined;
        if (requestedOrder) {
          setSelectedId(requestedOrder.id);
          setActiveTab(requestedOrder.status === "PENDIENTE_DE_SUPERVISION" ? "pending" : "reviewed");
        } else {
          setSelectedId((current) => current || nextOrders[0]?.id || "");
        }
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
  }, [requestedOrderId]);

  const pendingOrders = useMemo(
    () => orders.filter((order) => order.status === "PENDIENTE_DE_SUPERVISION"),
    [orders],
  );
  const reviewedOrders = useMemo(
    () =>
      orders.filter((order) =>
        typeof order.supervisor_validation?.approved === "boolean"
      ),
    [orders],
  );
  const visibleOrders = activeTab === "pending" ? pendingOrders : reviewedOrders;
  const selectedOrder = visibleOrders.find((order) => order.id === selectedId) ?? visibleOrders[0];
  const selectedCanReview = selectedOrder?.status === "PENDIENTE_DE_SUPERVISION";
  const returnedOrders = orders.filter((order) => order.status === "DEVUELTA").length;
  const approvedOrders = orders.filter(
    (order) => order.status === "PENDIENTE_DE_VALIDACION" || order.status === "CERRADA",
  ).length;

  function changeTab(tab: ReviewTab) {
    const nextOrders = tab === "pending" ? pendingOrders : reviewedOrders;
    setActiveTab(tab);
    setSelectedId(nextOrders[0]?.id || "");
    setComment("");
    setError("");
  }

  async function handleReview(approved: boolean) {
    if (!selectedOrder || !selectedCanReview) return;

    if (!approved && comment.trim().length < 10) {
      setError("Escribe el motivo de devolución antes de devolver la orden.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const updated = await superviseWorkOrder(selectedOrder.id, approved, comment.trim());
      setOrders((current) => current.map((order) => (order.id === updated.id ? updated : order)));
      const nextPending = pendingOrders.find((order) => order.id !== selectedOrder.id);
      setSelectedId(nextPending?.id || updated.id);
      setActiveTab(nextPending ? "pending" : "reviewed");
      setComment("");
    } catch {
      setError("No se pudo registrar la revisión. Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
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
          <small>En validación administrativa o cerradas</small>
        </article>
        <article className="metric-error">
          <span>Devueltas</span>
          <strong>{returnedOrders}</strong>
          <small>Requieren corrección del operario</small>
        </article>
        <article>
          <span>Total asignadas</span>
          <strong>{orders.length}</strong>
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
                <p>Selecciona una OT para revisar evidencias y registrar tu decisión.</p>
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
                <tr className={selectedOrder?.id === order.id ? "is-selected" : ""} key={order.id}>
                  <td>
                    <Link to={`/ordenes-trabajo/${order.id}`}><strong>{order.code}</strong></Link>
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
                  <td>{formatDuration(order.startedAt, order.finishedAt)}</td>
                  <td>
                    <span className={`status ${statusClass[order.status]}`}>
                      {getWorkOrderStatusLabel(order)}
                    </span>
                  </td>
                  <td>
                    <button
                      className="table-action"
                      type="button"
                      onClick={() => {
                        setSelectedId(order.id);
                        setComment("");
                        setError("");
                      }}
                    >
                      Ver
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
                className={selectedOrder?.id === order.id ? "is-selected" : ""}
                key={order.id}
                type="button"
                onClick={() => {
                  setSelectedId(order.id);
                  setComment("");
                  setError("");
                }}
              >
                <span className="supervisor-card-topline">
                  <strong>{order.code}</strong>
                  <span className={`status ${statusClass[order.status]}`}>{getWorkOrderStatusLabel(order)}</span>
                </span>
                <span>{getWorkOrderAssetDisplayCode(order) || order.requestCode}</span>
                <small>{order.operatorName} · {formatDuration(order.startedAt, order.finishedAt)}</small>
              </button>
            ))}
            {!visibleOrders.length && <div className="supervisor-empty-state"><SealCheck size={24} /><strong>{activeTab === "pending" ? "Bandeja despejada" : "Sin revisiones registradas"}</strong><span>{activeTab === "pending" ? "Cuando el técnico termine una OT u OL, aparecerá aquí para tu revisión." : "Tus aprobaciones y devoluciones quedarán disponibles aquí."}</span></div>}
          </div>
        </article>

        <article className="data-panel detail-card supervisor-review-detail">
        <div className="detail-card-heading">
          <NotePencil size={22} />
          <h2>Detalle de la orden</h2>
        </div>

        {selectedOrder ? (
          <>
            <dl className="detail-list supervisor-detail-list">
              <div>
                <dt>Orden</dt>
                <dd>{selectedOrder.code}</dd>
              </div>
              <div>
                <dt>Solicitud</dt>
                <dd>{selectedOrder.requestCode}</dd>
              </div>
              <div>
                <dt>Bien asociado</dt>
                <dd>{getWorkOrderAssetDisplayCode(selectedOrder) || "No asociado"}</dd>
              </div>
              <div>
                <dt>Operario</dt>
                <dd>{selectedOrder.operatorName}</dd>
              </div>
              <div>
                <dt>Inicio</dt>
                <dd>{formatDateTime(selectedOrder.startedAt)}</dd>
              </div>
              <div>
                <dt>Fin</dt>
                <dd>{formatDateTime(selectedOrder.finishedAt)}</dd>
              </div>
              <div>
                <dt>Tiempo empleado</dt>
                <dd>{formatDuration(selectedOrder.startedAt, selectedOrder.finishedAt)}</dd>
              </div>
              <div>
                <dt>Comentario registrado</dt>
                <dd>{getReviewComment(selectedOrder)}</dd>
              </div>
            </dl>

            <section className="supervisor-photo-evidence" aria-labelledby="supervisor-photo-title">
              <div className="detail-card-heading"><Camera size={22} /><div><h2 id="supervisor-photo-title">Evidencia fotográfica</h2><p>Compara el estado del bien antes y después de la atención.</p></div></div>
              <div className="supervisor-photo-grid">
                <WorkOrderPhoto url={selectedOrder.startPhoto} label="Antes de la atención" />
                <WorkOrderPhoto url={selectedOrder.finishPhoto} label="Después de la atención" />
              </div>
            </section>

            {selectedCanReview ? (
              <form className="rejection-form" onSubmit={(event) => { event.preventDefault(); void handleReview(true); }}>
                <label className="field field-wide">
                  <span>Comentario de supervisión</span>
                  <textarea
                    rows={4}
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder="Observaciones del supervisor, conformidad o motivo de devolución."
                  />
                </label>

                {error && <div className="form-error">{error}</div>}

                <div className="admin-evaluation-actions">
                  <Link className="button button-secondary" to={`/ordenes-trabajo/${selectedOrder.id}`}>
                    <ArrowSquareOut size={18} />
                    Ver OT completa
                  </Link>
                  <button
                    className="button button-danger"
                    type="button"
                    disabled={saving}
                    onClick={() => void handleReview(false)}
                  >
                    <XCircle size={18} />
                    Devolver
                  </button>
                  <button className="button button-primary" disabled={saving}>
                    <CheckCircle size={18} />
                    Aprobar
                  </button>
                </div>
              </form>
            ) : (
              <div className="admin-evaluation-actions supervisor-readonly-actions">
                <Link className="button button-secondary" to={`/ordenes-trabajo/${selectedOrder.id}`}>
                  <ArrowSquareOut size={18} />
                  Ver OT completa
                </Link>
              </div>
            )}
          </>
        ) : (
          <div className="evidence-empty-note">
            <WarningCircle size={22} />
            <span>Sin orden seleccionada</span>
            <p>Selecciona una orden de la lista para revisar tiempos, evidencias y comentarios.</p>
          </div>
        )}
        </article>
      </div>}
    </section>
  );
}
