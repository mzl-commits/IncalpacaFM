import {
  Archive,
  ArrowClockwise,
  ArrowRight,
  CalendarBlank,
  ChartBar,
  CheckCircle,
  ClipboardText,
  DownloadSimple,
  FileText,
  Info,
  Package,
  Printer,
  UserFocus,
  Warning,
  WarningCircle,
  Wrench,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { listRegisteredAssets } from "@/modules/assets/assetEntryRepository";
import type { RegisteredAsset } from "@/modules/assets/entryModel";
import { listAssignments, type AssignmentRecord } from "@/modules/assignments/assignmentRepository";
import {
  listWorkRequests,
  WORK_REQUESTS_UPDATED_EVENT,
} from "@/modules/incidents/incidentRepository";
import { requestPriorityLabels, requestStatusLabels } from "@/modules/incidents/incidentModel";
import type { WorkRequest } from "@/modules/incidents/types";
import { listRetirementRequests } from "@/modules/lifecycle/lifecycleRepository";
import { retirementStatusLabels, type RetirementRequest } from "@/modules/lifecycle/types";
import {
  listWorkOrders,
  WORK_ORDERS_UPDATED_EVENT,
} from "@/modules/workorders/workOrderRepository";
import { specialtyLabels, workOrderStatusLabels } from "@/modules/workorders/workOrderModel";
import type { WorkOrder } from "@/modules/workorders/types";

type PeriodKey = "30d" | "90d" | "year" | "all";
type ReportScope = "corporate" | "local";
type QueueSeverity = "critical" | "warning" | "info";
type ActivityKind = "asset" | "assignment" | "retirement" | "request" | "workorder";

type ReportsData = {
  assets: RegisteredAsset[];
  assignments: AssignmentRecord[];
  retirementRequests: RetirementRequest[];
  workRequests: WorkRequest[];
  workOrders: WorkOrder[];
};

type DistributionItem = {
  label: string;
  count: number;
  share: number;
};

type QueueItem = {
  id: string;
  title: string;
  detail: string;
  date: string;
  to: string;
  severity: QueueSeverity;
  scope: ReportScope;
};

type ActivityItem = {
  id: string;
  title: string;
  detail: string;
  status: string;
  date: string;
  to: string;
  kind: ActivityKind;
  scope: ReportScope;
};

type CsvRow = {
  source: string;
  module: string;
  code: string;
  detail: string;
  status: string;
  date: string;
};

const periodOptions: Array<{ value: PeriodKey; label: string }> = [
  { value: "30d", label: "Últimos 30 días" },
  { value: "90d", label: "Últimos 90 días" },
  { value: "year", label: "Año en curso" },
  { value: "all", label: "Todo el historial" },
];

const emptyData: ReportsData = {
  assets: [],
  assignments: [],
  retirementRequests: [],
  workRequests: [],
  workOrders: [],
};

const closedWorkOrderStatuses = new Set(["APROBADA_POR_SUPERVISOR", "CERRADA", "CANCELADA"]);

const retirementInProgressStatuses = new Set([
  "PENDIENTE",
  "EN_EVALUACION",
  "SUBSANACION",
  "PENDIENTE_DISPOSICION",
]);

function parseDate(value: string) {
  const normalized = value.length === 10 ? `${value}T12:00:00` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function getPeriodStart(period: PeriodKey) {
  const now = new Date();

  if (period === "all") return undefined;
  if (period === "year") return new Date(now.getFullYear(), 0, 1);

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (period === "30d" ? 29 : 89));
  return start;
}

function isWithinPeriod(value: string, periodStart?: Date) {
  const date = parseDate(value);
  if (!date) return false;
  return !periodStart || date.getTime() >= periodStart.getTime();
}

function formatDate(value: string) {
  const date = parseDate(value);
  if (!date) return "Fecha no disponible";

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function percentage(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}

function buildDistribution(
  values: string[],
  labels: Record<string, string> = {},
): DistributionItem[] {
  const counts = values.reduce<Map<string, number>>((result, value) => {
    result.set(value, (result.get(value) ?? 0) + 1);
    return result;
  }, new Map());

  return Array.from(counts.entries())
    .map(([value, count]) => ({
      label: labels[value] ?? value,
      count,
      share: percentage(count, values.length),
    }))
    .sort((left, right) => right.count - left.count);
}

function csvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function activityIcon(kind: ActivityKind) {
  if (kind === "asset") return <Package aria-hidden="true" />;
  if (kind === "assignment") return <UserFocus aria-hidden="true" />;
  if (kind === "retirement") return <Archive aria-hidden="true" />;
  if (kind === "request") return <ClipboardText aria-hidden="true" />;
  return <Wrench aria-hidden="true" />;
}

export function ReportsPage() {
  const [period, setPeriod] = useState<PeriodKey>("90d");
  const [data, setData] = useState<ReportsData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [apiErrors, setApiErrors] = useState<string[]>([]);
  const [localError, setLocalError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date>();

  const refreshLocalData = useCallback(async () => {
    try {
      const [workRequests, workOrders] = await Promise.all([
        listWorkRequests(),
        listWorkOrders(),
      ]);
      setData((current) => ({
        ...current,
        workRequests,
        workOrders,
      }));
      setLocalError("");
    } catch {
      setLocalError("No se pudo leer la información local de solicitudes y órdenes de trabajo.");
    }
  }, []);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setApiErrors([]);
    await refreshLocalData();

    const [assetsResult, assignmentsResult, retirementResult] = await Promise.allSettled([
      listRegisteredAssets(),
      listAssignments(),
      listRetirementRequests(),
    ]);

    setData((current) => ({
      ...current,
      assets: assetsResult.status === "fulfilled" ? assetsResult.value : current.assets,
      assignments:
        assignmentsResult.status === "fulfilled" ? assignmentsResult.value : current.assignments,
      retirementRequests:
        retirementResult.status === "fulfilled"
          ? retirementResult.value
          : current.retirementRequests,
    }));

    const failedSources = [
      assetsResult.status === "rejected" && "bienes",
      assignmentsResult.status === "rejected" && "asignaciones",
      retirementResult.status === "rejected" && "solicitudes de baja",
    ].filter((source): source is string => Boolean(source));

    setApiErrors(failedSources);
    setLastUpdated(new Date());
    setLoading(false);
  }, [refreshLocalData]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  useEffect(() => {
    window.addEventListener(WORK_REQUESTS_UPDATED_EVENT, refreshLocalData);
    window.addEventListener(WORK_ORDERS_UPDATED_EVENT, refreshLocalData);
    window.addEventListener("storage", refreshLocalData);

    return () => {
      window.removeEventListener(WORK_REQUESTS_UPDATED_EVENT, refreshLocalData);
      window.removeEventListener(WORK_ORDERS_UPDATED_EVENT, refreshLocalData);
      window.removeEventListener("storage", refreshLocalData);
    };
  }, [refreshLocalData]);

  const periodLabel =
    periodOptions.find((option) => option.value === period)?.label ?? "Periodo seleccionado";
  const periodStart = useMemo(() => getPeriodStart(period), [period]);

  const corporateSummary = useMemo(() => {
    const activeAssignments = data.assignments.filter(
      (assignment) => assignment.status === "ACTIVA",
    );
    const assignedAssetIds = new Set(activeAssignments.map((assignment) => assignment.asset.id));
    const assignedAssets = data.assets.filter((asset) => assignedAssetIds.has(asset.id)).length;
    const unassignedAssets = Math.max(data.assets.length - assignedAssets, 0);
    const newAssets = data.assets.filter((asset) =>
      isWithinPeriod(asset.createdAt, periodStart),
    ).length;
    const movements =
      newAssets +
      data.assignments.filter((assignment) => isWithinPeriod(assignment.start_date, periodStart))
        .length +
      data.retirementRequests.filter((request) => isWithinPeriod(request.updatedAt, periodStart))
        .length;
    const retirementsInProgress = data.retirementRequests.filter((request) =>
      retirementInProgressStatuses.has(request.status),
    ).length;
    const pendingDisposal = data.retirementRequests.filter(
      (request) => request.status === "PENDIENTE_DISPOSICION",
    ).length;

    return {
      activeAssignments: activeAssignments.length,
      assignedAssets,
      assignmentCoverage: percentage(assignedAssets, data.assets.length),
      movements,
      newAssets,
      pendingDisposal,
      retirementsInProgress,
      unassignedAssets,
    };
  }, [data, periodStart]);

  const localSummary = useMemo(() => {
    const requests = data.workRequests.filter((request) =>
      isWithinPeriod(request.reportedAt, periodStart),
    );
    const workOrders = data.workOrders.filter((workOrder) =>
      isWithinPeriod(workOrder.createdAt, periodStart),
    );
    const openUrgentRequests = data.workRequests.filter(
      (request) =>
        ["URGENTE", "EMERGENCIA"].includes(request.requesterPriority) &&
        !["RECHAZADA", "CONVERTIDA_EN_OT"].includes(request.status),
    );
    const activeWorkOrders = data.workOrders.filter(
      (workOrder) => !closedWorkOrderStatuses.has(workOrder.status),
    );
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const overdueWorkOrders = activeWorkOrders.filter((workOrder) => {
      const scheduledDate = parseDate(workOrder.scheduledDate);
      return scheduledDate && scheduledDate.getTime() < today.getTime();
    });
    const completedWorkOrders = workOrders.filter((workOrder) =>
      ["APROBADA_POR_SUPERVISOR", "CERRADA"].includes(workOrder.status),
    ).length;

    return {
      requests,
      workOrders,
      openUrgentRequests,
      urgentRequests: openUrgentRequests.length,
      activeWorkOrders,
      overdueWorkOrders,
      completedWorkOrders,
      completionRate: percentage(completedWorkOrders, workOrders.length),
    };
  }, [data.workOrders, data.workRequests, periodStart]);

  const assetDistribution = useMemo(
    () => buildDistribution(data.assets.map((asset) => asset.assignmentStatus)),
    [data.assets],
  );

  const technicianSummary = useMemo(() => {
    const grouped = new Map<string, { orders: number; minutes: number; ratings: number[] }>();
    localSummary.workOrders.forEach((order) => {
      const current = grouped.get(order.operatorName) ?? { orders: 0, minutes: 0, ratings: [] };
      current.orders += 1;
      current.minutes += order.effectiveWorkMinutes ?? 0;
      if (order.satisfaction?.rating) current.ratings.push(order.satisfaction.rating);
      grouped.set(order.operatorName, current);
    });
    return Array.from(grouped.entries()).map(([name, value]) => ({
      name,
      ...value,
      rating: value.ratings.length ? (value.ratings.reduce((sum, rating) => sum + rating, 0) / value.ratings.length).toFixed(1) : "Pendiente",
    })).sort((a, b) => b.minutes - a.minutes);
  }, [localSummary.workOrders]);

  const retirementDistribution = useMemo(
    () =>
      buildDistribution(
        data.retirementRequests.map((request) => request.status),
        retirementStatusLabels,
      ),
    [data.retirementRequests],
  );

  const queueItems = useMemo<QueueItem[]>(() => {
    const items: QueueItem[] = data.retirementRequests
      .filter((request) => retirementInProgressStatuses.has(request.status))
      .map((request) => ({
        id: `retirement-${request.id}`,
        title:
          request.status === "PENDIENTE_DISPOSICION"
            ? `${request.code} espera disposición final`
            : `${request.code} requiere seguimiento`,
        detail: `${request.assetCode} · ${retirementStatusLabels[request.status]}`,
        date: request.updatedAt,
        to: `/bienes/ciclo-vida/bajas/${request.id}`,
        severity: request.status === "PENDIENTE_DISPOSICION" ? "critical" : "warning",
        scope: "corporate",
      }));

    if (corporateSummary.unassignedAssets > 0) {
      items.push({
        id: "unassigned-assets",
        title: `${corporateSummary.unassignedAssets} ${
          corporateSummary.unassignedAssets === 1 ? "bien no tiene" : "bienes no tienen"
        } responsable vigente`,
        detail: "Revisar disponibilidad y necesidad de asignación.",
        date: new Date().toISOString(),
        to: "/bienes",
        severity: "info",
        scope: "corporate",
      });
    }

    localSummary.overdueWorkOrders.forEach((workOrder) => {
      items.push({
        id: `overdue-${workOrder.id}`,
        title: `${workOrder.code} superó su fecha programada`,
        detail: `${specialtyLabels[workOrder.specialty]} · ${workOrder.operatorName}`,
        date: workOrder.scheduledDate,
        to: `/ordenes-trabajo/${workOrder.id}`,
        severity: workOrder.adminPriority === "ALTA" ? "critical" : "warning",
        scope: "local",
      });
    });

    localSummary.openUrgentRequests.forEach((request) => {
      items.push({
        id: `urgent-${request.id}`,
        title: `${request.code}: ${requestPriorityLabels[request.requesterPriority]}`,
        detail: `${request.building} · ${request.description}`,
        date: request.reportedAt,
        to: `/incidencias/${request.id}`,
        severity: request.requesterPriority === "EMERGENCIA" ? "critical" : "warning",
        scope: "local",
      });
    });

    const severityOrder: Record<QueueSeverity, number> = {
      critical: 0,
      warning: 1,
      info: 2,
    };

    return items
      .sort((left, right) => {
        const severityDifference = severityOrder[left.severity] - severityOrder[right.severity];
        if (severityDifference) return severityDifference;

        return (parseDate(left.date)?.getTime() ?? 0) - (parseDate(right.date)?.getTime() ?? 0);
      })
      .slice(0, 8);
  }, [
    corporateSummary.unassignedAssets,
    data.retirementRequests,
    localSummary.overdueWorkOrders,
    localSummary.openUrgentRequests,
  ]);

  const periodActivities = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = [
      ...data.assets
        .filter((asset) => isWithinPeriod(asset.createdAt, periodStart))
        .map((asset) => ({
          id: `asset-${asset.id}`,
          title: "Bien incorporado",
          detail: `${asset.code} · ${asset.draft.name}`,
          status: asset.assignmentStatus,
          date: asset.createdAt,
          to: `/bienes/${asset.id}`,
          kind: "asset" as const,
          scope: "corporate" as const,
        })),
      ...data.assignments
        .filter((assignment) => isWithinPeriod(assignment.start_date, periodStart))
        .map((assignment) => ({
          id: `assignment-${assignment.id}`,
          title: "Asignación registrada",
          detail: `${assignment.asset.code} · ${assignment.responsible.name}`,
          status: assignment.delivery_status,
          date: assignment.start_date,
          to: `/asignaciones/${assignment.id}`,
          kind: "assignment" as const,
          scope: "corporate" as const,
        })),
      ...data.retirementRequests
        .filter((request) => isWithinPeriod(request.updatedAt, periodStart))
        .map((request) => ({
          id: `retirement-${request.id}`,
          title: "Solicitud de baja actualizada",
          detail: `${request.code} · ${request.assetName}`,
          status: retirementStatusLabels[request.status],
          date: request.updatedAt,
          to: `/bienes/ciclo-vida/bajas/${request.id}`,
          kind: "retirement" as const,
          scope: "corporate" as const,
        })),
      ...localSummary.requests.map((request) => ({
        id: `request-${request.id}`,
        title: "Solicitud de trabajo",
        detail: `${request.code} · ${request.description}`,
        status: requestStatusLabels[request.status],
        date: request.reportedAt,
        to: `/incidencias/${request.id}`,
        kind: "request" as const,
        scope: "local" as const,
      })),
      ...localSummary.workOrders.map((workOrder) => ({
        id: `workorder-${workOrder.id}`,
        title: "Orden de trabajo",
        detail: `${workOrder.code} · ${specialtyLabels[workOrder.specialty]}`,
        status: workOrderStatusLabels[workOrder.status],
        date: workOrder.updatedAt,
        to: `/ordenes-trabajo/${workOrder.id}`,
        kind: "workorder" as const,
        scope: "local" as const,
      })),
    ];

    return items.sort(
      (left, right) =>
        (parseDate(right.date)?.getTime() ?? 0) - (parseDate(left.date)?.getTime() ?? 0),
    );
  }, [
    data.assets,
    data.assignments,
    data.retirementRequests,
    localSummary.requests,
    localSummary.workOrders,
    periodStart,
  ]);

  const activities = useMemo(() => periodActivities.slice(0, 10), [periodActivities]);

  const csvRows = useMemo<CsvRow[]>(
    () =>
      periodActivities.map((activity) => ({
        source: activity.scope === "corporate" ? "API corporativa" : "Navegador local",
        module:
          activity.kind === "asset"
            ? "Bienes"
            : activity.kind === "assignment"
              ? "Asignaciones"
              : activity.kind === "retirement"
                ? "Bajas"
                : activity.kind === "request"
                  ? "Solicitudes"
                  : "Órdenes de trabajo",
        code: activity.detail.split(" · ")[0],
        detail: activity.detail,
        status: activity.status,
        date: activity.date,
      })),
    [periodActivities],
  );

  function exportCsv() {
    if (!csvRows.length) return;

    const headers = ["Fuente", "Módulo", "Código", "Detalle", "Estado", "Fecha"];
    const rows = csvRows.map((row) => [
      row.source,
      row.module,
      row.code,
      row.detail,
      row.status,
      row.date,
    ]);
    const csv = `\uFEFF${[headers, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `informe-sgtb-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  const initialLoading = loading && !lastUpdated;
  const hasPartialError = apiErrors.length > 0 || Boolean(localError);

  return (
    <section className="reports-page" aria-labelledby="reports-page-title" aria-busy={loading}>
      <header className="reports-header">
        <div className="reports-heading">
          <p className="reports-breadcrumb">Análisis / Informes</p>
          <h1 id="reports-page-title">Informe ejecutivo de bienes</h1>
          <p>
            Lectura consolidada del patrimonio, sus responsables y los procesos que requieren
            decisión.
          </p>
          {lastUpdated && (
            <span className="reports-updated">
              Corte actualizado{" "}
              <time dateTime={lastUpdated.toISOString()}>{formatDateTime(lastUpdated)}</time>
            </span>
          )}
        </div>

        <div className="reports-controls" aria-label="Controles del informe">
          <label className="reports-period">
            <CalendarBlank size={19} aria-hidden="true" />
            <span>Periodo</span>
            <select value={period} onChange={(event) => setPeriod(event.target.value as PeriodKey)}>
              {periodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            className="button button-secondary reports-icon-action"
            type="button"
            onClick={() => void loadReports()}
            disabled={loading}
            aria-label="Actualizar informe"
          >
            <ArrowClockwise size={19} className={loading ? "is-spinning" : ""} />
            <span>Actualizar</span>
          </button>

          <button
            className="button button-secondary reports-icon-action"
            type="button"
            onClick={exportCsv}
            disabled={loading || !csvRows.length}
          >
            <DownloadSimple size={19} aria-hidden="true" />
            <span>Exportar CSV</span>
          </button>

          <button
            className="button button-primary reports-icon-action"
            type="button"
            onClick={() => window.print()}
            disabled={loading}
          >
            <Printer size={19} aria-hidden="true" />
            <span>Imprimir</span>
          </button>
          <Link className="button button-secondary reports-icon-action" to="/informes/ordenes-trabajo">
            <Wrench size={19} aria-hidden="true" />
            <span>Informes de OT</span>
          </Link>
          <Link className="button button-secondary reports-icon-action" to="/informes/plantillas"><FileText size={19} aria-hidden="true" /><span>Plantillas</span></Link>
        </div>
      </header>

      <div className="reports-source-health" aria-label="Estado de las fuentes">
        <span
          className={`reports-source-status ${
            loading ? "is-loading" : apiErrors.length ? "is-partial" : "is-ready"
          }`}
        >
          <CheckCircle aria-hidden="true" />
          API corporativa
          {loading ? " actualizando" : apiErrors.length ? " con datos parciales" : " conectada"}
        </span>
        <span className={`reports-source-status ${localError ? "is-error" : "is-local"}`}>
          <Info aria-hidden="true" />
          Solicitudes y OT: fuente local
        </span>
      </div>

      {hasPartialError && (
        <div className="reports-partial-error" role="status">
          <WarningCircle size={22} aria-hidden="true" />
          <div>
            <strong>El informe se actualizó parcialmente</strong>
            {apiErrors.length > 0 && (
              <p>
                No se pudo consultar: {apiErrors.join(", ")}. Se conserva la última información
                disponible.
              </p>
            )}
            {localError && <p>{localError}</p>}
          </div>
        </div>
      )}

      {initialLoading ? (
        <div className="reports-loading" role="status" aria-label="Cargando informe ejecutivo">
          <div aria-hidden="true" />
          <div aria-hidden="true" />
          <div aria-hidden="true" />
        </div>
      ) : (
        <>
          <section className="reports-summary" aria-labelledby="reports-summary-title">
            <div className="reports-summary-lead">
              <ChartBar size={28} weight="duotone" aria-hidden="true" />
              <span>Lectura ejecutiva · {periodLabel}</span>
              <h2 id="reports-summary-title">
                {corporateSummary.assignmentCoverage}% del patrimonio tiene responsable vigente
              </h2>
              <p>
                {corporateSummary.assignedAssets} de {data.assets.length} bienes registrados tienen
                una asignación activa.
              </p>
              <div
                className="reports-coverage"
                role="progressbar"
                aria-label="Cobertura de asignación"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={corporateSummary.assignmentCoverage}
              >
                <span
                  style={{
                    width: `${corporateSummary.assignmentCoverage}%`,
                  }}
                />
              </div>
            </div>

            <dl className="reports-kpis">
              <div>
                <dt>Patrimonio registrado</dt>
                <dd>{data.assets.length}</dd>
                <small>Corte actual</small>
              </div>
              <div>
                <dt>Altas del periodo</dt>
                <dd>{corporateSummary.newAssets}</dd>
                <small>{periodLabel}</small>
              </div>
              <div>
                <dt>Movimientos registrados</dt>
                <dd>{corporateSummary.movements}</dd>
                <small>Altas, asignaciones y bajas</small>
              </div>
              <div>
                <dt>Bajas en gestión</dt>
                <dd>{corporateSummary.retirementsInProgress}</dd>
                <small>{corporateSummary.pendingDisposal} esperan disposición</small>
              </div>
            </dl>
          </section>

          <div className="reports-analysis-grid">
            <section
              className="reports-panel reports-distribution-panel"
              aria-labelledby="reports-assets-distribution-title"
            >
              <header className="reports-panel-heading">
                <div>
                  <h2 id="reports-assets-distribution-title">Situación de los bienes</h2>
                  <p>Distribución actual por estado de asignación.</p>
                </div>
                <Package size={22} aria-hidden="true" />
              </header>

              {assetDistribution.length ? (
                <ul className="reports-distribution-list">
                  {assetDistribution.map((item) => (
                    <li key={item.label}>
                      <div>
                        <span>{item.label}</span>
                        <strong>{item.count}</strong>
                      </div>
                      <div
                        className="reports-distribution-track"
                        role="progressbar"
                        aria-label={`${item.label}: ${item.share}%`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={item.share}
                      >
                        <span style={{ width: `${item.share}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="reports-empty">No hay bienes para distribuir.</p>
              )}
            </section>

            <section
              className="reports-panel reports-distribution-panel"
              aria-labelledby="reports-retirements-title"
            >
              <header className="reports-panel-heading">
                <div>
                  <h2 id="reports-retirements-title">Ciclo de bajas</h2>
                  <p>Situación actual de las solicitudes de baja.</p>
                </div>
                <Archive size={22} aria-hidden="true" />
              </header>

              {retirementDistribution.length ? (
                <ul className="reports-distribution-list">
                  {retirementDistribution.map((item) => (
                    <li key={item.label}>
                      <div>
                        <span>{item.label}</span>
                        <strong>{item.count}</strong>
                      </div>
                      <div
                        className="reports-distribution-track"
                        role="progressbar"
                        aria-label={`${item.label}: ${item.share}%`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={item.share}
                      >
                        <span style={{ width: `${item.share}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="reports-empty">No hay solicitudes de baja registradas.</p>
              )}
            </section>
          </div>

          <section className="reports-local-scope" aria-labelledby="reports-local-title">
            <header className="reports-local-heading">
              <div>
                <span className="reports-local-badge">
                  <Info size={16} aria-hidden="true" />
                  Fuente local del navegador
                </span>
                <h2 id="reports-local-title">Solicitudes y órdenes de trabajo</h2>
                <p>
                  Este bloque es provisional: sus datos se guardan solo en este navegador y todavía
                  no forman parte de la API corporativa.
                </p>
              </div>
              <nav className="reports-local-links" aria-label="Consultar operación local">
                <Link to="/incidencias">
                  Ver solicitudes <ArrowRight aria-hidden="true" />
                </Link>
                <Link to="/ordenes-trabajo">
                  Ver órdenes <ArrowRight aria-hidden="true" />
                </Link>
              </nav>
            </header>

            <dl className="reports-local-kpis">
              <div>
                <dt>Solicitudes del periodo</dt>
                <dd>{localSummary.requests.length}</dd>
              </div>
              <div>
                <dt>Urgentes abiertas</dt>
                <dd>{localSummary.urgentRequests}</dd>
              </div>
              <div>
                <dt>OT activas</dt>
                <dd>{localSummary.activeWorkOrders.length}</dd>
              </div>
              <div>
                <dt>OT vencidas</dt>
                <dd>{localSummary.overdueWorkOrders.length}</dd>
              </div>
              <div>
                <dt>Tasa de cierre</dt>
                <dd>{localSummary.completionRate}%</dd>
              </div>
            </dl>
          </section>

          <section className="reports-panel technician-report-panel" aria-labelledby="technician-report-title">
            <header className="reports-panel-heading"><div><h2 id="technician-report-title">Informe de técnicos</h2><p>OT asignadas, horas efectivas y satisfacción registrada.</p></div><UserFocus size={22} aria-hidden="true" /></header>
            {technicianSummary.length ? <div className="table-scroll"><table><thead><tr><th>Técnico</th><th>OT</th><th>Horas</th><th>Satisfacción</th></tr></thead><tbody>{technicianSummary.map((item) => <tr key={item.name}><td>{item.name}</td><td>{item.orders}</td><td>{(item.minutes / 60).toFixed(1)} h</td><td>{item.rating === "Pendiente" ? item.rating : `${item.rating}/5`}</td></tr>)}</tbody></table></div> : <p className="reports-empty">No hay actividad técnica para el periodo seleccionado.</p>}
          </section>

          <div className="reports-operational-grid">
            <section
              className="reports-panel reports-priority-panel"
              aria-labelledby="reports-priority-title"
            >
              <header className="reports-panel-heading">
                <div>
                  <h2 id="reports-priority-title">Cola crítica</h2>
                  <p>Decisiones y vencimientos que requieren atención.</p>
                </div>
                {queueItems.length > 0 && (
                  <span className="reports-count">{queueItems.length}</span>
                )}
              </header>

              {queueItems.length ? (
                <ul className="reports-priority-list">
                  {queueItems.map((item) => (
                    <li key={item.id}>
                      <Link className={`reports-priority-item is-${item.severity}`} to={item.to}>
                        <span className="reports-priority-icon">
                          {item.severity === "critical" ? (
                            <Warning weight="fill" aria-hidden="true" />
                          ) : item.severity === "warning" ? (
                            <WarningCircle aria-hidden="true" />
                          ) : (
                            <Info aria-hidden="true" />
                          )}
                        </span>
                        <span className="reports-priority-content">
                          <strong>{item.title}</strong>
                          <small>{item.detail}</small>
                          <span className={`reports-scope-tag is-${item.scope}`}>
                            {item.scope === "corporate" ? "API corporativa" : "Fuente local"}
                          </span>
                        </span>
                        <time dateTime={item.date}>{formatDate(item.date)}</time>
                        <ArrowRight aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="reports-all-clear">
                  <CheckCircle size={30} weight="fill" aria-hidden="true" />
                  <div>
                    <strong>Sin alertas críticas</strong>
                    <p>No hay decisiones o vencimientos pendientes.</p>
                  </div>
                </div>
              )}
            </section>

            <section
              className="reports-panel reports-activity-panel"
              aria-labelledby="reports-activity-title"
            >
              <header className="reports-panel-heading">
                <div>
                  <h2 id="reports-activity-title">Actividad del periodo</h2>
                  <p>{periodLabel}, ordenada por actualización.</p>
                </div>
                <CalendarBlank size={22} aria-hidden="true" />
              </header>

              {activities.length ? (
                <ol className="reports-activity-list">
                  {activities.map((activity) => (
                    <li key={activity.id}>
                      <Link to={activity.to}>
                        <span className={`reports-activity-icon is-${activity.kind}`}>
                          {activityIcon(activity.kind)}
                        </span>
                        <span className="reports-activity-content">
                          <strong>{activity.title}</strong>
                          <small>{activity.detail}</small>
                          <span className="reports-activity-meta">
                            <span className={`reports-scope-tag is-${activity.scope}`}>
                              {activity.scope === "corporate" ? "API corporativa" : "Fuente local"}
                            </span>
                            <span>{activity.status}</span>
                          </span>
                        </span>
                        <time dateTime={activity.date}>{formatDate(activity.date)}</time>
                        <ArrowRight aria-hidden="true" />
                      </Link>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="reports-empty">No hay movimientos en el periodo seleccionado.</p>
              )}
            </section>
          </div>
        </>
      )}
    </section>
  );
}
