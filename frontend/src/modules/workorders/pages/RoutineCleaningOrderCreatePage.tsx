import { ArrowLeft, CalendarBlank, FloppyDisk } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { listTechnicians, type Technician } from "@/modules/accounts/technicianRepository";
import { useLocations } from "@/modules/assets/locationMapQueries";
import {
  ADMIN_PRIORITIES,
  adminPriorityLabels,
  type AdminPriority,
} from "@/modules/workorders/workOrderModel";
import { OperatorAvailabilityPanel, findScheduleConflicts } from "@/modules/workorders/components/OperatorAvailabilityPanel";
import { createWorkOrder, listWorkOrders } from "@/modules/workorders/workOrderRepository";

interface RoutineCleaningFormState {
  description: string;
  locationId: string;
  operatorId: string;
  operatorName: string;
  technicianWorkerCode: string;
  supportingWorkerCodes: string[];
  supervisorId: string;
  supervisorName: string;
  adminPriority: AdminPriority;
  startDate: string;
  endDate: string;
  weekdays: number[];
  scheduledStartTime: string;
  plannedHours: number;
  administratorNotes: string;
}

const supervisors = [
  { id: "USR-SUP-001", name: "Rosa Medina" },
  { id: "USR-SUP-002", name: "Elena Torres" },
];

const weekdayOptions = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mie" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sab" },
  { value: 0, label: "Dom" },
];

const initialForm: RoutineCleaningFormState = {
  description: "",
  locationId: "",
  operatorId: "",
  operatorName: "",
  technicianWorkerCode: "",
  supportingWorkerCodes: [],
  supervisorId: "",
  supervisorName: "",
  adminPriority: "MEDIA",
  startDate: "",
  endDate: "",
  weekdays: [1, 2, 3, 4, 5],
  scheduledStartTime: "08:00",
  plannedHours: 1,
  administratorNotes: "",
};

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

function hasCleaningSpecialty(person: Technician) {
  return person.specialty
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .includes("limpieza");
}

