import { CalendarBlank, FloppyDisk, Wrench, X } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { useAuth } from "@/modules/accounts/AuthContext";
import { listTechnicians, type Technician } from "@/modules/accounts/technicianRepository";
import { listRegisteredAssets } from "@/modules/assets/assetEntryRepository";
import { useLocations } from "@/modules/assets/locationMapQueries";
import type { LocationOption } from "@/modules/assets/locationMapTypes";
import {
  ADMIN_PRIORITIES,
  SPECIALTIES,
  adminPriorityLabels,
  specialtyLabels,
  workOrderTypeLabels,
  type AdminPriority,
  type Specialty,
  type WorkOrderType,
} from "@/modules/workorders/workOrderModel";
import { createWorkOrder, type listWorkOrders } from "@/modules/workorders/workOrderRepository";
import { OperatorAvailabilityPanel, findScheduleConflicts } from "@/modules/workorders/components/OperatorAvailabilityPanel";
import type { WorkOrder } from "@/modules/workorders/components/WorkOrderListTable";

// ─── Constants & Types ────────────────────────────────────────────────────────

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
  locationSite: string;
  locationZone: string;
  locationBuilding: string;
  locationArea: string;
}

const emptyOrderForm: WorkOrderFormState = {
  title: "",
  description: "",
  assetId: "",
  locationId: "",
  operatorId: "",
  supervisorId: "",
  specialty: "ELECTRICIDAD",
  orderType: "OT",
  cleaningMode: "ESPECIFICA",
  priority: "MEDIA",
  scheduledDate: "",
  routineStartDate: new Date().toISOString().split("T")[0],
  routineEndDate: new Date().toISOString().split("T")[0],
  routineWeekdays: [1, 2, 3, 4, 5],
  scheduledStartTime: "08:00",
  plannedHours: 2,
  locationSite: "",
  locationZone: "",
  locationBuilding: "",
  locationArea: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function locationSite(location: LocationOption) {
  return location.site || "Sede principal";
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "es-PE"));
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

// ─── Component ────────────────────────────────────────────────────────────────

interface WorkOrderCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  allWorkOrders: WorkOrder[];
}

