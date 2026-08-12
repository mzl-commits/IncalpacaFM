import { CaretRight, CheckCircle, FloppyDisk, Plus, Wrench, X } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";

import { useAuth } from "@/modules/accounts/AuthContext";
import { listTechnicians, type Technician } from "@/modules/accounts/technicianRepository";
import { listRegisteredAssets } from "@/modules/assets/assetEntryRepository";
import { useLocations } from "@/modules/assets/locationMapQueries";
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
  ADMIN_PRIORITIES,
  SPECIALTIES,
  adminPriorityLabels,
  getWorkOrderStatusLabel,
  specialtyLabels,
  WORK_ORDER_STATUSES,
  workOrderStatusLabels,
  workOrderTypeLabels,
  type AdminPriority,
  type Specialty,
  type WorkOrderStatus,
  type WorkOrderType,
} from "@/modules/workorders/workOrderModel";
import {
  createWorkOrder,
  getWorkOrderAssetDisplayCode,
  listWorkOrders,
  WORK_ORDERS_UPDATED_EVENT,
} from "@/modules/workorders/workOrderRepository";

const SUPERVISORS = [
  { id: "USR-SUP-001", name: "Rosa Medina" },
  { id: "USR-SUP-002", name: "Elena Torres" },
];

interface WorkOrderFormState {
  title: string;
  description: string;
  assetId: string;
  locationId: string;
  operatorId: string;
  supervisorId: string;
  specialty: Specialty | "";
  orderType: WorkOrderType;
  priority: AdminPriority;
  scheduledDate: string;
  scheduledStartTime: string;
  plannedHours: number;
}

const emptyOrderForm: WorkOrderFormState = {
  title: "",
  description: "",
  assetId: "",
  locationId: "",
  operatorId: "",
  supervisorId: "USR-SUP-001",
  specialty: "ELECTRICIDAD",
  orderType: "OT",
  priority: "MEDIA",
  scheduledDate: new Date().toISOString().split("T")[0],
  scheduledStartTime: "08:00",
  plannedHours: 2,
};

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

const terminalStatuses = new Set<WorkOrderStatus>([
  "APROBADA_POR_SUPERVISOR",
  "CERRADA",
  "CANCELADA",
]);

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

const typeShortLabels: Record<WorkOrderType, string> = {
  OT: "OT",
  OL: "OL",
  OS: "OS",
};

const typeDescriptions: Record<WorkOrderType, string> = {
  OT: "Mantenimiento",
  OL: "Limpieza",
  OS: "Servicio externo",
};

function getOrderType(workOrder: Awaited<ReturnType<typeof listWorkOrders>>[number]): WorkOrderType {
  return workOrder.orderType ?? "OT";
}

