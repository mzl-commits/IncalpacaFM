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

  const hasAlerts =
    summary.pendingDisposal > 0 ||
    summary.pendingReview > 0 ||
    summary.unassignedAssets > 0;

  return (
    <section className="dashboard-page">
      <div className="dashboard-heading">
        <div>
          <p className="breadcrumb">Inicio / Panel operativo</p>
          <h1>{getGreeting()}, Facility Management</h1>
          <p>
            Resumen de la situación actual de los bienes y las acciones
            que requieren atención.
          </p>
        </div>

        <div className="dashboard-heading-actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={() => void loadDashboard()}
            disabled={loading}
          >
            <ArrowClockwise
              size={18}
              className={loading ? "is-spinning" : ""}
            />
            Actualizar
          </button>
          <Link
            className="button button-primary"
            to="/bienes/entradas/nueva"
          >
            <Plus size={18} weight="bold" />
            Registrar bien
          </Link>
        </div>
      </div>

      {error && (
        <div className="dashboard-partial-error" role="status">
          <WarningCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <>
          <section className="dashboard-overview">
            <div className="dashboard-overview-intro data-panel skeleton" style={{ minHeight: "140px", border: "none" }}></div>
            <dl className="dashboard-stat-list">
               <div className="data-panel skeleton" style={{ minHeight: "100px", border: "none" }} />
               <div className="data-panel skeleton" style={{ minHeight: "100px", border: "none" }} />
               <div className="data-panel skeleton" style={{ minHeight: "100px", border: "none" }} />
            </dl>
          </section>
          
          <div className="dashboard-main-grid">
            <section className="dashboard-priorities data-panel skeleton" style={{ minHeight: "300px", border: "none" }}></section>
            <aside className="dashboard-quick-actions data-panel skeleton" style={{ minHeight: "300px", border: "none" }}></aside>
          </div>
          
          <section className="dashboard-activity data-panel skeleton" style={{ minHeight: "240px", marginTop: "24px", border: "none" }}></section>
        </>
      ) : (
        <>
          <section
            className="dashboard-overview"
            aria-labelledby="dashboard-overview-title"
          >
            <div className="dashboard-overview-intro">
              <span>Estado general</span>
              <h2 id="dashboard-overview-title">
                {summary.assignmentCoverage}% de los bienes tienen
                responsable vigente
              </h2>
              <p>
                {summary.assignedAssets} de {data.assets.length} bienes
                registrados se encuentran asignados.
              </p>
              <div
                className="dashboard-coverage-track"
                role="progressbar"
                aria-label="Cobertura de asignación"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={summary.assignmentCoverage}
              >
                <span
                  style={{ width: `${summary.assignmentCoverage}%` }}
                />
              </div>
            </div>

            <dl className="dashboard-stat-list">
              <div>
                <dt>Bienes registrados</dt>
                <dd>{data.assets.length}</dd>
                <small>Inventario total</small>
              </div>
              <div>
                <dt>Asignaciones activas</dt>
                <dd>{summary.activeAssignments}</dd>
                <small>Custodias vigentes</small>
              </div>
              <div>
                <dt>Evaluaciones de baja</dt>
                <dd>{summary.pendingReview}</dd>
                <small>Pendientes de FM</small>
              </div>
            </dl>
          </section>

          <div className="dashboard-main-grid">
            <section
              className="dashboard-priorities data-panel"
              aria-labelledby="dashboard-priorities-title"
            >
              <header className="dashboard-section-heading">
                <div>
                  <h2 id="dashboard-priorities-title">
                    Prioridades de hoy
                  </h2>
                  <p>Ordenadas por impacto operativo.</p>
                </div>
                {hasAlerts && (
                  <span className="dashboard-alert-count">
                    {summary.pendingDisposal +
                      summary.pendingReview +
                      summary.unassignedAssets}
                  </span>
                )}
              </header>

              <div className="dashboard-alert-list">
                {summary.pendingDisposal > 0 && (
                  <Link
                    className="dashboard-alert is-critical"
                    to="/bienes/ciclo-vida/bajas"
                  >
                    <Warning weight="fill" />
                    <span>
                      <strong>
                        {summary.pendingDisposal}{" "}
                        {summary.pendingDisposal === 1
                          ? "bien espera"
                          : "bienes esperan"}{" "}
                        disposición final
                      </strong>
                      <small>
                        La baja fue aprobada; falta documentar el cierre.
                      </small>
                    </span>
                    <ArrowRight />
                  </Link>
                )}

                {summary.pendingReview > 0 && (
                  <Link
                    className="dashboard-alert is-warning"
                    to="/bienes/ciclo-vida/bajas"
                  >
                    <Archive />
                    <span>
                      <strong>
                        {summary.pendingReview}{" "}
                        {summary.pendingReview === 1
                          ? "solicitud requiere"
                          : "solicitudes requieren"}{" "}
                        evaluación
                      </strong>
                      <small>
                        Revisa diagnóstico, costos y evidencias técnicas.
                      </small>
                    </span>
                    <ArrowRight />
                  </Link>
                )}

                {summary.unassignedAssets > 0 && (
                  <Link
                    className="dashboard-alert is-info"
                    to="/asignaciones/nueva"
                  >
                    <ClipboardText />
                    <span>
                      <strong>
                        {summary.unassignedAssets}{" "}
                        {summary.unassignedAssets === 1
                          ? "bien no tiene"
                          : "bienes no tienen"}{" "}
                        responsable
                      </strong>
                      <small>
                        Incluye bienes disponibles o recientemente devueltos.
                      </small>
                    </span>
                    <ArrowRight />
                  </Link>
                )}

                {!hasAlerts && (
                  <div className="dashboard-all-clear">
                    <CheckCircle size={30} weight="fill" />
                    <span>
                      <strong>Sin acciones críticas pendientes</strong>
                      <small>
                        La operación se encuentra al día.
                      </small>
                    </span>
                  </div>
                )}
              </div>
            </section>

            <aside
              className="dashboard-quick-actions data-panel"
              aria-labelledby="dashboard-actions-title"
            >
              <header className="dashboard-section-heading">
                <div>
                  <h2 id="dashboard-actions-title">Acciones rápidas</h2>
                  <p>Inicia las tareas más frecuentes.</p>
                </div>
              </header>
              <nav aria-label="Acciones rápidas del panel">
                <Link to="/bienes/entradas/nueva">
                  <Package />
                  <span>
                    <strong>Registrar bien</strong>
                    <small>Ingreso e identificación QR</small>
                  </span>
                  <ArrowRight />
                </Link>
                <Link to="/asignaciones/nueva">
                  <ClipboardText />
                  <span>
                    <strong>Nueva asignación</strong>
                    <small>Responsable, entrega y firmas</small>
                  </span>
                  <ArrowRight />
                </Link>
                <Link to="/bienes/qr">
                  <QrCode />
                  <span>
                    <strong>Gestionar QR</strong>
                    <small>Consultar o descargar etiquetas</small>
                  </span>
                  <ArrowRight />
                </Link>
                <Link to="/bienes/ciclo-vida/bajas">
                  <Archive />
                  <span>
                    <strong>Evaluar bajas</strong>
                    <small>Decisiones y disposición final</small>
                  </span>
                  <ArrowRight />
                </Link>
              </nav>
            </aside>
          </div>

          <section
            className="dashboard-activity data-panel"
            aria-labelledby="dashboard-activity-title"
          >
            <header className="dashboard-section-heading">
              <div>
                <h2 id="dashboard-activity-title">
                  Actividad reciente
                </h2>
                <p>Últimos cambios registrados en el sistema.</p>
              </div>
              {lastUpdated && (
                <small>
                  Actualizado a las{" "}
                  {lastUpdated.toLocaleTimeString("es-PE", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </small>
              )}
            </header>

            {activities.length ? (
              <div className="dashboard-activity-list">
                {activities.map((activity) => (
                  <Link to={activity.to} key={activity.id}>
                    <span
                      className={`dashboard-activity-icon is-${activity.type}`}
                    >
                      {activity.type === "asset" && <Package />}
                      {activity.type === "assignment" && (
                        <ClipboardText />
                      )}
                      {activity.type === "retirement" && <Archive />}
                    </span>
                    <span>
                      <strong>{activity.title}</strong>
                      <small>{activity.detail}</small>
                    </span>
                    <time dateTime={activity.date}>
                      {formatDate(activity.date)}
                    </time>
                    <ArrowRight />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="dashboard-empty-activity">
                <Package size={28} />
                <strong>Aún no hay actividad registrada</strong>
                <p>
                  Los movimientos de bienes aparecerán aquí.
                </p>
              </div>
            )}
          </section>
        </>
      )}
    </section>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  if (user?.role === "SOLICITANTE") return <UserDashboardPage />;
  if (user?.role === "SUPERVISOR") return <SupervisorWorkOrderReviewPage />;
  return user?.role === "TECNICO" ? <TechnicianDashboard /> : <AdministrativeDashboard />;
}
