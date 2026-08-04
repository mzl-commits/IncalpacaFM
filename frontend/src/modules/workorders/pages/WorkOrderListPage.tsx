import { CaretRight } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import {
  FilterDate,
  FilterSelect,
  ListFilterPanel,
  type ActiveFilter,
} from "@/components/filters/ListFilterPanel";
import {
  buildFilterOptions,
  isDateInRange,
  labelFor,
  useListFilterParams,
} from "@/components/filters/filterUtils";
import {
  adminPriorityLabels,
  getWorkOrderStatusLabel,
  specialtyLabels,
  WORK_ORDER_STATUSES,
  workOrderStatusLabels,
  type WorkOrderStatus,
} from "@/modules/workorders/workOrderModel";
import {
  getWorkOrderAssetDisplayCode,
  listWorkOrders,
  WORK_ORDERS_UPDATED_EVENT,
} from "@/modules/workorders/workOrderRepository";

const FILTER_KEYS = [
  "q",
  "status",
  "specialty",
  "priority",
  "operator",
  "supervisor",
  "progress",
  "schedule",
  "from",
  "to",
] as const;

const progressLabels: Record<string, string> = {
  pending: "Sin iniciar · 0 %",
  active: "En ejecución · 1–99 %",
  complete: "Completada · 100 %",
};

const scheduleLabels: Record<string, string> = {
  overdue: "Programación vencida",
};

const terminalStatuses = new Set<WorkOrderStatus>([
  "APROBADA_POR_SUPERVISOR",
  "CERRADA",
  "CANCELADA",
]);