export function RoutineCleaningOrderCreatePage() {
  const navigate = useNavigate();
  const locationsQuery = useLocations();
  const locations = useMemo(() => locationsQuery.data ?? [], [locationsQuery.data]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof listWorkOrders>>>([]);
  const [form, setForm] = useState<RoutineCleaningFormState>(initialForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void listTechnicians().then((people) => setTechnicians(people.filter((person) => person.active)));
    void listWorkOrders().then(setOrders);
  }, []);

  const selectedLocation = locations.find((item) => item.id === form.locationId) ?? null;
  const cleaningTechnicians = useMemo(() => technicians.filter(hasCleaningSpecialty), [technicians]);
  const supportingTechnicians = cleaningTechnicians.filter((person) => person.worker_code !== form.technicianWorkerCode);
  const routineDates = useMemo(
    () => buildRoutineDates(form.startDate, form.endDate, form.weekdays),
    [form.startDate, form.endDate, form.weekdays],
  );

  function updateField<K extends keyof RoutineCleaningFormState>(field: K, value: RoutineCleaningFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function selectTechnician(operator?: Technician | null) {
    setForm((current) => ({
      ...current,
      operatorId: operator?.id ?? "",
      operatorName: operator?.full_name ?? "",
      technicianWorkerCode: operator?.worker_code ?? "",
      supportingWorkerCodes: current.supportingWorkerCodes.filter((code) => code !== operator?.worker_code),
    }));
  }

  useEffect(() => {
    if (cleaningTechnicians.length === 1 && form.operatorId !== cleaningTechnicians[0].id) {
      selectTechnician(cleaningTechnicians[0]);
      return;
    }
    if (form.operatorId && !cleaningTechnicians.some((person) => person.id === form.operatorId)) {
      selectTechnician(null);
    }
  }, [cleaningTechnicians, form.operatorId]);

  function toggleWeekday(day: number) {
    setForm((current) => ({
      ...current,
      weekdays: current.weekdays.includes(day)
        ? current.weekdays.filter((item) => item !== day)
        : [...current.weekdays, day].sort((a, b) => a - b),
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.description.trim() || !form.locationId || !form.operatorId || !form.supervisorId || !form.startDate || !form.endDate || !form.weekdays.length) {
      setError("Completa los campos obligatorios antes de generar la rutina.");
      return;
    }
    if (!routineDates.length) {
      setError("El rango elegido no tiene fechas para los días seleccionados.");
      return;
    }
    if (routineDates.length > 60) {
      setError("Genera máximo 60 OL por vez para mantener la agenda ordenada.");
      return;
    }
    const conflicts = findScheduleConflicts({
      orders,
      operatorId: form.operatorId,
      dates: routineDates,
      startTime: form.scheduledStartTime,
      plannedHours: form.plannedHours,
    });
    if (conflicts.length) {
      setError(`La rutina se cruza con órdenes ya programadas: ${conflicts.slice(0, 4).map((order) => order.code).join(", ")}${conflicts.length > 4 ? "..." : ""}.`);
      return;
    }

    setSaving(true);
    setError("");
    try {
      for (const scheduledDate of routineDates) {
        await createWorkOrder({
          orderType: "OL",
          directRequestDescription: form.description.trim(),
          directRequestType: "OL rutinaria",
          directAssetId: null,
          directLocationId: form.locationId,
          operatorId: form.operatorId,
          operatorName: form.operatorName,
          supervisorId: form.supervisorId,
          supervisorName: form.supervisorName,
          specialty: "LIMPIEZA",
          adminPriority: form.adminPriority,
          status: "PROGRAMADA",
          scheduledDate,
          scheduledStartTime: form.scheduledStartTime,
          technicianWorkerCode: form.technicianWorkerCode,
          technicianWorkerCodes: form.supportingWorkerCodes,
          plannedHours: form.plannedHours,
          administratorNotes: [
            form.administratorNotes.trim(),
            `Rutina generada: ${form.startDate} a ${form.endDate}.`,
          ].filter(Boolean).join("\n"),
          progressPercentage: 0,
        });
      }
      navigate("/ordenes-trabajo?orderType=OL");
    } catch (requestError) {
      const detail = requestError instanceof Error ? requestError.message : "";
      setError(detail || "No se pudo generar la rutina de limpieza.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Mantenimiento / Órdenes / OL rutinaria</p>
          <h1>Crear OL rutinaria</h1>
          <p>Programa varias limpiezas para un ambiente según días y rango de fechas.</p>
        </div>
        <Link className="button button-secondary" to="/órdenes-trabajo/nueva">
          <ArrowLeft size={18} />
          Volver
        </Link>
      </div>

      <form className="data-panel" onSubmit={handleSubmit}>
        <div className="form-section">
          <div className="section-heading">
            <div>
              <span className="section-number">1</span>
              <div>
                <h2>Rutina de limpieza</h2>
                <p>Define el trabajo repetitivo, el ambiente y los días en que debe aparecer en agenda.</p>
              </div>
            </div>
          </div>

          <div className="form-grid">
            <label className="field field-wide">
              <span>Limpieza rutinaria *</span>
              <textarea
                value={form.description}
                onChange={(event) => updateField("description", event.target.value)}
                placeholder="Ej. Limpieza diaria de banos del edificio administrativo."
                rows={4}
                maxLength={1000}
              />
              <small>{form.description.length} / 1000 caracteres</small>
            </label>

            <label className="field">
              <span>Ubicacion *</span>
              <select value={form.locationId} onChange={(event) => updateField("locationId", event.target.value)} disabled={locationsQuery.isPending}>
                <option value="">{locationsQuery.isPending ? "Cargando ubicaciónes..." : "Seleccionar ubicación"}</option>
                {locations.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.locationCode ? `${item.locationCode} - ` : ""}{item.building} / {item.area} / {item.room}
                  </option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Prioridad administrativa *</span>
              <select value={form.adminPriority} onChange={(event) => updateField("adminPriority", event.target.value as AdminPriority)}>
                {ADMIN_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>{adminPriorityLabels[priority]}</option>
                ))}
              </select>
            </label>
          </div>

          {selectedLocation && (
            <dl className="incident-location-summary">
              <div><dt>Ambiente</dt><dd>{selectedLocation.building} / {selectedLocation.area} / {selectedLocation.room}</dd></div>
            </dl>
          )}
        </div>

        <div className="form-section">
          <div className="section-heading">
            <div>
              <span className="section-number">2</span>
              <div>
                <h2>Responsables y calendario</h2>
                <p>El sistema generará una OL por cada fecha que coincida con los días marcados.</p>
              </div>
            </div>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Responsable de limpieza *</span>
              <select
                value={form.operatorId}
                onChange={(event) => {
                  selectTechnician(cleaningTechnicians.find((item) => item.id === event.target.value));
                }}
              >
                <option value="">Seleccionar responsable</option>
                {cleaningTechnicians.map((operator) => (
                  <option key={operator.id} value={operator.id}>{operator.full_name} - {operator.specialty || "Sin especialidad"}</option>
                ))}
              </select>
              {!cleaningTechnicians.length && <small>No hay responsables de limpieza activos. Regístralos en Equipo técnico.</small>}
            </label>

            <div className="field field-wide">
              <OperatorAvailabilityPanel
                orders={orders}
                operatorId={form.operatorId}
                operatorName={form.operatorName}
                selectedDates={routineDates}
                startTime={form.scheduledStartTime}
                plannedHours={form.plannedHours}
                title="Disponibilidad del responsable de limpieza"
              />
            </div>

            <label className="field">
              <span>Apoyo de limpieza</span>
              <select multiple value={form.supportingWorkerCodes} onChange={(event) => updateField("supportingWorkerCodes", Array.from(event.target.selectedOptions).map((option) => option.value))}>
                {supportingTechnicians.map((person) => (
                  <option key={person.id} value={person.worker_code}>{person.full_name} - {person.specialty || "Sin especialidad"}</option>
                ))}
              </select>
              <small>Opcional. Usa Ctrl o Cmd para seleccionar varias personas.</small>
            </label>

            <label className="field">
              <span>Supervisor *</span>
              <select
                value={form.supervisorId}
                onChange={(event) => {
                  const supervisor = supervisors.find((item) => item.id === event.target.value);
                  updateField("supervisorId", supervisor?.id ?? "");
                  updateField("supervisorName", supervisor?.name ?? "");
                }}
              >
                <option value="">Seleccionar supervisor</option>
                {supervisors.map((supervisor) => (
                  <option key={supervisor.id} value={supervisor.id}>{supervisor.name}</option>
                ))}
              </select>
            </label>

            <label className="field">
              <span>Fecha de inicio *</span>
              <input type="date" value={form.startDate} max={form.endDate || undefined} onChange={(event) => updateField("startDate", event.target.value)} />
            </label>

            <label className="field">
              <span>Fecha de fin *</span>
              <input type="date" value={form.endDate} min={form.startDate || undefined} onChange={(event) => updateField("endDate", event.target.value)} />
            </label>

            <label className="field">
              <span>Hora de inicio *</span>
              <input type="time" value={form.scheduledStartTime} onChange={(event) => updateField("scheduledStartTime", event.target.value)} />
            </label>

            <label className="field">
              <span>Horas previstas *</span>
              <input type="number" min={1} max={16} value={form.plannedHours} onChange={(event) => updateField("plannedHours", Number(event.target.value))} />
            </label>

            <fieldset className="field field-wide routine-weekdays">
              <legend>Dias de limpieza *</legend>
              <div>
                {weekdayOptions.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    className={form.weekdays.includes(day.value) ? "is-selected" : ""}
                    onClick={() => toggleWeekday(day.value)}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
              <small>{routineDates.length ? `Se generarán ${routineDates.length} OL.` : "Selecciona rango y días para calcular las OL."}</small>
            </fieldset>

            <label className="field field-wide">
              <span>Indicaciones para limpieza</span>
              <textarea value={form.administratorNotes} onChange={(event) => updateField("administratorNotes", event.target.value)} rows={4} maxLength={1000} />
              <small>{form.administratorNotes.length} / 1000 caracteres</small>
            </label>

          </div>
        </div>

        {routineDates.length > 0 && (
          <article className="routine-preview">
            <CalendarBlank size={22} />
            <div>
              <strong>{routineDates.length} OL programadas</strong>
              <span>{routineDates.slice(0, 6).join(", ")}{routineDates.length > 6 ? "..." : ""}</span>
            </div>
          </article>
        )}

        {error && <div className="form-error">{error}</div>}

        <div className="form-actions">
          <Link className="button button-secondary" to="/órdenes-trabajo/nueva">Cancelar</Link>
          <button className="button button-primary" type="submit" disabled={saving}>
            <FloppyDisk size={18} weight="bold" />
            {saving ? "Generando..." : "Generar rutina"}
          </button>
        </div>
      </form>
    </section>
  );
}