export function WorkOrderCreateModal({
  isOpen,
  onClose,
  onSuccess,
  allWorkOrders,
}: WorkOrderCreateModalProps) {
  const { user } = useAuth();
  const [orderForm, setOrderForm] = useState<WorkOrderFormState>(emptyOrderForm);
  const [orderSaving, setOrderSaving] = useState(false);
  const [orderError, setOrderError] = useState("");
  const [manualHoursMode, setManualHoursMode] = useState(false);
  const [availabilityOpen, setAvailabilityOpen] = useState(false);

  // Aux data
  const locationsQuery = useLocations();
  const locations = useMemo(() => locationsQuery.data ?? [], [locationsQuery.data]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [assets, setAssets] = useState<Awaited<ReturnType<typeof listRegisteredAssets>>>([]);

  useEffect(() => {
    if (!isOpen) return;
    async function loadAuxiliaryData() {
      try {
        const [people, assetList] = await Promise.all([
          listTechnicians().catch(() => []),
          listRegisteredAssets().catch(() => []),
        ]);
        setTechnicians(people);
        setAssets(assetList);

        const activeTechs = people.length ? people : technicians;
        const defaultOperator =
          activeTechs.find((t) => t.email === user?.email || t.worker_code === user?.workerCode) ||
          activeTechs[0];
        const sups = activeTechs.filter((t) => t.role === "SUPERVISOR" || t.role === "ADMINISTRADOR");
        const defaultSup = sups.length ? sups[0] : activeTechs[0];

        setOrderForm({
          ...emptyOrderForm,
          operatorId: "",
          supervisorId: defaultSup?.id ?? "",
          scheduledDate: "",
        });
      } catch {
        // keep empty
      }
    }
    setOrderError("");
    setAvailabilityOpen(false);
    void loadAuxiliaryData();
  }, [isOpen, user]);

  const supervisors = useMemo(() => {
    const sups = technicians.filter((t) => t.role === "SUPERVISOR" || t.role === "ADMINISTRADOR");
    return sups.length ? sups : technicians;
  }, [technicians]);

  const locationSites = useMemo(() => uniqueSorted(locations.map(locationSite)), [locations]);
  const locationZones = useMemo(
    () =>
      uniqueSorted(
        locations
          .filter((item) => !orderForm.locationSite || locationSite(item) === orderForm.locationSite)
          .map((item) => item.zone),
      ),
    [locations, orderForm.locationSite],
  );
  const locationAreas = useMemo(
    () =>
      uniqueSorted(
        locations
          .filter((item) => !orderForm.locationSite || locationSite(item) === orderForm.locationSite)
          .filter((item) => !orderForm.locationZone || item.zone === orderForm.locationZone)
          .map((item) => item.area),
      ),
    [locations, orderForm.locationSite, orderForm.locationZone],
  );
  const filteredModalLocations = useMemo(
    () =>
      locations
        .filter((item) => !orderForm.locationSite || locationSite(item) === orderForm.locationSite)
        .filter((item) => !orderForm.locationZone || item.zone === orderForm.locationZone)
        .filter((item) => !orderForm.locationArea || item.area === orderForm.locationArea),
    [locations, orderForm.locationArea, orderForm.locationSite, orderForm.locationZone],
  );

  useEffect(() => {
    if (!isOpen) return;
    if (!orderForm.locationSite && locationSites.length === 1) {
      setOrderForm((current) => ({ ...current, locationSite: locationSites[0] }));
      return;
    }
    if (!orderForm.locationZone && locationZones.length === 1) {
      setOrderForm((current) => ({ ...current, locationZone: locationZones[0] }));
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
    locationSites,
    locationZones,
    orderForm.locationArea,
    orderForm.locationId,
    orderForm.locationSite,
    orderForm.locationZone,
    isOpen,
  ]);

  const selectedModalOperator = useMemo(
    () => technicians.find((person) => person.id === orderForm.operatorId),
    [orderForm.operatorId, technicians],
  );
  const routineDates = useMemo(
    () => buildRoutineDates(orderForm.routineStartDate, orderForm.routineEndDate, orderForm.routineWeekdays),
    [orderForm.routineEndDate, orderForm.routineStartDate, orderForm.routineWeekdays],
  );

  function handleSelectAsset(assetId: string) {
    const asset = assets.find((a) => a.id === assetId);
    const assetLocation = locations.find((item) => item.id === asset?.locationDetail?.id);
    setOrderForm((prev) => ({
      ...prev,
      assetId,
      locationId: assetLocation?.id || prev.locationId,
      locationSite: assetLocation ? locationSite(assetLocation) : prev.locationSite,
      locationZone: assetLocation?.zone || prev.locationZone,
      locationBuilding: assetLocation?.building || prev.locationBuilding,
      locationArea: assetLocation?.area || prev.locationArea,
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

  function toggleAvailabilityPanel() {
    if (!orderForm.operatorId) return;
    setAvailabilityOpen(!availabilityOpen);
  }

  async function saveWorkOrder(event: React.FormEvent) {
    event.preventDefault();
    if (!orderForm.description.trim()) {
      setOrderError("Ingresa la descripción o motivo de la orden operativa.");
      return;
    }
    const isRoutineCleaning = orderForm.orderType === "OL" && orderForm.cleaningMode === "RUTINARIA";
    if (
      isRoutineCleaning &&
      (!orderForm.routineStartDate || !orderForm.routineEndDate || !orderForm.routineWeekdays.length)
    ) {
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
        setOrderError(
          `La rutina se cruza con órdenes ya programadas: ${conflicts.slice(0, 4).map((order) => order.code).join(", ")}${conflicts.length > 4 ? "..." : ""}.`,
        );
        return;
      }
    }
    setOrderSaving(true);
    setOrderError("");

    try {
      const selectedOperator = technicians.find((t) => t.id === orderForm.operatorId) || technicians[0];
      const selectedAsset = assets.find((a) => a.id === orderForm.assetId);
      const selectedSupervisor = supervisors.find((s) => s.id === orderForm.supervisorId) || technicians[0];
      const defaultLocationId = locations[0]?.id || "";
      const locationId = orderForm.locationId || selectedAsset?.locationDetail?.id || defaultLocationId;
      const datesToCreate = isRoutineCleaning
        ? routineDates
        : [orderForm.scheduledDate || new Date().toISOString().split("T")[0]];

      for (const scheduledDate of datesToCreate) {
        await createWorkOrder({
          orderType: orderForm.orderType,
          description: orderForm.description.trim(),
          directRequestDescription: orderForm.description.trim(),
          directRequestType: isRoutineCleaning ? "OL rutinaria" : undefined,
          title: orderForm.title.trim() || orderForm.description.trim().substring(0, 40),
          assetId: orderForm.assetId || undefined,
          directAssetId: orderForm.assetId || null,
          assetCode: selectedAsset ? selectedAsset.fmCode || selectedAsset.code : undefined,
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
          status: (!orderForm.operatorId || !scheduledDate) ? "PENDIENTE_REPROGRAMACION" : "PROGRAMADA",
        });
      }

      onSuccess(
        isRoutineCleaning
          ? `${datesToCreate.length} OL rutinaria(s) registradas exitosamente.`
          : "Orden operativa registrada exitosamente.",
      );
    } catch (err: any) {
      const serverDetail =
        err?.response?.data?.detail ||
        err?.response?.data?.directLocationId ||
        err?.response?.data?.scheduledStartTime;
      const errorMsg =
        typeof serverDetail === "string"
          ? serverDetail
          : Array.isArray(serverDetail)
            ? serverDetail[0]
            : "No se pudo crear la orden operativa. Revisa los campos obligatorios.";
      setOrderError(errorMsg);
    } finally {
      setOrderSaving(false);
    }
  }

  if (!isOpen) return null;

  return createPortal(
    <div
      className="work-order-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        className="technician-editor modal-widget work-order-modal-widget"
        aria-labelledby="work-order-modal-title"
      >
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
            onClick={onClose}
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
            <div className="work-order-form-col">
              <div className="form-group-row">
                <label className="field">
                  <span>Tipo de orden *</span>
                  <select
                    value={orderForm.orderType}
                    onChange={(e) => {
                      const orderType = e.target.value as WorkOrderType;
                      setOrderForm({
                        ...orderForm,
                        orderType,
                        cleaningMode: orderType === "OL" ? orderForm.cleaningMode : "ESPECIFICA",
                        specialty: orderType === "OL" ? "LIMPIEZA" : orderForm.specialty,
                        plannedHours: orderType === "OL" ? 1 : orderForm.plannedHours,
                      });
                    }}
                  >
                    {Object.entries(workOrderTypeLabels).map(([code, name]) => (
                      <option key={code} value={code}>
                        {code} - {name}
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
                    <span>
                      {routineDates.length ? `Se generarán ${routineDates.length} OL.` : "Elige rango y días."}
                    </span>
                  </div>

                  <div className="form-group-row">
                    <label className="field">
                      <span>Fecha de inicio *</span>
                      <input
                        type="date"
                        value={orderForm.routineStartDate}
                        max={orderForm.routineEndDate || undefined}
                        onChange={(event) =>
                          setOrderForm({
                            ...orderForm,
                            routineStartDate: event.target.value,
                            scheduledDate: event.target.value,
                          })
                        }
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
                    <small>
                      {routineDates.length
                        ? routineDates.slice(0, 5).join(", ") + (routineDates.length > 5 ? "..." : "")
                        : "Selecciona al menos un día."}
                    </small>
                  </fieldset>
                </div>
              )}

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
                <select value={orderForm.assetId} onChange={(e) => handleSelectAsset(e.target.value)}>
                  <option value="">Sin bien asociado</option>
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.fmCode || asset.code} - {asset.draft.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="location-filter-stack">
                <div className="work-order-modal-section-title is-compact">
                  <span>3</span>
                  <div>
                    <h3>Ubicación / ambiente</h3>
                    <p>Selecciona la sede, área macro, área y módulo/ambiente final.</p>
                  </div>
                </div>

                <div className="form-group-row">
                  <label className="field">
                    <span>Sede</span>
                    <select
                      value={orderForm.locationSite}
                      onChange={(event) =>
                        setOrderForm({
                          ...orderForm,
                          locationSite: event.target.value,
                          locationZone: "",
                          locationBuilding: "",
                          locationArea: "",
                          locationId: "",
                        })
                      }
                    >
                      <option value="">Seleccionar sede...</option>
                      {locationSites.map((site) => (
                        <option key={site} value={site}>
                          {site}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>Área macro</span>
                    <select
                      value={orderForm.locationZone}
                      disabled={!orderForm.locationSite}
                      onChange={(event) =>
                        setOrderForm({
                          ...orderForm,
                          locationZone: event.target.value,
                          locationBuilding: "",
                          locationArea: "",
                          locationId: "",
                        })
                      }
                    >
                      <option value="">Seleccionar área macro...</option>
                      {locationZones.map((zone) => (
                        <option key={zone} value={zone}>
                          {zone}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="form-group-row">
                  <label className="field">
                    <span>Área</span>
                    <select
                      value={orderForm.locationArea}
                      disabled={!orderForm.locationZone}
                      onChange={(event) =>
                        setOrderForm({ ...orderForm, locationArea: event.target.value, locationId: "" })
                      }
                    >
                      <option value="">Seleccionar área...</option>
                      {locationAreas.map((area) => (
                        <option key={area} value={area}>
                          {area}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="field">
                    <span>Módulo / ambiente de trabajo</span>
                    <select
                      value={orderForm.locationId}
                      disabled={!orderForm.locationArea}
                      onChange={(event) => setOrderForm({ ...orderForm, locationId: event.target.value })}
                    >
                      <option value="">Seleccionar módulo...</option>
                      {filteredModalLocations.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.locationCode ? `${item.locationCode} - ` : ""}
                          {item.area} / {item.room}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            </div>

            <div className="work-order-form-col">
              <div className="work-order-modal-section-title is-compact">
                <span>2</span>
                <div>
                  <h3>Responsables y horario</h3>
                  <p>Revisa la agenda del operario antes de crear la orden.</p>
                </div>
              </div>

              <div className="form-group-row">
                <label className="field">
                  <span>Técnico asignado (Opcional)</span>
                  <select
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
                    disabled={false}
                    onClick={() => void toggleAvailabilityPanel()}
                  >
                    <CalendarBlank size={18} />
                    {availabilityOpen ? "Ocultar disponibilidad" : "Ver disponibilidad"}
                  </button>
                </div>

                {availabilityOpen && (
                  <OperatorAvailabilityPanel
                    orders={allWorkOrders}
                    operatorId={orderForm.operatorId}
                    operatorName={selectedModalOperator?.full_name}
                    selectedDate={orderForm.scheduledDate}
                    selectedDates={
                      orderForm.orderType === "OL" && orderForm.cleaningMode === "RUTINARIA"
                        ? routineDates
                        : undefined
                    }
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
                {!(orderForm.orderType === "OL" && orderForm.cleaningMode === "RUTINARIA") && (
                  <label className="field">
                    <span>Fecha programada (Opcional)</span>
                    <input
                        type="date"
                        value={orderForm.scheduledDate}
                      onChange={(e) => setOrderForm({ ...orderForm, scheduledDate: e.target.value })}
                    />
                  </label>
                )}

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
              </div>

              <div className="field">
                <span>Duración estimada *</span>
                {manualHoursMode ? (
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
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
                      style={{ height: "42px", padding: "0 12px", fontSize: "13px", whiteSpace: "nowrap" }}
                      onClick={() => setManualHoursMode(false)}
                    >
                      Ver lista
                    </button>
                  </div>
                ) : (
                  <select
                    value={
                      PLANNED_HOURS_OPTIONS.some((o) => o.value === orderForm.plannedHours)
                        ? orderForm.plannedHours
                        : "custom"
                    }
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
            </div>
          </div>

          {orderError && (
            <div className="form-error" role="alert">
              {orderError}
            </div>
          )}

          <div className="modal-actions-bar">
            <button type="button" className="button button-secondary" onClick={onClose}>
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
  );
}
