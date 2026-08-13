import { CalendarBlank, CaretRight, CheckCircle, FloppyDisk, Package, Plus, Wrench, X } from "@phosphor-icons/react";
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
  addWorkOrderCost,
  createWorkOrder,
  getWorkOrderAssetDisplayCode,
  listWorkOrders,
  WORK_ORDERS_UPDATED_EVENT,
} from "@/modules/workorders/workOrderRepository";
import { OperatorAvailabilityPanel, findScheduleConflicts } from "@/modules/workorders/components/OperatorAvailabilityPanel";

const TIME_SLOTS_12H = [
  { value: "06:00", label: "06:00 AM" },
  { value: "06:30", label: "06:30 AM" },
  { value: "07:00", label: "07:00 AM" },
  { value: "07:30", label: "07:30 AM" },
  { value: "08:00", label: "08:00 AM" },
  { value: "08:30", label: "08:30 AM" },
  { value: "09:00", label: "09:00 AM" },
  { value: "09:30", label: "09:30 AM" },
  { value: "10:00", label: "10:00 AM" },
  { value: "10:30", label: "10:30 AM" },
  { value: "11:00", label: "11:00 AM" },
  { value: "11:30", label: "11:30 AM" },
  { value: "12:00", label: "12:00 PM (Mediodía)" },
  { value: "12:30", label: "12:30 PM" },
  { value: "13:00", label: "01:00 PM" },
  { value: "13:30", label: "01:30 PM" },
  { value: "14:00", label: "02:00 PM" },
  { value: "14:30", label: "02:30 PM" },
  { value: "15:00", label: "03:00 PM" },
  { value: "15:30", label: "03:30 PM" },
  { value: "16:00", label: "04:00 PM" },
  { value: "16:30", label: "04:30 PM" },
  { value: "17:00", label: "05:00 PM" },
  { value: "17:30", label: "05:30 PM" },
  { value: "18:00", label: "06:00 PM" },
  { value: "18:30", label: "06:30 PM" },
  { value: "19:00", label: "07:00 PM" },
  { value: "20:00", label: "08:00 PM" },
];

const PLANNED_HOURS_OPTIONS = [
  { value: 0.5, label: "30 minutos" },
  { value: 1, label: "1 hora" },
  { value: 1.5, label: "1 hora y media" },
  { value: 2, label: "2 horas" },
  { value: 2.5, label: "2 horas y media" },
  { value: 3, label: "3 horas" },
  { value: 3.5, label: "3 horas y media" },
  { value: 4, label: "4 horas" },
  { value: 4.5, label: "4 horas y media" },
  { value: 5, label: "5 horas" },
  { value: 5.5, label: "5 horas y media" },
  { value: 6, label: "6 horas" },
  { value: 6.5, label: "6 horas y media" },
  { value: 7, label: "7 horas" },
  { value: 7.5, label: "7 horas y media" },
  { value: 8, label: "8 horas" },
  { value: 8.5, label: "8 horas y media" },
  { value: 9, label: "9 horas" },
  { value: 9.5, label: "9 horas y media" },
  { value: 10, label: "10 horas" },
  { value: 12, label: "12 horas" },
];

const weekdayOptions = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mié" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sáb" },
  { value: 0, label: "Dom" },
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
  cleaningMode: "ESPECIFICA" | "RUTINARIA";
  priority: AdminPriority;
  scheduledDate: string;
  routineStartDate: string;
  routineEndDate: string;
  routineWeekdays: number[];
  scheduledStartTime: string;
  plannedHours: number;
  locationZone: string;
  locationBuilding: string;
  locationArea: string;
  serviceProvider: string;
  serviceDocumentCode: string;
  serviceAmount: string;
  serviceNotes: string;
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
  cleaningMode: "ESPECIFICA",
  priority: "MEDIA",
  scheduledDate: new Date().toISOString().split("T")[0],
  routineStartDate: new Date().toISOString().split("T")[0],
  routineEndDate: new Date().toISOString().split("T")[0],
  routineWeekdays: [1, 2, 3, 4, 5],
  scheduledStartTime: "08:00",
  plannedHours: 2,
  locationZone: "",
  locationBuilding: "",
  locationArea: "",
  serviceProvider: "",
  serviceDocumentCode: "",
  serviceAmount: "",
  serviceNotes: "",
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

