import {
  Archive,
  ArrowClockwise,
  ArrowRight,
  CheckCircle,
  ClipboardText,
  Package,
  Plus,
  QrCode,
  Warning,
  WarningCircle,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { listRegisteredAssets } from "@/modules/assets/assetEntryRepository";
import type { RegisteredAsset } from "@/modules/assets/entryModel";
import {
  listAssignments,
  type AssignmentRecord,
} from "@/modules/assignments/assignmentRepository";
import { listRetirementRequests } from "@/modules/lifecycle/lifecycleRepository";
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

export function DashboardPage() {
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
      detail: `${asset.code} · ${asset.draft.name}`,
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
        detail: `${assignment.asset.code} · ${assignment.responsible.name}`,
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
        to: `/ciclo-vida/bajas/${request.id}`,
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
        <div className="dashboard-loading" aria-label="Cargando panel">
          <div />
          <div />
          <div />
        </div>
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
                    to="/ciclo-vida/bajas"
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
                    to="/ciclo-vida/bajas"
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
                <Link to="/ciclo-vida/bajas">
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
