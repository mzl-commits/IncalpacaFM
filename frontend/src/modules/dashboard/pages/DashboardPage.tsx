import {
  Archive,
  ArrowClockwise,
  ArrowRight,
  CaretRight,
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
import { Link, Navigate } from "react-router-dom";

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
import { listAlmacenes, listMateriales } from "@/modules/almacen/catalogoRepository";
import { listTechnicians } from "@/modules/accounts/technicianRepository";
import { listWorkRequests } from "@/modules/incidents/incidentRepository";
import { useAuth } from "@/modules/accounts/AuthContext";
import { getWorkOrderAssetDisplayCode, listWorkOrders } from "@/modules/workorders/workOrderRepository";
import { getWorkOrderStatusLabel } from "@/modules/workorders/workOrderModel";
import UserDashboardPage from "@/modules/accounts/pages/UserDashboardPage";
import { SupervisorWorkOrderReviewPage } from "@/modules/workorders/pages/SupervisorWorkOrderReviewPage";
import AlmaceneroDashboardPage from "@/modules/almacen/pages/AlmaceneroDashboardPage";
import InspectorDashboardPage from "@/modules/almacen/pages/InspectorDashboardPage";
import {
  retirementStatusLabels,
  type RetirementRequest,
} from "@/modules/lifecycle/types";

type DashboardData = {
  assets: RegisteredAsset[];
  assignments: AssignmentRecord[];
  retirementRequests: RetirementRequest[];
  workOrders: Awaited<ReturnType<typeof listWorkOrders>>;
  workRequests: Awaited<ReturnType<typeof listWorkRequests>>;
  technicians: Awaited<ReturnType<typeof listTechnicians>>;
  materials: Awaited<ReturnType<typeof listMateriales>>;
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
  workOrders: [],
  workRequests: [],
  technicians: [],
  materials: [],
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

    async function listMaterialesTodosLosAlmacenes() {
      const almacenes = await listAlmacenes();
      const porAlmacen = await Promise.all(
        almacenes.map((a) => listMateriales(a.id)),
      );
      return porAlmacen.flat();
    }

    const [assetsResult, assignmentsResult, retirementResult, workOrdersResult, workRequestsResult, techniciansResult, materialsResult] =
      await Promise.allSettled([
        listRegisteredAssets(),
        listAssignments(),
        listRetirementRequests(),
        listWorkOrders(),
        listWorkRequests(),
        listTechnicians(),
        listMaterialesTodosLosAlmacenes(),
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
      workOrders: workOrdersResult.status === "fulfilled" ? workOrdersResult.value : [],
      workRequests: workRequestsResult.status === "fulfilled" ? workRequestsResult.value : [],
      technicians: techniciansResult.status === "fulfilled" ? techniciansResult.value : [],
      materials: materialsResult.status === "fulfilled" ? materialsResult.value : [],
    };

    const failedSources = [
      assetsResult.status === "rejected" && "bienes",
      assignmentsResult.status === "rejected" && "asignaciones",
      retirementResult.status === "rejected" && "ciclo de vida",
      workOrdersResult.status === "rejected" && "órdenes de trabajo",
      workRequestsResult.status === "rejected" && "reportes",
      techniciansResult.status === "rejected" && "técnicos",
      materialsResult.status === "rejected" && "stock",
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
    const lowStock = data.materials.filter((material) => !material.control_individual && material.cantidad_total <= 5).length;
    const activeOrders = data.workOrders.filter((order) => !["CERRADA", "CANCELADA"].includes(order.status)).length;
    const pendingReports = data.workRequests.filter((request) => !["CERRADA", "CANCELADA"].includes(request.status)).length;
    const unassignedTechnicians = data.technicians.filter((technician) => technician.active).length;

    return {
      assignedAssets,
      unassignedAssets,
      activeAssignments,
      pendingReview,
      pendingDisposal,
      assignmentCoverage,
      lowStock,
      activeOrders,
      pendingReports,
      technicianCount: unassignedTechnicians,
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

  const totalPendientes = summary.pendingDisposal + summary.pendingReview + summary.unassignedAssets + summary.lowStock + summary.pendingReports;

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
          {/* MAIN GRID: PRIORIDADES DE MANTENIMIENTO */}
          <section className="platform-overview" aria-labelledby="platform-overview-title">
            <header className="platform-overview-header"><div><h2 id="platform-overview-title">Vista general de mantenimiento</h2><p>Alertas y carga operativa de Facility Management.</p></div><span>{summary.pendingReports + summary.activeOrders} tareas activas</span></header>
            <div className="platform-overview-grid">
              <Link to="/incidencias" className={`platform-overview-item ${summary.pendingReports ? "is-alert" : ""}`}><WarningCircle size={22} /><div><strong>Reportes</strong><small>{summary.pendingReports} solicitudes abiertas</small></div><b>{summary.pendingReports}</b></Link>
              <Link to="/ordenes-trabajo" className="platform-overview-item"><Wrench size={22} /><div><strong>Órdenes de trabajo</strong><small>En curso o programadas</small></div><b>{summary.activeOrders}</b></Link>
              <Link to="/almacen/catalogo" className={`platform-overview-item ${summary.lowStock ? "is-alert" : ""}`}><Package size={22} /><div><strong>Stock</strong><small>{summary.lowStock ? `${summary.lowStock} materiales bajo mínimo` : "Niveles dentro del mínimo"}</small></div><b>{summary.lowStock}</b></Link>
              <Link to="/administracion/tecnicos" className="platform-overview-item"><Clock size={22} /><div><strong>Equipo técnico</strong><small>Perfiles activos disponibles</small></div><b>{summary.technicianCount}</b></Link>
            </div>
          </section>

          <div className="dashboard-main-grid">
            {/* PRIORIDADES DE HOY */}
            <section className="priorities-panel" aria-labelledby="priorities-panel-title">
              <header className="panel-header">
                <h2 id="priorities-panel-title" className="panel-title">PRIORIDADES</h2>
                <span className="panel-badge-counter">{summary.pendingReports} pendientes</span>
              </header>

              <div className="priorities-list">
                {summary.pendingReports > 0 && (
                  <Link to="/incidencias" className="priority-row">
                    <span className="priority-number">
                      {String(summary.pendingReports).padStart(2, "0")}
                    </span>
                    <span className="priority-text">Reportes pendientes de revisión</span>
                    <CaretRight size={18} className="priority-arrow" />
                  </Link>
                )}
                {summary.pendingReports === 0 && (
                  <div className="priority-row empty-state" style={{ justifyContent: "center", color: "#666" }}>
                    No hay alertas críticas
                  </div>
                )}
              </div>
            </section>

            {/* ACCIONES DE MANTENIMIENTO COMO MATRIZ 2x2 */}
            <section className="quick-actions-panel" aria-labelledby="actions-panel-title">
              <header className="panel-header">
                <h2 id="actions-panel-title" className="panel-title">ACCIONES DE MANTENIMIENTO</h2>
              </header>
              <nav className="actions-matrix" aria-label="Acciones de mantenimiento del panel">
                <Link to="/incidencias" className="action-matrix-item">
                  <WarningCircle size={22} />
                  <span>Bandeja de reportes</span>
                </Link>
                <Link to="/ordenes-trabajo" className="action-matrix-item">
                  <Wrench size={22} />
                  <span>Órdenes de trabajo</span>
                </Link>
                <Link to="/administracion/tecnicos" className="action-matrix-item">
                  <Clock size={22} />
                  <span>Gestionar técnicos</span>
                </Link>
                <Link to="/almacen/catalogo" className="action-matrix-item">
                  <Package size={22} />
                  <span>Consultar almacén</span>
                </Link>
              </nav>
            </section>
          </div>
        </>
      )}
    </div>
  );
}



export function MaintenanceDashboardPage() {
  const { user } = useAuth();
  return user?.role === "TECNICO" ? <TechnicianDashboard /> : <AdministrativeDashboard />;
}

export function DashboardPage() {
  const { user } = useAuth();
  if (user?.role === "USUARIO") return <UserDashboardPage />;
  if (user?.role === "SUPERVISOR") return <SupervisorWorkOrderReviewPage />;
  if (user?.role === "ALMACENERO") return <AlmaceneroDashboardPage />;
  if (user?.role === "INSPECTOR") return <InspectorDashboardPage />;
  
  // For ADMINISTRADOR and TECNICO, the default page is now Bandeja de reportes
  return user?.role === "ADMINISTRADOR" ? <AdministrativeDashboard /> : (user?.role === "TECNICO" ? <TechnicianDashboard /> : <Navigate to="/incidencias" replace />);
}