function moneyValue(value: string) {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseLocalDate(value: string) {
  return new Date(`${value}T00:00:00`);
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildRoutineDates(startDate: string, endDate: string, weekdays: number[]) {
  if (!startDate || !endDate || !weekdays.length) return [];
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  if (end < start) return [];

  const dates: string[] = [];
  const current = new Date(start);
  while (current <= end) {
    if (weekdays.includes(current.getDay())) dates.push(toIsoDate(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
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
  const [manualHoursMode, setManualHoursMode] = useState(false);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);

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
    const defaultOperator = activeTechs.find((t) => t.email === user?.email || t.worker_code === user?.workerCode) || activeTechs[0];
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
    setAvailabilityOpen(false);
  }

  function handleSelectAsset(assetId: string) {
    const asset = assets.find((a) => a.id === assetId);
    setOrderForm((prev) => ({
      ...prev,
      assetId,
      locationId: asset?.locationDetail?.id || prev.locationId,
    }));
  }

  function toggleRoutineWeekday(day: number) {
    setOrderForm((current) => ({
      ...current,
      routineWeekdays: current.routineWeekdays.includes(day)
        ? current.routineWeekdays.filter((item) => item !== day)
        : [...current.routineWeekdays, day].sort((left, right) => left - right),
    }));
  }

  async function toggleAvailabilityPanel() {
    if (!orderForm.operatorId) return;
    if (availabilityOpen) {
      setAvailabilityOpen(false);
      return;
    }
    setAvailabilityLoading(true);
    try {
      const latestOrders = await listWorkOrders();
      setAllWorkOrders(latestOrders);
      setAvailabilityOpen(true);
    } catch {
      setOrderError("No se pudo actualizar la disponibilidad del operario.");
    } finally {
      setAvailabilityLoading(false);
    }
  }

  async function saveWorkOrder(event: React.FormEvent) {
    event.preventDefault();
    if (!orderForm.description.trim()) {
      setOrderError("Ingresa la descripción o motivo de la orden operativa.");
      return;
    }
    const isServiceOrder = orderForm.orderType === "OS";
    const serviceAmount = moneyValue(orderForm.serviceAmount);
    if (isServiceOrder && (!orderForm.serviceProvider.trim() || !orderForm.serviceDocumentCode.trim() || serviceAmount <= 0 || !orderForm.locationId || !orderForm.scheduledDate)) {
      setOrderError("Completa proveedor, documento, monto, fecha, ubicación y descripción del servicio.");
      return;
    }
    const isRoutineCleaning = orderForm.orderType === "OL" && orderForm.cleaningMode === "RUTINARIA";
    if (isRoutineCleaning && (!orderForm.routineStartDate || !orderForm.routineEndDate || !orderForm.routineWeekdays.length)) {
      setOrderError("Completa el rango de fechas y los días de limpieza para generar la rutina.");
      return;
    }
    if (isRoutineCleaning && !routineDates.length) {
      setOrderError("El rango elegido no tiene fechas para los días seleccionados.");
      return;
    }
    if (isRoutineCleaning && routineDates.length > 60) {
      setOrderError("Genera máximo 60 OL por vez para mantener la agenda ordenada.");
      return;
    }
    if (isRoutineCleaning && orderForm.operatorId) {
      const conflicts = findScheduleConflicts({
        orders: allWorkOrders,
        operatorId: orderForm.operatorId,
        operatorName: technicians.find((t) => t.id === orderForm.operatorId)?.full_name,
        dates: routineDates,
        startTime: orderForm.scheduledStartTime,
        plannedHours: orderForm.plannedHours,
      });
      if (conflicts.length) {
        setOrderError(`La rutina se cruza con órdenes ya programadas: ${conflicts.slice(0, 4).map((order) => order.code).join(", ")}${conflicts.length > 4 ? "..." : ""}.`);
        return;
      }
    }
    setOrderSaving(true);
    setOrderError("");
    setOrderSuccess("");
    try {
      const selectedOperator = technicians.find((t) => t.id === orderForm.operatorId) || technicians[0];
      const selectedAsset = assets.find((a) => a.id === orderForm.assetId);
      const selectedSupervisor = supervisors.find((s) => s.id === orderForm.supervisorId) || technicians[0];
      const defaultLocationId = locations[0]?.id || "";
      const locationId = orderForm.locationId || selectedAsset?.locationDetail?.id || defaultLocationId;
      if (isServiceOrder) {
        const details = [
          `Proveedor: ${orderForm.serviceProvider.trim()}`,
          `Orden de compra o servicio: ${orderForm.serviceDocumentCode.trim()}`,
          `Monto: S/ ${serviceAmount.toFixed(2)}`,
          orderForm.serviceNotes.trim() ? `Observaciones: ${orderForm.serviceNotes.trim()}` : "",
        ].filter(Boolean).join("\n");

        const workOrder = await createWorkOrder({
          orderType: "OS",
          description: orderForm.description.trim(),
          directRequestDescription: orderForm.description.trim(),
          directRequestType: "OS directa",
          title: orderForm.title.trim() || orderForm.description.trim().substring(0, 40),
          directLocationId: locationId || null,
          operatorId: "",
          operatorName: "",
          supervisorId: "",
          supervisorName: "",
          specialty: "SERVICIO_EXTERNO" as Specialty,
          priority: orderForm.priority,
          adminPriority: orderForm.priority,
          administratorNotes: details,
          scheduledDate: orderForm.scheduledDate || new Date().toISOString().split("T")[0],
          scheduledStartTime: "08:00",
          plannedHours: 1,
          status: "PROGRAMADA",
          progressPercentage: 0,
        });

        await addWorkOrderCost(workOrder.id, {
          category: "SERVICIO",
          description: `${orderForm.serviceProvider.trim()} - ${orderForm.serviceDocumentCode.trim()}`,
          amount: serviceAmount,
        });

        const updatedOrders = await listWorkOrders();
        setAllWorkOrders(updatedOrders);
        setWorkOrderModalOpen(false);
        setOrderSuccess("OS registrada exitosamente.");
        setTimeout(() => setOrderSuccess(""), 4000);
        return;
      }
      const datesToCreate = isRoutineCleaning ? routineDates : [orderForm.scheduledDate || new Date().toISOString().split("T")[0]];

      for (const scheduledDate of datesToCreate) {
        await createWorkOrder({
          orderType: orderForm.orderType,
          description: orderForm.description.trim(),
          directRequestDescription: orderForm.description.trim(),
          directRequestType: isRoutineCleaning ? "OL rutinaria" : undefined,
          title: orderForm.title.trim() || orderForm.description.trim().substring(0, 40),
          assetId: orderForm.assetId || undefined,
          directAssetId: orderForm.assetId || null,
          assetCode: selectedAsset ? (selectedAsset.fmCode || selectedAsset.code) : undefined,
          assetName: selectedAsset?.draft.name,
          directLocationId: locationId || null,
          operatorId: selectedOperator?.id,
          operatorName: selectedOperator?.full_name,
          technicianWorkerCode: selectedOperator?.worker_code,
          supervisorId: selectedSupervisor?.id,
          supervisorName: selectedSupervisor?.full_name,
          supervisorWorkerCode: selectedSupervisor?.worker_code,
          specialty: (orderForm.specialty || selectedOperator?.specialty || "ELECTRICIDAD") as Specialty,
          type: isRoutineCleaning ? "RUTINARIO" : "CORRECTIVO",
          priority: orderForm.priority,
          adminPriority: orderForm.priority,
          administratorNotes: isRoutineCleaning
            ? `Rutina generada: ${orderForm.routineStartDate} a ${orderForm.routineEndDate}.`
            : undefined,
          scheduledDate,
          scheduledStartTime: orderForm.scheduledStartTime || "08:00",
          plannedHours: Number(orderForm.plannedHours) || 2,
          status: "PROGRAMADA",
        });
      }

      const updatedOrders = await listWorkOrders();
      setAllWorkOrders(updatedOrders);
      setWorkOrderModalOpen(false);
      setOrderSuccess(isRoutineCleaning ? `${datesToCreate.length} OL rutinaria(s) registradas exitosamente.` : "Orden operativa registrada exitosamente.");
      setTimeout(() => setOrderSuccess(""), 4000);
    } catch (err: any) {
      const serverDetail = err?.response?.data?.detail || err?.response?.data?.directLocationId || err?.response?.data?.scheduledStartTime;
      const errorMsg = typeof serverDetail === "string" ? serverDetail : Array.isArray(serverDetail) ? serverDetail[0] : "No se pudo crear la orden operativa. Revisa los campos obligatorios.";
      setOrderError(errorMsg);
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

  const selectedModalOperator = useMemo(
    () => technicians.find((person) => person.id === orderForm.operatorId),
    [orderForm.operatorId, technicians],
  );
  const routineDates = useMemo(
    () => buildRoutineDates(orderForm.routineStartDate, orderForm.routineEndDate, orderForm.routineWeekdays),
    [orderForm.routineEndDate, orderForm.routineStartDate, orderForm.routineWeekdays],
  );
  const locationZones = useMemo(
    () => Array.from(new Set(locations.map((item) => item.zone).filter(Boolean))).sort(),
    [locations],
  );
  const locationBuildings = useMemo(
    () =>
      Array.from(
        new Set(
          locations
            .filter((item) => !orderForm.locationZone || item.zone === orderForm.locationZone)
            .map((item) => item.building)
            .filter(Boolean),
        ),
      ).sort(),
    [locations, orderForm.locationZone],
  );
  const locationAreas = useMemo(
    () =>
      Array.from(
        new Set(
          locations
            .filter((item) => !orderForm.locationZone || item.zone === orderForm.locationZone)
            .filter((item) => !orderForm.locationBuilding || item.building === orderForm.locationBuilding)
            .map((item) => item.area)
            .filter(Boolean),
        ),
      ).sort(),
    [locations, orderForm.locationBuilding, orderForm.locationZone],
  );
  const filteredModalLocations = useMemo(
    () =>
      locations
        .filter((item) => !orderForm.locationZone || item.zone === orderForm.locationZone)
        .filter((item) => !orderForm.locationBuilding || item.building === orderForm.locationBuilding)
        .filter((item) => !orderForm.locationArea || item.area === orderForm.locationArea),
    [locations, orderForm.locationArea, orderForm.locationBuilding, orderForm.locationZone],
  );

  useEffect(() => {
    if (!workOrderModalOpen) return;
    if (!orderForm.locationZone && locationZones.length === 1) {
      setOrderForm((current) => ({ ...current, locationZone: locationZones[0] }));
      return;
    }
    if (!orderForm.locationBuilding && locationBuildings.length === 1) {
      setOrderForm((current) => ({ ...current, locationBuilding: locationBuildings[0] }));
      return;
    }
    if (!orderForm.locationArea && locationAreas.length === 1) {
      setOrderForm((current) => ({ ...current, locationArea: locationAreas[0] }));
      return;
    }
    if (!orderForm.locationId && filteredModalLocations.length === 1) {
      setOrderForm((current) => ({ ...current, locationId: filteredModalLocations[0].id }));
    }
  }, [
    filteredModalLocations,
    locationAreas,
    locationBuildings,
    locationZones,
    orderForm.locationArea,
    orderForm.locationBuilding,
    orderForm.locationId,
    orderForm.locationZone,
    workOrderModalOpen,
  ]);

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
                  <p>Elige si registrarás una OT, OL u OS y completa solo los campos necesarios.</p>
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
                <div className="work-order-modal-section-title">
                  <span>1</span>
                  <div>
                    <h3>Datos de la orden</h3>
                    <p>Define el tipo, prioridad, especialidad y lugar de atención.</p>
                  </div>
                </div>
                <div className="work-order-form-grid">
                  {/* Columna izquierda: tipo, clasificación, activo y ubicación */}
                  <div className="work-order-form-col">
                    <fieldset className="order-kind-picker">
                      <legend>Tipo de orden *</legend>
                      {(["OT", "OL", "OS"] as WorkOrderType[]).map((orderType) => (
                        <button
                          key={orderType}
                          type="button"
                          className={orderForm.orderType === orderType ? "is-selected" : ""}
                          onClick={() => {
                            setOrderForm({
                              ...orderForm,
                              orderType,
                              cleaningMode: orderType === "OL" ? orderForm.cleaningMode : "ESPECIFICA",
                              specialty: orderType === "OL" ? "LIMPIEZA" : orderType === "OS" ? "SERVICIO_EXTERNO" as Specialty : orderForm.specialty,
                              plannedHours: orderType === "OL" ? 1 : orderType === "OS" ? 1 : orderForm.plannedHours,
                            });
                            setAvailabilityOpen(false);
                          }}
                        >
                          {orderType === "OT" ? <Wrench size={18} /> : orderType === "OL" ? <CalendarBlank size={18} /> : <Package size={18} />}
                          <span>
                            <strong>{orderType}</strong>
                            <small>{typeDescriptions[orderType]}</small>
                          </span>
                        </button>
                      ))}
                    </fieldset>

                    <div className="form-group-row">
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

                    {orderForm.orderType === "OS" && (
                      <div className="service-modal-panel">
                        <div className="routine-modal-heading">
                          <strong>Datos del servicio externo</strong>
                          <span>No requiere operario ni supervisor.</span>
                        </div>

                        <label className="field">
                          <span>Proveedor *</span>
                          <input
                            value={orderForm.serviceProvider}
                            onChange={(event) => setOrderForm({ ...orderForm, serviceProvider: event.target.value })}
                            placeholder="Ej. Servicios Generales Andina"
                            maxLength={160}
                          />
                        </label>

                        <div className="form-group-row">
                          <label className="field">
                            <span>Orden de compra o servicio *</span>
                            <input
                              value={orderForm.serviceDocumentCode}
                              onChange={(event) => setOrderForm({ ...orderForm, serviceDocumentCode: event.target.value })}
                              placeholder="Ej. OC-2026-0158"
                              maxLength={80}
                            />
                          </label>

                          <label className="field">
                            <span>Monto *</span>
                            <input
                              value={orderForm.serviceAmount}
                              onChange={(event) => setOrderForm({ ...orderForm, serviceAmount: event.target.value })}
                              inputMode="decimal"
                              placeholder="Ej. 250.00"
                            />
                            <small>Se guardará como costo de servicio.</small>
                          </label>
                        </div>
                      </div>
                    )}

                    {orderForm.orderType === "OL" && (
                      <fieldset className="cleaning-mode-picker">
                        <legend>Tipo de limpieza</legend>
                        <label className={orderForm.cleaningMode === "ESPECIFICA" ? "is-selected" : ""}>
                          <input
                            type="radio"
                            name="cleaningMode"
                            value="ESPECIFICA"
                            checked={orderForm.cleaningMode === "ESPECIFICA"}
                            onChange={() => setOrderForm({ ...orderForm, cleaningMode: "ESPECIFICA" })}
                          />
                          <span>
                            <strong>OL específica</strong>
                            <small>Una limpieza puntual para un ambiente o pedido concreto.</small>
                          </span>
                        </label>
                        <label className={orderForm.cleaningMode === "RUTINARIA" ? "is-selected" : ""}>
                          <input
                            type="radio"
                            name="cleaningMode"
                            value="RUTINARIA"
                            checked={orderForm.cleaningMode === "RUTINARIA"}
                            onChange={() => setOrderForm({ ...orderForm, cleaningMode: "RUTINARIA" })}
                          />
                          <span>
                            <strong>OL rutinaria</strong>
                            <small>Una limpieza programada como rutina para el responsable.</small>
                          </span>
                        </label>
                      </fieldset>
                    )}

                    {orderForm.orderType === "OL" && orderForm.cleaningMode === "RUTINARIA" && (
                      <div className="routine-modal-panel">
                        <div className="routine-modal-heading">
                          <strong>Calendario de rutina</strong>
                          <span>{routineDates.length ? `Se generarán ${routineDates.length} OL.` : "Elige rango y días."}</span>
                        </div>

                        <div className="form-group-row">
                          <label className="field">
                            <span>Fecha de inicio *</span>
                            <input
                              type="date"
                              value={orderForm.routineStartDate}
                              max={orderForm.routineEndDate || undefined}
                              onChange={(event) => setOrderForm({ ...orderForm, routineStartDate: event.target.value, scheduledDate: event.target.value })}
                            />
                          </label>

                          <label className="field">
                            <span>Fecha de fin *</span>
                            <input
                              type="date"
                              value={orderForm.routineEndDate}
                              min={orderForm.routineStartDate || undefined}
                              onChange={(event) => setOrderForm({ ...orderForm, routineEndDate: event.target.value })}
                            />
                          </label>
                        </div>

                        <fieldset className="routine-weekdays compact">
                          <legend>Días de limpieza *</legend>
                          <div>
                            {weekdayOptions.map((day) => (
                              <button
                                key={day.value}
                                type="button"
                                className={orderForm.routineWeekdays.includes(day.value) ? "is-selected" : ""}
                                onClick={() => toggleRoutineWeekday(day.value)}
                              >
                                {day.label}
                              </button>
                            ))}
                          </div>
                          <small>{routineDates.length ? routineDates.slice(0, 5).join(", ") + (routineDates.length > 5 ? "..." : "") : "Selecciona al menos un día."}</small>
                        </fieldset>
                      </div>
                    )}

                    {orderForm.orderType !== "OS" && (
                      <>
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
                                {asset.fmCode || asset.code} - {asset.draft.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      </>
                    )}

                    <div className="location-filter-stack">
                      <div className="work-order-modal-section-title is-compact">
                        <span>3</span>
                        <div>
                          <h3>Ubicación / ambiente</h3>
                          <p>Filtra por partes para no buscar en una lista larga.</p>
                        </div>
                      </div>

                      <div className="form-group-row">
                        <label className="field">
                          <span>Zona</span>
                          <select
                            value={orderForm.locationZone}
                            onChange={(event) => setOrderForm({ ...orderForm, locationZone: event.target.value, locationBuilding: "", locationArea: "", locationId: "" })}
                          >
                            <option value="">Todas las zonas</option>
                            {locationZones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
                          </select>
                        </label>

                        <label className="field">
                          <span>Edificio</span>
                          <select
                            value={orderForm.locationBuilding}
                            onChange={(event) => setOrderForm({ ...orderForm, locationBuilding: event.target.value, locationArea: "", locationId: "" })}
                          >
                            <option value="">Todos los edificios</option>
                            {locationBuildings.map((building) => <option key={building} value={building}>{building}</option>)}
                          </select>
                        </label>
                      </div>

                      <div className="form-group-row">
                        <label className="field">
                          <span>Área</span>
                          <select
                            value={orderForm.locationArea}
                            onChange={(event) => setOrderForm({ ...orderForm, locationArea: event.target.value, locationId: "" })}
                          >
                            <option value="">Todas las áreas</option>
                            {locationAreas.map((area) => <option key={area} value={area}>{area}</option>)}
                          </select>
                        </label>

                        <label className="field">
                          <span>Ambiente</span>
                          <select
                            value={orderForm.locationId}
                            onChange={(event) => setOrderForm({ ...orderForm, locationId: event.target.value })}
                          >
                            <option value="">Seleccionar ambiente...</option>
                            {filteredModalLocations.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.locationCode ? `${item.locationCode} - ` : ""}{item.building} / {item.area} / {item.room}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Columna derecha: responsables, detalles y tiempos */}
                  <div className="work-order-form-col">
                    <div className="work-order-modal-section-title is-compact">
                      <span>2</span>
                      <div>
                        <h3>{orderForm.orderType === "OS" ? "Detalle administrativo" : "Responsables y horario"}</h3>
                        <p>{orderForm.orderType === "OS" ? "Registra la fecha y el alcance del servicio externo." : "Revisa la agenda del operario antes de crear la orden."}</p>
                      </div>
                    </div>

                    {orderForm.orderType !== "OS" && (
                    <div className="form-group-row">
                      <label className="field">
                        <span>Técnico asignado *</span>
                        <select
                          required
                          value={orderForm.operatorId}
                          onChange={(e) => {
                            setOrderForm({ ...orderForm, operatorId: e.target.value });
                            setAvailabilityOpen(false);
                          }}
                        >
                          <option value="">Selecciona técnico...</option>
                          {technicians.map((person) => (
                            <option key={person.id} value={person.id}>
                              {person.full_name} ({person.worker_code})
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="work-order-availability-action">
                        <div>
                          <strong>Disponibilidad del operario</strong>
                          <span>
                            {selectedModalOperator
                              ? `${selectedModalOperator.full_name} · ${orderForm.scheduledDate} · ${orderForm.scheduledStartTime}`
                              : "Selecciona un técnico para revisar su agenda."}
                          </span>
                        </div>
                        <button
                          type="button"
                          className="button button-secondary"
                          disabled={!orderForm.operatorId || availabilityLoading}
                          onClick={() => void toggleAvailabilityPanel()}
                        >
                          <CalendarBlank size={18} />
                          {availabilityLoading ? "Actualizando..." : availabilityOpen ? "Ocultar disponibilidad" : "Ver disponibilidad"}
                        </button>
                      </div>

                      {availabilityOpen && (
                        <OperatorAvailabilityPanel
                          orders={allWorkOrders}
                          operatorId={orderForm.operatorId}
                          operatorName={selectedModalOperator?.full_name}
                          selectedDate={orderForm.scheduledDate}
                          selectedDates={orderForm.orderType === "OL" && orderForm.cleaningMode === "RUTINARIA" ? routineDates : undefined}
                          startTime={orderForm.scheduledStartTime}
                          plannedHours={orderForm.plannedHours}
                        />
                      )}

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
                    )}

                    <label className="field">
                      <span>{orderForm.orderType === "OS" ? "Servicio solicitado *" : "Descripción de la tarea *"}</span>
                      <textarea
                        required
                        rows={3}
                        placeholder={orderForm.orderType === "OS" ? "Describe el servicio externo que realizará el proveedor..." : "Describe la tarea operativa o trabajo de mantenimiento a realizar..."}
                        value={orderForm.description}
                        onChange={(e) => setOrderForm({ ...orderForm, description: e.target.value })}
                      />
                    </label>

                    {orderForm.orderType === "OS" && (
                      <label className="field">
                        <span>Observaciones administrativas</span>
                        <textarea
                          rows={3}
                          placeholder="Detalle opcional para administración."
                          value={orderForm.serviceNotes}
                          onChange={(event) => setOrderForm({ ...orderForm, serviceNotes: event.target.value })}
                        />
                      </label>
                    )}

                  <div className="form-group-row">
                    {!(orderForm.orderType === "OL" && orderForm.cleaningMode === "RUTINARIA") && (
                      <label className="field">
                        <span>Fecha programada *</span>
                        <input
                          type="date"
                          required
                          value={orderForm.scheduledDate}
                          onChange={(e) => setOrderForm({ ...orderForm, scheduledDate: e.target.value })}
                        />
                      </label>
                    )}

                    {orderForm.orderType !== "OS" && (
                    <label className="field">
                      <span>Hora de inicio *</span>
                      <select
                        value={orderForm.scheduledStartTime}
                        onChange={(e) => setOrderForm({ ...orderForm, scheduledStartTime: e.target.value })}
                      >
                        {TIME_SLOTS_12H.map((slot) => (
                          <option key={slot.value} value={slot.value}>
                            {slot.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    )}
                  </div>

                  {orderForm.orderType !== "OS" && (
                  <div className="field">
                    <span>Duración estimada *</span>
                    {manualHoursMode ? (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <input
                          type="number"
                          step="0.5"
                          min="0.25"
                          max="24"
                          required
                          autoFocus
                          placeholder="Ej. 7.5"
                          value={orderForm.plannedHours}
                          onChange={(e) => setOrderForm({ ...orderForm, plannedHours: Number(e.target.value) })}
                        />
                        <button
                          type="button"
                          className="button button-secondary"
                          style={{ height: '42px', padding: '0 12px', fontSize: '13px', whiteSpace: 'nowrap' }}
                          onClick={() => setManualHoursMode(false)}
                        >
                          Ver lista
                        </button>
                      </div>
                    ) : (
                      <select
                        value={PLANNED_HOURS_OPTIONS.some((o) => o.value === orderForm.plannedHours) ? orderForm.plannedHours : "custom"}
                        onChange={(e) => {
                          if (e.target.value === "custom") {
                            setManualHoursMode(true);
                          } else {
                            setOrderForm({ ...orderForm, plannedHours: Number(e.target.value) });
                          }
                        }}
                      >
                        {PLANNED_HOURS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                        <option value="custom">Ingresar manualmente (ej. 7.5 h, 11 h...)</option>
                      </select>
                    )}
                  </div>
                  )}

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
                    <span>{orderSaving ? "Guardando..." : orderForm.orderType === "OS" ? "Crear OS" : "Crear orden operativa"}</span>
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
