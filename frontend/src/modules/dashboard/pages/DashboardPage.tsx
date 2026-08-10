import {
  Archive,
  ArrowClockwise,
  ArrowRight,
  CheckCircle,
  ClipboardText,
  Clock,
  Package,
  Plus,
  Play,
  QrCode,
  Warning,
  WarningCircle,
  Wrench,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { listRegisteredAssets } from "@/modules/assets/assetEntryRepository";
import {
  getAssetDisplayCode,
  type RegisteredAsset,
} from "@/modules/assets/entryModel";
import {
  getAssignmentAssetDisplayCode,
  listAssignments,
  type AssignmentRecord,
} from "@/modules/assignments/assignmentRepository";
import { listRetirementRequests } from "@/modules/lifecycle/lifecycleRepository";
import { useAuth } from "@/modules/accounts/AuthContext";
import { getWorkOrderAssetDisplayCode, listWorkOrders } from "@/modules/workorders/workOrderRepository";
import { getWorkOrderStatusLabel } from "@/modules/workorders/workOrderModel";
import UserDashboardPage from "@/modules/accounts/pages/UserDashboardPage";
import { SupervisorWorkOrderReviewPage } from "@/modules/workorders/pages/SupervisorWorkOrderReviewPage";
import {
  retirementStatusLabels,
  type RetirementRequest,
} from "@/modules/lifecycle/types";

type DashboardData = {
  assets: RegisteredAsset[];
  assignments: AssignmentRecord[];
  retirementRequests: RetirementRequest[];
};

type ActivityItem = {
  id: string;
  date: string;
  title: string;
  detail: string;
  to: string;
  type: "asset" | "assignment" | "retirement";
};

const emptyData: DashboardData = {
  assets: [],
  assignments: [],
  retirementRequests: [],
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

function mondayKey() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}

function formatHours(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

function orderWorkedMinutes(order: Awaited<ReturnType<typeof listWorkOrders>>[number], weekStart: string) {
  const sessions = order.workSessions ?? [];
  if (!sessions.length) return 0;
  return sessions.reduce((total, session) => {
    if (session.startAt.slice(0, 10) < weekStart) return total;
    const started = new Date(session.startAt).getTime();
    const ended = session.endAt ? new Date(session.endAt).getTime() : Date.now();
    return total + Math.max(0, Math.round((ended - started) / 60000));
  }, 0);
}

function TechnicianDashboard() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof listWorkOrders>>>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().slice(0, 10);
  const weekStart = mondayKey();

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setOrders(await listWorkOrders());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const activeOrder = orders.find((order) => order.status === "EN_PROCESO" && order.activeWorkSession);
  const actionableOrders = orders
    .filter((order) =>
      ["PROGRAMADA", "EN_PROCESO", "REPROCESO"].includes(order.status) ||
      (order.status === "DEVUELTA" && order.scheduledDate <= today),
    )
    .sort((left, right) => left.scheduledDate.localeCompare(right.scheduledDate));
  const nextOrder = activeOrder ?? actionableOrders.find((order) => order.scheduledDate >= today) ?? actionableOrders[0];
  const todayOrders = orders.filter((order) => order.scheduledDate === today);
  const weekMinutes = orders.reduce((total, order) => total + orderWorkedMinutes(order, weekStart), 0);
  const weekPlanned = orders
    .filter((order) => order.scheduledDate >= weekStart)
    .reduce((total, order) => total + (order.plannedHours || 2) * 60, 0);
  const weekCoverage = weekPlanned ? Math.min(100, Math.round((weekMinutes / weekPlanned) * 100)) : 0;

  return (
    <section className="technician-dashboard">
      <header className="technician-dashboard-heading">
        <div><p className="breadcrumb">Inicio / Mi trabajo</p><h1>{getGreeting()}, {user?.fullName.split(" ")[0] || "técnico"}</h1><p>Empieza por la orden prioritaria y mantén el temporizador activo mientras trabajas.</p></div>
        <button className="button button-secondary" type="button" onClick={() => void refresh()} disabled={loading}><ArrowClockwise size={18} className={loading ? "is-spinning" : ""} />Actualizar</button>
      </header>

      {loading ? (
        <>
          <section className="technician-dashboard-focus data-panel" aria-label="Cargando estado">
            <div className="skeleton skeleton-block" style={{ height: "180px", borderRadius: "12px", border: "none" }} />
          </section>
          <section className="technician-dashboard-hours data-panel" aria-label="Cargando horas">
            <div className="skeleton skeleton-block" style={{ height: "160px", borderRadius: "12px", border: "none" }} />
          </section>
          <section className="technician-dashboard-orders data-panel" aria-label="Cargando órdenes">
            <div className="skeleton skeleton-block" style={{ height: "300px", borderRadius: "12px", border: "none" }} />
          </section>
        </>
      ) : <>
        <section className="technician-dashboard-focus" aria-labelledby="next-task-title">
          <div className="technician-dashboard-focus-copy">
            <span>{activeOrder ? "Sesión en curso" : "Siguiente acción"}</span>
            <h2 id="next-task-title">{nextOrder ? `${nextOrder.code} · ${getWorkOrderAssetDisplayCode(nextOrder) || nextOrder.requestCode}` : "No tienes órdenes pendientes"}</h2>
            <p>{nextOrder ? `${getWorkOrderStatusLabel(nextOrder)} · programada para ${formatDate(nextOrder.scheduledDate)}` : "Tu agenda está al día. Revisa tu jornada para consultar los registros de esta semana."}</p>
            {nextOrder && <Link className="button button-primary" to={`/ordenes-trabajo/${nextOrder.id}${["PROGRAMADA", "EN_PROCESO", "DEVUELTA", "REPROCESO"].includes(nextOrder.status) ? "/ejecutar" : ""}`}><Play size={18} weight="fill" />{activeOrder ? "Volver al temporizador" : "Abrir orden"}</Link>}
          </div>
          <dl><div><dt>Para hoy</dt><dd>{todayOrders.length}</dd><small>Órdenes programadas</small></div><div><dt>En atención</dt><dd>{activeOrder ? "1" : "0"}</dd><small>Sesiones activas</small></div></dl>
        </section>

        <section className="technician-dashboard-hours" aria-labelledby="technician-hours-title">
          <header><div><h2 id="technician-hours-title">Horas de la semana</h2><p>El temporizador de tus órdenes actualiza este resumen automáticamente.</p></div><Clock size={24} /></header>
          <div className="technician-dashboard-hours-number"><strong>{formatHours(weekMinutes)}</strong><span>registradas de {formatHours(weekPlanned)} programadas</span></div>
          <div className="technician-dashboard-hours-track" aria-label={`${weekCoverage}% de horas registradas`}><span style={{ width: `${weekCoverage}%` }} /></div>
          <footer><strong>{weekCoverage}% cubierto</strong><Link to="/mi-jornada">Ver detalle semanal <ArrowRight size={15} /></Link></footer>
        </section>

        <section className="technician-dashboard-orders" aria-labelledby="technician-orders-title">
          <header><div><h2 id="technician-orders-title">Órdenes que requieren atención</h2><p>{actionableOrders.length ? "Abre una orden para iniciar, reanudar o registrar un avance." : "No tienes tareas operativas pendientes."}</p></div><Link to="/ordenes-trabajo">Todas <ArrowRight size={16} /></Link></header>
          {actionableOrders.length ? <div>{actionableOrders.slice(0, 4).map((order) => <Link key={order.id} to={`/ordenes-trabajo/${order.id}${["PROGRAMADA", "EN_PROCESO", "DEVUELTA", "REPROCESO"].includes(order.status) ? "/ejecutar" : ""}`}><span className="technician-dashboard-order-icon"><Wrench size={19} /></span><span><strong>{order.code}</strong><small>{getWorkOrderAssetDisplayCode(order) || order.requestCode} · {getWorkOrderStatusLabel(order)}</small></span><time>{order.scheduledDate === today ? "Hoy" : formatDate(order.scheduledDate)}</time><ArrowRight size={18} /></Link>)}</div> : <div className="technician-dashboard-empty"><CheckCircle size={30} weight="fill" /><span><strong>Sin órdenes pendientes</strong><small>Cuando recibas una nueva asignación, aparecerá aquí.</small></span></div>}
        </section>
      </>}
    </section>
  );
}

function AdministrativeDashboard() {
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date>();

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");

    const [assetsResult, assignmentsResult, retirementResult] =
      await Promise.allSettled([
        listRegisteredAssets(),
        listAssignments(),
        listRetirementRequests(),
      ]);

    const nextData: DashboardData = {
      assets:
        assetsResult.status === "fulfilled"
          ? assetsResult.value
          : [],
      assignments:
        assignmentsResult.status === "fulfilled"
          ? assignmentsResult.value
          : [],
      retirementRequests:
        retirementResult.status === "fulfilled"
          ? retirementResult.value
          : [],
    };

    const failedSources = [
      assetsResult.status === "rejected" && "bienes",
      assignmentsResult.status === "rejected" && "asignaciones",
      retirementResult.status === "rejected" && "ciclo de vida",
    ].filter(Boolean);

    setData(nextData);
    setLastUpdated(new Date());
    setLoading(false);

    if (failedSources.length) {
      setError(
        `No se pudo actualizar: ${failedSources.join(", ")}. Los demás datos siguen disponibles.`,
      );
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const summary = useMemo(() => {
    const activeAssignmentRecords = data.assignments.filter(
      (assignment) => assignment.status === "ACTIVA",
    );
    const assignedAssetIds = new Set(
      activeAssignmentRecords.map((assignment) => assignment.asset.id),
    );
    const assignedAssets = data.assets.filter((asset) =>
      assignedAssetIds.has(asset.id),
    ).length;
    const unassignedAssets = Math.max(
      data.assets.length - assignedAssets,
      0,
    );
    const activeAssignments = activeAssignmentRecords.length;
    const pendingReview = data.retirementRequests.filter((request) =>
      ["PENDIENTE", "EN_EVALUACION", "SUBSANACION"].includes(
        request.status,
      ),
    ).length;
    const pendingDisposal = data.retirementRequests.filter(
      (request) => request.status === "PENDIENTE_DISPOSICION",
    ).length;
    const assignmentCoverage = data.assets.length
      ? Math.round((assignedAssets / data.assets.length) * 100)
      : 0;

    return {
      assignedAssets,
      unassignedAssets,
      activeAssignments,
      pendingReview,
      pendingDisposal,
      assignmentCoverage,
    };
  }, [data]);

  const activities = useMemo<ActivityItem[]>(() => {
    const assetActivity: ActivityItem[] = data.assets.map((asset) => ({
      id: `asset-${asset.id}`,
      date: asset.createdAt,
      title: "Bien registrado",
      detail: `${getAssetDisplayCode(asset)} · ${asset.draft.name}`,
      to: `/bienes/${asset.id}`,
      type: "asset",
    }));

    const assignmentActivity: ActivityItem[] = data.assignments.map(
      (assignment) => ({
        id: `assignment-${assignment.id}`,
        date: assignment.start_date,
        title:
          assignment.status === "ACTIVA"
            ? "Asignación vigente"
            : "Asignación actualizada",
        detail: `${getAssignmentAssetDisplayCode(assignment.asset)} · ${assignment.responsible.name}`,
        to: `/asignaciones/${assignment.id}`,
        type: "assignment",
      }),
    );

    const retirementActivity: ActivityItem[] =
      data.retirementRequests.map((request) => ({
        id: `retirement-${request.id}`,
        date: request.updatedAt,
        title: `Baja: ${retirementStatusLabels[request.status]}`,
        detail: `${request.code} · ${request.assetName}`,
        to: `/bienes/ciclo-vida/bajas/${request.id}`,
        type: "retirement",
      }));

    return [
      ...assetActivity,
      ...assignmentActivity,
      ...retirementActivity,
    ]
      .sort(
        (left, right) =>
          new Date(right.date).getTime() -
          new Date(left.date).getTime(),
      )
      .slice(0, 6);
  }, [data]);

  const totalPendientes = summary.pendingDisposal + summary.pendingReview + summary.unassignedAssets;

  return (
    <div className="dashboard-page">
      {/* ENCABEZADO RESUMEN OPERATIVO */}
      <header className="dashboard-header-row">
        <div>
          <h1 className="dashboard-title">Resumen operativo</h1>
          <p className="dashboard-description">
            Estado actual de bienes, asignaciones y solicitudes.
          </p>
        </div>

        <div className="dashboard-header-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void loadDashboard()}
            disabled={loading}
            title="Actualizar datos"
          >
            <ArrowClockwise
              size={18}
              className={loading ? "is-spinning" : ""}
            />
            <span>Actualizar</span>
          </button>
          <Link
            className="btn-primary"
            to="/bienes/entradas/nueva"
          >
            <Plus size={18} weight="bold" />
            <span>Registrar bien</span>
          </Link>
        </div>
      </header>

      {error && (
        <div className="dashboard-partial-error" role="status">
          <WarningCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="dashboard-loading-skeleton">
          <div className="skeleton-box" style={{ height: 120, borderRadius: 10, background: "#EAEAEA", marginBottom: 20 }} />
          <div className="skeleton-grid" style={{ display: "grid", gridTemplateColumns: "1.7fr 0.9fr", gap: 20, marginBottom: 20 }}>
            <div className="skeleton-box" style={{ height: 220, borderRadius: 10, background: "#EAEAEA" }} />
            <div className="skeleton-box" style={{ height: 220, borderRadius: 10, background: "#EAEAEA" }} />
          </div>
          <div className="skeleton-box" style={{ height: 240, borderRadius: 10, background: "#EAEAEA" }} />
        </div>
      ) : (
        <>
          {/* FRANJA EJECUTIVA (ESTADO GENERAL) */}
          <section className="executive-banner" aria-label="Estado general de bienes">
            <div className="banner-coverage-col">
              <span className="banner-label">COBERTURA DE ASIGNACIÓN</span>
              <div className="banner-big-number">{summary.assignmentCoverage}%</div>
              <div
                className="banner-progress-track"
                role="progressbar"
                aria-label="Cobertura de asignación"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={summary.assignmentCoverage}
              >
                <div
                  className="banner-progress-fill"
                  style={{ width: `${summary.assignmentCoverage}%` }}
                />
              </div>
              <span className="banner-subtext">
                {summary.assignedAssets} de {data.assets.length} con responsable
              </span>
            </div>

            <div className="banner-kpis-grid">
              <div className="banner-kpi-item">
                <span className="kpi-item-label">BIENES REGISTRADOS</span>
                <div className="kpi-item-number">{data.assets.length}</div>
                <span className="kpi-item-sub">Inventario total</span>
              </div>
              <div className="banner-kpi-item">
                <span className="kpi-item-label">ASIGNACIONES ACTIVAS</span>
                <div className="kpi-item-number">{summary.activeAssignments}</div>
                <span className="kpi-item-sub">Custodias vigentes</span>
              </div>
              <div className="banner-kpi-item">
                <span className="kpi-item-label">EVALUACIONES DE BAJA</span>
                <div className="kpi-item-number">{summary.pendingReview}</div>
                <span className="kpi-item-sub">Pendientes de FM</span>
              </div>
            </div>
          </section>

          {/* MAIN GRID: PRIORIDADES DE HOY + ACCIONES RÁPIDAS */}
          <div className="dashboard-main-grid">
            {/* PRIORIDADES DE HOY */}
            <section className="priorities-panel" aria-labelledby="priorities-panel-title">
              <header className="panel-header">
                <h2 id="priorities-panel-title" className="panel-title">PRIORIDADES</h2>
                <span className="panel-badge-counter">{totalPendientes} pendientes</span>
              </header>

              <div className="priorities-list">
                {summary.pendingDisposal > 0 && (
                  <Link to="/bienes/ciclo-vida/bajas" className="priority-row">
                    <span className="priority-number">
                      {String(summary.pendingDisposal).padStart(2, "0")}
                    </span>
                    <span className="priority-text">Bienes esperan disposición final</span>
                    <CaretRight size={18} className="priority-arrow" />
                  </Link>
                )}

                {summary.pendingReview > 0 && (
                  <Link to="/bienes/ciclo-vida/bajas" className="priority-row">
                    <span className="priority-number">
                      {String(summary.pendingReview).padStart(2, "0")}
                    </span>
                    <span className="priority-text">Solicitudes por evaluar</span>
                    <CaretRight size={18} className="priority-arrow" />
                  </Link>
                )}

                {summary.unassignedAssets > 0 && (
                  <Link to="/asignaciones/nueva" className="priority-row">
                    <span className="priority-number">
                      {String(summary.unassignedAssets).padStart(2, "0")}
                    </span>
                    <span className="priority-text">Bienes sin responsable</span>
                    <CaretRight size={18} className="priority-arrow" />
                  </Link>
                )}

                {totalPendientes === 0 && (
                  <div className="priority-empty-row">
                    <CheckCircle size={22} weight="fill" />
                    <span>Sin acciones críticas pendientes. La operación se encuentra al día.</span>
                  </div>
                )}
              </div>
            </section>

            {/* ACCIONES RÁPIDAS COMO MATRIZ 2x2 */}
            <section className="quick-actions-panel" aria-labelledby="actions-panel-title">
              <header className="panel-header">
                <h2 id="actions-panel-title" className="panel-title">ACCIONES RÁPIDAS</h2>
              </header>
              <nav className="actions-matrix" aria-label="Acciones rápidas del panel">
                <Link to="/bienes/entradas/nueva" className="action-matrix-item">
                  <Package size={22} />
                  <span>Registrar bien</span>
                </Link>
                <Link to="/asignaciones/nueva" className="action-matrix-item">
                  <ClipboardText size={22} />
                  <span>Nueva asignación</span>
                </Link>
                <Link to="/bienes/qr" className="action-matrix-item">
                  <QrCode size={22} />
                  <span>Gestionar QR</span>
                </Link>
                <Link to="/bienes/ciclo-vida/bajas" className="action-matrix-item">
                  <Archive size={22} />
                  <span>Evaluar bajas</span>
                </Link>
              </nav>
            </section>
          </div>

          {/* ACTIVIDAD RECIENTE (UNA SOLA LISTA CRONOLÓGICA) */}
          <section className="activity-panel" aria-labelledby="activity-panel-title">
            <header className="panel-header">
              <h2 id="activity-panel-title" className="panel-title">Actividad reciente</h2>
              {lastUpdated && (
                <span className="panel-time-label">
                  Actualizado a las{" "}
                  {lastUpdated.toLocaleTimeString("es-PE", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </header>

            {activities.length > 0 ? (
              <div className="activity-list-container">
                <table className="activity-table">
                  <tbody>
                    {activities.map((activity, idx) => (
                      <tr key={activity.id} className={idx % 2 === 1 ? "row-alt" : ""}>
                        <td className="activity-title-cell">
                          <div className="activity-title-wrapper">
                            {activity.type === "asset" && <Package size={16} />}
                            {activity.type === "assignment" && <ClipboardText size={16} />}
                            {activity.type === "retirement" && <Archive size={16} />}
                            <strong>{activity.title}</strong>
                          </div>
                        </td>
                        <td className="activity-detail-cell">{activity.detail}</td>
                        <td className="activity-date-cell">{formatDate(activity.date)}</td>
                        <td className="activity-action-cell">
                          <Link to={activity.to} className="activity-row-btn" title="Ver detalle">
                            <CaretRight size={16} />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="activity-empty-state">
                <span>Aún no hay actividad registrada en la plataforma.</span>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  if (user?.role === "SOLICITANTE") return <UserDashboardPage />;
  if (user?.role === "SUPERVISOR") return <SupervisorWorkOrderReviewPage />;
  return user?.role === "TECNICO" ? <TechnicianDashboard /> : <AdministrativeDashboard />;
}