export function WorkOrderListPage() {
  const [allWorkOrders, setAllWorkOrders] = useState<Awaited<ReturnType<typeof listWorkOrders>>>([]);
  const { user } = useAuth();
  const isAdministrator = user?.role === "ADMINISTRADOR";
  const { values, setValue, clearFilters } = useListFilterParams(FILTER_KEYS);

  const locationsQuery = useLocations();
  const locations = useMemo(() => locationsQuery.data ?? [], [locationsQuery.data]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [assets, setAssets] = useState<Awaited<ReturnType<typeof listRegisteredAssets>>>([]);
  const [workOrderModalOpen, setWorkOrderModalOpen] = useState(false);
  const [orderForm, setOrderForm] = useState<WorkOrderFormState>(emptyOrderForm);
  const [orderSaving, setOrderSaving] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [orderSuccess, setOrderSuccess] = useState("");

  async function loadAuxiliaryData() {
    try {
      const [people, assetList] = await Promise.all([
        listTechnicians().catch(() => []),
        listRegisteredAssets().catch(() => []),
      ]);
      setTechnicians(people);
      setAssets(assetList);
      return { people, assetList };
    } catch {
      return { people: [], assetList: [] };
    }
  }

  const supervisors = useMemo(() => {
    const sups = technicians.filter(
      (t) => t.role === "SUPERVISOR" || t.role === "ADMINISTRADOR"
    );
    return sups.length ? sups : technicians;
  }, [technicians]);

  async function openCreateOrderModal() {
    const { people } = await loadAuxiliaryData();
    const activeTechs = people.length ? people : technicians;
    const defaultOperator = activeTechs.find((t) => t.email === user?.email || t.worker_code === user?.username) || activeTechs[0];
    const sups = activeTechs.filter((t) => t.role === "SUPERVISOR" || t.role === "ADMINISTRADOR");
    const defaultSup = sups.length ? sups[0] : activeTechs[0];

    setOrderForm({
      ...emptyOrderForm,
      operatorId: defaultOperator?.id ?? "",
      supervisorId: defaultSup?.id ?? "",
      scheduledDate: new Date().toISOString().split("T")[0],
    });
    setWorkOrderModalOpen(true);
    setOrderError("");
    setOrderSuccess("");
  }

  function handleSelectAsset(assetId: string) {
    const asset = assets.find((a) => a.id === assetId);
    setOrderForm((prev) => ({
      ...prev,
      assetId,
      locationId: asset?.locationDetail?.id || prev.locationId,
    }));
  }

  async function saveWorkOrder(event: React.FormEvent) {
    event.preventDefault();
    if (!orderForm.description.trim()) {
      setOrderError("Ingresa la descripción o motivo de la orden operativa.");
      return;
    }
    setOrderSaving(true);
    setOrderError("");
    setOrderSuccess("");
    try {
      const selectedOperator = technicians.find((t) => t.id === orderForm.operatorId);
      const selectedAsset = assets.find((a) => a.id === orderForm.assetId);
      const selectedSupervisor = SUPERVISORS.find((s) => s.id === orderForm.supervisorId);

      await createWorkOrder({
        orderType: orderForm.orderType,
        description: orderForm.description.trim(),
        directRequestDescription: orderForm.description.trim(),
        title: orderForm.title.trim() || orderForm.description.trim().substring(0, 40),
        assetId: orderForm.assetId || undefined,
        directAssetId: orderForm.assetId || null,
        assetCode: selectedAsset ? (selectedAsset.fm_code || selectedAsset.code) : undefined,
        assetName: selectedAsset?.name,
        directLocationId: orderForm.locationId || null,
        operatorId: orderForm.operatorId || undefined,
        operatorName: selectedOperator?.full_name,
        technicianWorkerCode: selectedOperator?.worker_code || "tecnico",
        supervisorId: orderForm.supervisorId || undefined,
        supervisorName: selectedSupervisor?.name,
        specialty: (orderForm.specialty || "ELECTRICIDAD") as Specialty,
        type: orderForm.orderType === "OL" ? "RUTINARIO" : "CORRECTIVO",
        priority: orderForm.priority,
        adminPriority: orderForm.priority,
        scheduledDate: orderForm.scheduledDate || new Date().toISOString().split("T")[0],
        scheduledStartTime: orderForm.scheduledStartTime || "08:00",
        plannedHours: Number(orderForm.plannedHours) || 2,
        status: "PROGRAMADA",
      });

      const updatedOrders = await listWorkOrders();
      setAllWorkOrders(updatedOrders);
      setWorkOrderModalOpen(false);
      setOrderSuccess("Orden operativa registrada exitosamente.");
      setTimeout(() => setOrderSuccess(""), 4000);
    } catch {
      setOrderError("No se pudo crear la orden operativa. Revisa los campos obligatorios.");
    } finally {
      setOrderSaving(false);
    }
  }

  useEffect(() => {
    let active = true;
    async function refreshWorkOrders() {
      const orders = await listWorkOrders();
      if (active) setAllWorkOrders(orders);
    }

    void refreshWorkOrders();
    void loadAuxiliaryData();
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
        workOrderTypeLabels[workOrder.orderType ?? "OT"],
        getWorkOrderAssetDisplayCode(workOrder),
        workOrder.operatorName,
        workOrder.supervisorName,
        workOrder.administratorNotes,
        specialtyLabels[workOrder.specialty],
        adminPriorityLabels[workOrder.adminPriority],
        getWorkOrderStatusLabel(workOrder),
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
          <p className="breadcrumb">Mantenimiento / Órdenes operativas</p>
          <h1>Órdenes operativas</h1>
          <p>Consulta programación, responsables, avance y estado de OT, OL y OS generadas.</p>
        </div>
        <button className="button button-primary" type="button" onClick={openCreateOrderModal}>
          <Plus size={18} weight="bold" />
          <span>Agregar orden operativa</span>
        </button>
      </div>

      {orderSuccess && (
        <div className="form-success-banner" style={{ background: "#E8F5E9", border: "1px solid #C8E6C9", color: "#2E7D32", padding: "12px 16px", borderRadius: "8px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
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

        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Orden</th>
                <th>Solicitud</th>
                <th>Tipo</th>
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
              {workOrders.map((workOrder) => {
                const orderType = getOrderType(workOrder);
                const isServiceOrder = orderType === "OS";
                return (
                <tr key={workOrder.id} className={`work-order-row is-${orderType.toLowerCase()}`}>
                  <td>
                    <strong>{workOrder.code}</strong>
                  </td>
                  <td>
                    {workOrder.requestCode}
                    {getWorkOrderAssetDisplayCode(workOrder) && (
                      <><br /><small>Bien: {getWorkOrderAssetDisplayCode(workOrder)}</small></>
                    )}
                  </td>
                  <td>
                    <span className={`work-order-type-badge is-${orderType.toLowerCase()}`}>
                      <strong>{typeShortLabels[orderType]}</strong>
                      <small>{typeDescriptions[orderType]}</small>
                    </span>
                  </td>
                  <td>{specialtyLabels[workOrder.specialty]}</td>
                  <td>{isServiceOrder ? "Administración" : workOrder.operatorName}</td>
                  <td>{isServiceOrder ? "No aplica" : workOrder.supervisorName}</td>
                  <td>{adminPriorityLabels[workOrder.adminPriority]}</td>
                  <td>{formatDate(workOrder.scheduledDate)}</td>
                  <td>
                    <strong>{isServiceOrder ? "Gestion admin." : `${workOrder.progressPercentage} %`}</strong>
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
                );
              })}

              {!workOrders.length && (
                <tr>
                  <td colSpan={11} className="empty-row">
                    No hay órdenes con esos filtros. Prueba quitando algún filtro o revisa otro estado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div
          className="operational-mobile-list hidden max-[720px]:grid gap-2 p-3"
          aria-label="Órdenes operativas"
        >
          {workOrders.map((workOrder) => {
            const orderType = getOrderType(workOrder);
            const isServiceOrder = orderType === "OS";
            return (
            <Link
              key={workOrder.id}
              to={`/ordenes-trabajo/${workOrder.id}`}
              className={`operational-mobile-card is-${orderType.toLowerCase()} grid min-h-11 gap-3 rounded border border-slate-300 bg-white p-4 text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600`}
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
                <span className={`work-order-type-badge is-${orderType.toLowerCase()}`}>
                  <strong>{typeShortLabels[orderType]}</strong>
                  <small>{typeDescriptions[orderType]}</small>
                </span>
                <span>Solicitud {workOrder.requestCode}</span>
                {getWorkOrderAssetDisplayCode(workOrder) && (
                  <span>Bien {getWorkOrderAssetDisplayCode(workOrder)}</span>
                )}
              </span>
              <span className="grid grid-cols-2 gap-3 text-xs text-slate-600">
                <span>
                  <strong className="block text-slate-800">{isServiceOrder ? "Responsable" : "Operario"}</strong>
                  {isServiceOrder ? "Administración" : workOrder.operatorName}
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
                  <strong className="block text-slate-800">{isServiceOrder ? "Control" : "Avance"}</strong>
                  {isServiceOrder ? "Administrativo" : `${workOrder.progressPercentage} %`}
                </span>
              </span>
              <span className="flex min-h-11 items-center justify-end gap-1 text-sm font-semibold text-zinc-800">
                Ver detalle
                <CaretRight size={18} aria-hidden="true" />
              </span>
            </Link>
            );
          })}

          {!workOrders.length && (
            <p className="empty-row rounded border border-slate-300 bg-white">
              No hay órdenes con esos filtros. Prueba quitando algún filtro o revisa otro estado.
            </p>
          )}
        </div>
      </div>

      {workOrderModalOpen &&
        createPortal(
          <div
            className="work-order-modal-backdrop"
            onClick={(e) => {
              if (e.target === e.currentTarget) setWorkOrderModalOpen(false);
            }}
          >
            <aside className="technician-editor modal-widget work-order-modal-widget" aria-labelledby="work-order-modal-title">
              <header className="work-order-modal-header">
                <div className="work-order-header-icon">
                  <Wrench size={22} weight="bold" />
                </div>
                <div>
                  <h2 id="work-order-modal-title">Agregar orden operativa</h2>
                  <p>Asigna trabajos directos de mantenimiento, rutinas o inspecciones.</p>
                </div>
                <button
                  className="icon-button modal-close-btn"
                  type="button"
                  aria-label="Cerrar modal"
                  onClick={() => setWorkOrderModalOpen(false)}
                >
                  <X size={20} weight="bold" />
                </button>
              </header>

              <form onSubmit={saveWorkOrder} className="work-order-modal-form work-order-horizontal-form">
                <div className="work-order-form-grid">
                  {/* Columna Izquierda: Tipo, Clasificación, Activo y Ubicación */}
                  <div className="work-order-form-col">
                    <div className="form-group-row">
                      <label className="field">
                        <span>Tipo de orden *</span>
                        <select
                          value={orderForm.orderType}
                          onChange={(e) => setOrderForm({ ...orderForm, orderType: e.target.value as WorkOrderType })}
                        >
                          {Object.entries(workOrderTypeLabels).map(([code, name]) => (
                            <option key={code} value={code}>
                              {code} — {name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field">
                        <span>Prioridad *</span>
                        <select
                          value={orderForm.priority}
                          onChange={(e) => setOrderForm({ ...orderForm, priority: e.target.value as AdminPriority })}
                        >
                          {ADMIN_PRIORITIES.map((prio) => (
                            <option key={prio} value={prio}>
                              {adminPriorityLabels[prio]}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="field">
                      <span>Especialidad *</span>
                      <select
                        value={orderForm.specialty}
                        onChange={(e) => setOrderForm({ ...orderForm, specialty: e.target.value as Specialty })}
                      >
                        {SPECIALTIES.map((spec) => (
                          <option key={spec} value={spec}>
                            {specialtyLabels[spec]}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      <span>Bien / Activo (Opcional)</span>
                      <select
                        value={orderForm.assetId}
                        onChange={(e) => handleSelectAsset(e.target.value)}
                      >
                        <option value="">Sin bien asociado</option>
                        {assets.map((asset) => (
                          <option key={asset.id} value={asset.id}>
                            {asset.fm_code || asset.code} — {asset.name}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="field">
                      <span>Ubicación / Ambiente</span>
                      <select
                        value={orderForm.locationId}
                        onChange={(e) => setOrderForm({ ...orderForm, locationId: e.target.value })}
                      >
                        <option value="">Seleccionar ubicación...</option>
                        {locations.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.locationCode ? `${item.locationCode} - ` : ""}{item.building} / {item.area} / {item.room}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {/* Columna Derecha: Responsables, Detalles y Tiempos */}
                  <div className="work-order-form-col">
                    <div className="form-group-row">
                      <label className="field">
                        <span>Técnico asignado *</span>
                        <select
                          required
                          value={orderForm.operatorId}
                          onChange={(e) => setOrderForm({ ...orderForm, operatorId: e.target.value })}
                        >
                          <option value="">Selecciona técnico...</option>
                          {technicians.map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.full_name} ({person.worker_code})
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="field">
                        <span>Supervisor *</span>
                        <select
                          value={orderForm.supervisorId}
                          onChange={(e) => setOrderForm({ ...orderForm, supervisorId: e.target.value })}
                        >
                          <option value="">Selecciona supervisor...</option>
                          {supervisors.map((sup) => (
                            <option key={sup.id} value={sup.id}>
                              {sup.full_name} ({sup.worker_code})
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="field">
                      <span>Descripción de la tarea *</span>
                      <textarea
                        required
                        rows={3}
                        placeholder="Describe la tarea operativa o trabajo de mantenimiento a realizar..."
                        value={orderForm.description}
                        onChange={(e) => setOrderForm({ ...orderForm, description: e.target.value })}
                      />
                    </label>

                  <div className="form-group-row">
                    <label className="field">
                      <span>Fecha programada *</span>
                      <input
                        type="date"
                        required
                        value={orderForm.scheduledDate}
                        onChange={(e) => setOrderForm({ ...orderForm, scheduledDate: e.target.value })}
                      />
                    </label>

                    <label className="field">
                      <span>Hora de inicio</span>
                      <input
                        type="time"
                        value={orderForm.scheduledStartTime}
                        onChange={(e) => setOrderForm({ ...orderForm, scheduledStartTime: e.target.value })}
                      />
                    </label>
                  </div>

                  <label className="field">
                    <span>Duración estimada *</span>
                    <select
                      value={orderForm.plannedHours}
                      onChange={(e) => setOrderForm({ ...orderForm, plannedHours: Number(e.target.value) })}
                    >
                      <option value={0.5}>30 minutos</option>
                      <option value={1}>1 hora</option>
                      <option value={1.5}>1 hora y media</option>
                      <option value={2}>2 horas</option>
                      <option value={2.5}>2 horas y media</option>
                      <option value={3}>3 horas</option>
                      <option value={3.5}>3 horas y media</option>
                      <option value={4}>4 horas</option>
                      <option value={5}>5 horas</option>
                      <option value={6}>6 horas</option>
                      <option value={8}>8 horas</option>
                    </select>
                  </label>
                  </div>
                </div>

                {orderError && <div className="form-error" role="alert">{orderError}</div>}

                <div className="modal-actions-bar">
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => setWorkOrderModalOpen(false)}
                  >
                    Cancelar
                  </button>
                  <button className="button button-primary" type="submit" disabled={orderSaving}>
                    <FloppyDisk size={18} weight="bold" />
                    <span>{orderSaving ? "Guardando..." : "Crear orden operativa"}</span>
                  </button>
                </div>
              </form>
            </aside>
          </div>,
          document.body,
        )}
    </section>
  );
}