const statusClass: Record<WorkOrderStatus, string> = {
  PROGRAMADA: "status-neutral",
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function isOverdue(scheduledDate: string, status: WorkOrderStatus) {
  const today = new Date().toISOString().slice(0, 10);
  return scheduledDate < today && !terminalStatuses.has(status);
}

export function WorkOrderListPage() {
  const [allWorkOrders, setAllWorkOrders] = useState<Awaited<ReturnType<typeof listWorkOrders>>>([]);
  const { values, setValue, clearFilters } = useListFilterParams(FILTER_KEYS);

  useEffect(() => {
    let active = true;
    async function refreshWorkOrders() {
      const orders = await listWorkOrders();
      if (active) setAllWorkOrders(orders);
    }

    void refreshWorkOrders();
    window.addEventListener(WORK_ORDERS_UPDATED_EVENT, refreshWorkOrders);

    return () => {
      active = false;
      window.removeEventListener(WORK_ORDERS_UPDATED_EVENT, refreshWorkOrders);
    };
  }, []);

  const statusOptions = useMemo(() => {
    const counts = new Map<WorkOrderStatus, number>();
    allWorkOrders.forEach((workOrder) => {
      counts.set(workOrder.status, (counts.get(workOrder.status) ?? 0) + 1);
    });

    return WORK_ORDER_STATUSES.map((status) => ({
      value: status,
      label: workOrderStatusLabels[status],
      count: counts.get(status) ?? 0,
    }));
  }, [allWorkOrders]);
  const specialtyOptions = useMemo(
    () =>
      buildFilterOptions(
        allWorkOrders.map((workOrder) => workOrder.specialty),
        specialtyLabels,
      ),
    [allWorkOrders],
  );
  const priorityOptions = useMemo(
    () =>
      buildFilterOptions(
        allWorkOrders.map((workOrder) => workOrder.adminPriority),
        adminPriorityLabels,
      ),
    [allWorkOrders],
  );
  const operatorOptions = useMemo(
    () => buildFilterOptions(allWorkOrders.map((workOrder) => workOrder.operatorName)),
    [allWorkOrders],
  );
  const supervisorOptions = useMemo(
    () => buildFilterOptions(allWorkOrders.map((workOrder) => workOrder.supervisorName)),
    [allWorkOrders],
  );

  const workOrders = useMemo(() => {
    const query = values.q.toLocaleLowerCase("es").trim();

    return allWorkOrders.filter((workOrder) => {
      const searchable = [
        workOrder.code,
        workOrder.requestCode,
        getWorkOrderAssetDisplayCode(workOrder),
        workOrder.operatorName,
        workOrder.supervisorName,
        workOrder.administratorNotes,
        specialtyLabels[workOrder.specialty],
        adminPriorityLabels[workOrder.adminPriority],
        workOrderStatusLabels[workOrder.status],
      ]
        .join(" ")
        .toLocaleLowerCase("es");

      const progressMatches =
        !values.progress ||
        (values.progress === "pending" && workOrder.progressPercentage === 0) ||
        (values.progress === "active" &&
          workOrder.progressPercentage > 0 &&
          workOrder.progressPercentage < 100) ||
        (values.progress === "complete" && workOrder.progressPercentage === 100);
      const scheduleMatches =
        !values.schedule ||
        (values.schedule === "overdue" && isOverdue(workOrder.scheduledDate, workOrder.status));

      return (
        (!query || searchable.includes(query)) &&
        (!values.status || workOrder.status === values.status) &&
        (!values.specialty || workOrder.specialty === values.specialty) &&
        (!values.priority || workOrder.adminPriority === values.priority) &&
        (!values.operator || workOrder.operatorName === values.operator) &&
        (!values.supervisor || workOrder.supervisorName === values.supervisor) &&
        progressMatches &&
        scheduleMatches &&
        isDateInRange(workOrder.scheduledDate, values.from, values.to)
      );
    });
  }, [allWorkOrders, values]);

  const activeFilters: ActiveFilter[] = [];
  if (values.q) {
    activeFilters.push({
      key: "q",
      label: "Búsqueda",
      value: values.q,
      onRemove: () => setValue("q", ""),
    });
  }
  if (values.status) {
    activeFilters.push({
      key: "status",
      label: "Estado",
      value: labelFor(values.status, workOrderStatusLabels),
      onRemove: () => setValue("status", ""),
    });
  }
  if (values.specialty) {
    activeFilters.push({
      key: "specialty",
      label: "Especialidad",
      value: labelFor(values.specialty, specialtyLabels),
      onRemove: () => setValue("specialty", ""),
    });
  }
  if (values.priority) {
    activeFilters.push({
      key: "priority",
      label: "Prioridad",
      value: labelFor(values.priority, adminPriorityLabels),
      onRemove: () => setValue("priority", ""),
    });
  }
  if (values.operator) {
    activeFilters.push({
      key: "operator",
      label: "Operario",
      value: values.operator,
      onRemove: () => setValue("operator", ""),
    });
  }
  if (values.supervisor) {
    activeFilters.push({
      key: "supervisor",
      label: "Supervisor",
      value: values.supervisor,
      onRemove: () => setValue("supervisor", ""),
    });
  }
  if (values.progress) {
    activeFilters.push({
      key: "progress",
      label: "Avance",
      value: labelFor(values.progress, progressLabels),
      onRemove: () => setValue("progress", ""),
    });
  }
  if (values.schedule) {
    activeFilters.push({
      key: "schedule",
      label: "Programación",
      value: labelFor(values.schedule, scheduleLabels),
      onRemove: () => setValue("schedule", ""),
    });
  }
  if (values.from) {
    activeFilters.push({
      key: "from",
      label: "Programada desde",
      value: values.from,
      onRemove: () => setValue("from", ""),
    });
  }
  if (values.to) {
    activeFilters.push({
      key: "to",
      label: "Programada hasta",
      value: values.to,
      onRemove: () => setValue("to", ""),
    });
  }

  const programmedCount = allWorkOrders.filter(
    (workOrder) => workOrder.status === "PROGRAMADA" || workOrder.status === "ASIGNADA",
  ).length;
  const inProgressCount = allWorkOrders.filter(
    (workOrder) => workOrder.status === "EN_PROCESO",
  ).length;
  const pendingSupervisionCount = allWorkOrders.filter(
    (workOrder) => workOrder.status === "PENDIENTE_DE_SUPERVISION",
  ).length;
  const closedCount = allWorkOrders.filter(
    (workOrder) => workOrder.status === "CERRADA" || workOrder.status === "APROBADA_POR_SUPERVISOR",
  ).length;
  const overdueCount = allWorkOrders.filter((workOrder) =>
    isOverdue(workOrder.scheduledDate, workOrder.status),
  ).length;

  return (
    <section className="work-orders-list-page">
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Mantenimiento / Órdenes de trabajo</p>
          <h1>Órdenes de trabajo</h1>
          <p>Consulta la programación, responsables, avance y estado de las órdenes generadas.</p>
        </div>
      </div>

      <div className="metrics-grid">
        <article>
          <span>Programadas o asignadas</span>
          <strong>{programmedCount}</strong>
          <small>Pendientes de iniciar su ejecución</small>
        </article>
        <article>
          <span>En proceso</span>
          <strong>{inProgressCount}</strong>
          <small>Actualmente atendidas por el operario</small>
        </article>
        <article>
          <span>Pendientes de supervisión</span>
          <strong>{pendingSupervisionCount}</strong>
          <small>Esperan revisión del supervisor</small>
        </article>
        <article>
          <span>Aprobadas o cerradas</span>
          <strong>{closedCount}</strong>
          <small>Trabajos finalizados correctamente</small>
        </article>
      </div>

      <div className="data-panel">
        <ListFilterPanel
          title="Consultar órdenes"
          description="Cruza responsables, especialidad, programación, avance y prioridad."
          searchLabel="Buscar órdenes de trabajo"
          searchPlaceholder="Orden, solicitud, operario, supervisor o especialidad"
          searchValue={values.q}
          onSearchChange={(value) => setValue("q", value)}
          resultCount={workOrders.length}
          totalCount={allWorkOrders.length}
          activeFilters={activeFilters}
          onClear={clearFilters}
          quickFilters={[
            {
              key: "in-progress",
              label: "En proceso",
              count: inProgressCount,
              active: values.status === "EN_PROCESO",
              onSelect: () =>
                setValue("status", values.status === "EN_PROCESO" ? "" : "EN_PROCESO"),
            },
            {
              key: "supervision",
              label: "Por supervisar",
              count: pendingSupervisionCount,
              active: values.status === "PENDIENTE_DE_SUPERVISION",
              onSelect: () =>
                setValue(
                  "status",
                  values.status === "PENDIENTE_DE_SUPERVISION" ? "" : "PENDIENTE_DE_SUPERVISION",
                ),
            },
            {
              key: "overdue",
              label: "Programación vencida",
              count: overdueCount,
              active: values.schedule === "overdue",
              onSelect: () => setValue("schedule", values.schedule === "overdue" ? "" : "overdue"),
            },
          ]}
        >
          <FilterSelect
            label="Estado"
            value={values.status}
            onChange={(value) => setValue("status", value)}
            options={statusOptions}
            allLabel="Todos los estados"
          />
          <FilterSelect
            label="Especialidad"
            value={values.specialty}
            onChange={(value) => setValue("specialty", value)}
            options={specialtyOptions}
            allLabel="Todas las especialidades"
          />
          <FilterSelect
            label="Prioridad administrativa"
            value={values.priority}
            onChange={(value) => setValue("priority", value)}
            options={priorityOptions}
            allLabel="Todas las prioridades"
          />
          <FilterSelect
            label="Operario"
            value={values.operator}
            onChange={(value) => setValue("operator", value)}
            options={operatorOptions}
            allLabel="Todos los operarios"
          />
          <FilterSelect
            label="Supervisor"
            value={values.supervisor}
            onChange={(value) => setValue("supervisor", value)}
            options={supervisorOptions}
            allLabel="Todos los supervisores"
          />
          <FilterSelect
            label="Nivel de avance"
            value={values.progress}
            onChange={(value) => setValue("progress", value)}
            options={[
              { value: "pending", label: progressLabels.pending },
              { value: "active", label: progressLabels.active },
              { value: "complete", label: progressLabels.complete },
            ]}
            allLabel="Cualquier avance"
          />
          <FilterSelect
            label="Cumplimiento de fecha"
            value={values.schedule}
            onChange={(value) => setValue("schedule", value)}
            options={[{ value: "overdue", label: scheduleLabels.overdue }]}
            allLabel="Vigentes y vencidas"
          />
          <FilterDate
            label="Programada desde"
            value={values.from}
            max={values.to || undefined}
            onChange={(value) => setValue("from", value)}
          />
          <FilterDate
            label="Programada hasta"
            value={values.to}
            min={values.from || undefined}
            onChange={(value) => setValue("to", value)}
          />
        </ListFilterPanel>

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Orden</th>
                <th>Solicitud</th>
                <th>Especialidad</th>
                <th>Operario</th>
                <th>Supervisor</th>
                <th>Prioridad</th>
                <th>Programación</th>
                <th>Avance</th>
                <th>Estado</th>
                <th>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>

            <tbody>
              {workOrders.map((workOrder) => (
                <tr key={workOrder.id}>
                  <td>
                    <strong>{workOrder.code}</strong>
                  </td>
                  <td>
                    {workOrder.requestCode}
                    {getWorkOrderAssetDisplayCode(workOrder) && (
                      <><br /><small>Bien: {getWorkOrderAssetDisplayCode(workOrder)}</small></>
                    )}
                  </td>
                  <td>{specialtyLabels[workOrder.specialty]}</td>
                  <td>{workOrder.operatorName}</td>
                  <td>{workOrder.supervisorName}</td>
                  <td>{adminPriorityLabels[workOrder.adminPriority]}</td>
                  <td>{formatDate(workOrder.scheduledDate)}</td>
                  <td>
                    <strong>{workOrder.progressPercentage} %</strong>
                  </td>
                  <td>
                    <span className={`status ${statusClass[workOrder.status]}`}>
                      {getWorkOrderStatusLabel(workOrder)}
                    </span>
                  </td>
                  <td>
                    <Link className="table-action" to={`/ordenes-trabajo/${workOrder.id}`}>
                      Ver detalle
                    </Link>
                  </td>
                </tr>
              ))}

              {!workOrders.length && (
                <tr>
                  <td colSpan={10} className="empty-row">
                    No encontramos órdenes de trabajo con esos criterios.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div
          className="operational-mobile-list hidden max-[720px]:grid gap-2 p-3"
          aria-label="Órdenes de trabajo"
        >
          {workOrders.map((workOrder) => (
            <Link
              key={workOrder.id}
              to={`/ordenes-trabajo/${workOrder.id}`}
              className="grid min-h-11 gap-3 rounded border border-slate-300 bg-white p-4 text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <span className="flex items-start justify-between gap-3">
                <strong className="text-sm">{workOrder.code}</strong>
                <span className={`status ${statusClass[workOrder.status]}`}>
                  {getWorkOrderStatusLabel(workOrder)}
                </span>
              </span>
              <span className="grid gap-1 text-xs text-slate-600">
                <strong className="text-sm text-slate-900">
                  {specialtyLabels[workOrder.specialty]}
                </strong>
                <span>Solicitud {workOrder.requestCode}</span>
                {getWorkOrderAssetDisplayCode(workOrder) && (
                  <span>Bien {getWorkOrderAssetDisplayCode(workOrder)}</span>
                )}
              </span>
              <span className="grid grid-cols-2 gap-3 text-xs text-slate-600">
                <span>
                  <strong className="block text-slate-800">Operario</strong>
                  {workOrder.operatorName}
                </span>
                <span>
                  <strong className="block text-slate-800">Programación</strong>
                  {formatDate(workOrder.scheduledDate)}
                </span>
                <span>
                  <strong className="block text-slate-800">Prioridad</strong>
                  {adminPriorityLabels[workOrder.adminPriority]}
                </span>
                <span>
                  <strong className="block text-slate-800">Avance</strong>
                  {workOrder.progressPercentage} %
                </span>
              </span>
              <span className="flex min-h-11 items-center justify-end gap-1 text-sm font-semibold text-blue-700">
                Ver detalle
                <CaretRight size={18} aria-hidden="true" />
              </span>
            </Link>
          ))}

          {!workOrders.length && (
            <p className="empty-row rounded border border-slate-300 bg-white">
              No encontramos órdenes de trabajo con esos criterios.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
