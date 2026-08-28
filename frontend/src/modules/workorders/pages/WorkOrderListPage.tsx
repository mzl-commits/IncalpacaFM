import { CheckCircle, Plus } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";

import { useAuth } from "@/modules/accounts/AuthContext";
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
  specialtyLabels,
  WORK_ORDER_STATUSES,
  workOrderStatusLabels,
  workOrderTypeLabels,
  getWorkOrderStatusLabel,
} from "@/modules/workorders/workOrderModel";
import { listWorkOrders, WORK_ORDERS_UPDATED_EVENT } from "@/modules/workorders/workOrderRepository";
import { getWorkOrderAssetDisplayCode } from "@/modules/workorders/workOrderRepository";

import {
  WorkOrderListTable,
  isOverdue,
  type WorkOrder,
} from "@/modules/workorders/components/WorkOrderListTable";
import { WorkOrderCreateModal } from "@/modules/workorders/components/WorkOrderCreateModal";

const FILTER_KEYS = [
  "q",
  "status",
  "orderType",
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
  active: "En atención · 1-99 %",
  complete: "Completada · 100 %",
};

const scheduleLabels: Record<string, string> = {
  overdue: "Programación vencida",
};

export function WorkOrderListPage() {
  const [allWorkOrders, setAllWorkOrders] = useState<WorkOrder[]>([]);
  const { user } = useAuth();
  const isAdministrator = user?.role === "ADMINISTRADOR";
  const { values, setValue, clearFilters } = useListFilterParams(FILTER_KEYS);

  const [workOrderModalOpen, setWorkOrderModalOpen] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState("");

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
    const counts = new Map<string, number>();
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
        workOrderTypeLabels[workOrder.orderType ?? "OT"],
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
        (!values.orderType || (workOrder.orderType ?? "OT") === values.orderType) &&
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
  if (values.orderType) {
    activeFilters.push({
      key: "orderType",
      label: "Tipo",
      value: labelFor(values.orderType, workOrderTypeLabels),
      onRemove: () => setValue("orderType", ""),
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
          <p className="breadcrumb">OTs / Órdenes de trabajo</p>
          <h1>Órdenes de trabajo</h1>
          <p>Consulta programación, responsables, avance y estado de OT, OL y OS generadas.</p>
        </div>
        {isAdministrator && (
          <button className="button button-primary" type="button" onClick={() => setWorkOrderModalOpen(true)}>
            <Plus size={18} weight="bold" />
            <span>Agregar orden</span>
          </button>
        )}
      </div>

      {orderSuccess && (
        <div
          className="form-success-banner"
          style={{
            background: "#E8F5E9",
            border: "1px solid #C8E6C9",
            color: "#2E7D32",
            padding: "12px 16px",
            borderRadius: "8px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <CheckCircle size={20} weight="bold" />
          <span>{orderSuccess}</span>
        </div>
      )}

      <div className="metrics-grid">
        <article>
          <span>Programadas o asignadas</span>
          <strong>{programmedCount}</strong>
          <small>Listas para iniciar atención</small>
        </article>
        <article>
          <span>En proceso</span>
          <strong>{inProgressCount}</strong>
          <small>Actualmente atendidas por el operario</small>
        </article>
        <article>
          <span>Por revisar</span>
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
          description="Filtra por responsables, especialidad, programación, avance y prioridad."
          searchLabel="Buscar órdenes operativas"
          searchPlaceholder="Orden, solicitud, tipo, responsable, supervisor o especialidad"
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
            label="Tipo"
            value={values.orderType}
            onChange={(value) => setValue("orderType", value)}
            options={Object.entries(workOrderTypeLabels).map(([value, label]) => ({ value, label }))}
            allLabel="Todos los tipos"
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

        <WorkOrderListTable workOrders={workOrders} user={user} />
      </div>

      <WorkOrderCreateModal
        isOpen={workOrderModalOpen}
        onClose={() => setWorkOrderModalOpen(false)}
        allWorkOrders={allWorkOrders}
        onSuccess={(msg) => {
          setWorkOrderModalOpen(false);
          setOrderSuccess(msg);
          setTimeout(() => setOrderSuccess(""), 4000);
          // the list update will be triggered by the window event emitted in createWorkOrder
        }}
      />
    </section>
  );
}
