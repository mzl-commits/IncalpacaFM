import { ArrowLeft, ArrowRight, CheckCircle, FloppyDisk, PencilSimple, Plus, UserGear, UsersThree, Wrench, X } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { createTechnician, listTechnicians, updateTechnician, type Technician, type TechnicianInput } from "@/modules/accounts/technicianRepository";
import { createWorkOrder, listWorkOrders } from "@/modules/workorders/workOrderRepository";
import { listWorkRequests } from "@/modules/incidents/incidentRepository";
import { listAlmacenes } from "@/modules/almacen/catalogoRepository";
import type { Almacen } from "@/modules/almacen/types";
import { listRegisteredAssets } from "@/modules/assets/assetEntryRepository";
import { useLocations } from "@/modules/assets/locationMapQueries";
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

const SPECIALTIES_LIST = ["Electricista", "Gasfitero", "Carpintero", "Soldador", "Mecanico", "Pintor", "Climatizacion", "Limpieza", "Jardineria", "Multitecnico"];
const ROLE_OPTIONS: Array<{ value: "TECNICO" | "ALMACENERO" | "INSPECTOR"; label: string }> = [
  { value: "TECNICO", label: "Técnico" },
  { value: "ALMACENERO", label: "Almacenero" },
  { value: "INSPECTOR", label: "Inspector" },
];
const ROLES_CON_ALMACEN: Array<"ALMACENERO" | "INSPECTOR"> = ["ALMACENERO", "INSPECTOR"];
const emptyForm: TechnicianInput = {
  full_name: "", email: "", worker_code: "", dni: "", specialty: "", position: "",
  hourly_rate: 0, active: true, temporary_password: "", role: "TECNICO", almacen: null,
};

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

function mondayOf(date: Date) { const value = new Date(date.getFullYear(), date.getMonth(), date.getDate()); value.setDate(value.getDate() - ((value.getDay() + 6) % 7)); return value; }
function keyFor(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function formatHours(minutes: number) { const hours = Math.floor(minutes / 60); const remainder = minutes % 60; return remainder ? `${hours} h ${remainder} min` : `${hours} h`; }
function registeredMinutes(order: Awaited<ReturnType<typeof listWorkOrders>>[number], start: string, end: string) {
  const sessions = order.workSessions ?? [];
  if (sessions.length) {
    return sessions.reduce((total, session) => {
      const date = new Date(session.startAt);
      const key = keyFor(date);
      if (key < start || key > end) return total;
      return total + Math.max(0, Math.round(((session.endAt ? new Date(session.endAt) : new Date()).getTime() - date.getTime()) / 60000));
    }, 0);
  }
  return 0;
}

export function TechnicianManagementPage() {
  const locationsQuery = useLocations();
  const locations = useMemo(() => locationsQuery.data ?? [], [locationsQuery.data]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof listWorkOrders>>>([]);
  const [requests, setRequests] = useState<Awaited<ReturnType<typeof listWorkRequests>>>([]);
  const [assets, setAssets] = useState<Awaited<ReturnType<typeof listRegisteredAssets>>>([]);
  const [editing, setEditing] = useState<Technician | null | undefined>();
  const [form, setForm] = useState<TechnicianInput>(emptyForm);
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [workOrderModalOpen, setWorkOrderModalOpen] = useState(false);
  const [orderForm, setOrderForm] = useState<WorkOrderFormState>(emptyOrderForm);
  const [orderSaving, setOrderSaving] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState("");

  async function refresh() {
    const [people, workOrders, workRequests, warehouses, assetList] = await Promise.all([
      listTechnicians(),
      listWorkOrders(),
      listWorkRequests(),
      listAlmacenes(),
      listRegisteredAssets().catch(() => []),
    ]);
    setTechnicians(people);
    setOrders(workOrders);
    setRequests(workRequests);
    setAlmacenes(warehouses);
    setAssets(assetList);
  }
  useEffect(() => { void refresh().catch(() => setError("No se pudo cargar el equipo.")); }, []);

  const range = useMemo(() => {
    const end = new Date(weekStart); end.setDate(end.getDate() + 6);
    return {
      start: keyFor(weekStart),
      end: keyFor(end),
      label: `${weekStart.toLocaleDateString("es-PE", { day: "2-digit", month: "short" })} — ${end.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}`,
    };
  }, [weekStart]);

  const workload = (person: Technician) => orders.filter((order) => order.operatorId === person.id && order.scheduledDate >= range.start && order.scheduledDate <= range.end);

  function openEdit(person?: Technician) {
    setEditing(person ?? null);
    setForm(person
      ? {
          full_name: person.full_name,
          email: person.email,
          worker_code: person.worker_code,
          dni: person.dni ?? "",
          specialty: person.specialty,
          position: person.position || "",
          hourly_rate: Number(person.hourly_rate || 0),
          active: person.active,
          temporary_password: "",
          role: person.role ?? "TECNICO",
          almacen: person.almacen ?? null,
        }
      : emptyForm);
    setError("");
  }

  const supervisors = useMemo(() => {
    const sups = technicians.filter(
      (t) => t.role === "SUPERVISOR" || t.role === "ADMINISTRADOR"
    );
    return sups.length ? sups : technicians;
  }, [technicians]);

  function openWorkOrderModal(operatorId = "") {
    const defaultSup = supervisors[0];
    setOrderForm({
      ...emptyOrderForm,
      operatorId: operatorId || (technicians[0]?.id ?? ""),
      supervisorId: defaultSup?.id ?? "",
      scheduledDate: new Date().toISOString().split("T")[0],
    });
    setWorkOrderModalOpen(true);
    setOrderSuccess("");
    setError("");
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
      setError("Ingresa la descripción o motivo de la orden operativa.");
      return;
    }
    setOrderSaving(true);
    setError("");
    setOrderSuccess("");
    try {
      const selectedOperator = technicians.find((t) => t.id === orderForm.operatorId);
      const selectedAsset = assets.find((a) => a.id === orderForm.assetId);
      const selectedSupervisor = supervisors.find((s) => s.id === orderForm.supervisorId);

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

      await refresh();
      setWorkOrderModalOpen(false);
      setOrderSuccess("Orden operativa registrada exitosamente.");
      setTimeout(() => setOrderSuccess(""), 4000);
    } catch {
      setError("No se pudo crear la orden operativa. Inténtalo nuevamente.");
    } finally {
      setOrderSaving(false);
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (ROLES_CON_ALMACEN.includes(form.role as "ALMACENERO" | "INSPECTOR") && !form.almacen) {
      setError("Selecciona un almacén para este rol.");
      return;
    }
    setSaving(true);
    try {
      const input = { ...form, temporary_password: form.temporary_password || undefined };
      if (editing) await updateTechnician(editing.id, input);
      else if (input.temporary_password) await createTechnician(input);
      else { setError("Define una contraseña temporal para el nuevo usuario."); return; }
      await refresh();
      setEditing(undefined);
    } catch (requestError) {
      const detail = requestError instanceof Error ? requestError.message : "";
      setError(detail || "No se pudo guardar el perfil.");
    } finally {
      setSaving(false);
    }
  }

  const roleLabel = (role: "TECNICO" | "ALMACENERO" | "INSPECTOR") =>
    role === "ALMACENERO" ? "Almacenero" : role === "INSPECTOR" ? "Inspector" : "Técnico";

  return (
    <section className="technician-management-page">
      <header className="page-heading">
        <div>
          <p className="breadcrumb">Administración / Personal operativo</p>
          <h1>Personal operativo</h1>
          <p>Gestiona técnicos, almaceneros e inspectores. Abre el detalle para revisar agenda, horas, tarifas y satisfacción.</p>
        </div>
        <div className="header-actions-group" style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button className="button button-primary" type="button" onClick={() => openWorkOrderModal()}>
            <Wrench size={18} weight="bold" />
            <span>Agregar orden operativa</span>
          </button>
          <button className="button button-secondary" type="button" onClick={() => openEdit()}>
            <Plus size={18} weight="bold" />
            <span>Nuevo usuario</span>
          </button>
        </div>
      </header>
      {orderSuccess && (
        <div className="form-success-banner" style={{ background: "#E8F5E9", border: "1px solid #C8E6C9", color: "#2E7D32", padding: "12px 16px", borderRadius: "8px", marginBottom: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
          <CheckCircle size={20} weight="bold" />
          <span>{orderSuccess}</span>
        </div>
      )}
      {error && <div className="form-error" role="alert">{error}</div>}

      <section className="technician-admin-week">
        <button className="icon-button" type="button" aria-label="Semana anterior" onClick={() => setWeekStart((date) => new Date(date.getFullYear(), date.getMonth(), date.getDate() - 7))}><ArrowLeft /></button>
        <strong>{range.label}</strong>
        <button className="icon-button" type="button" aria-label="Semana siguiente" onClick={() => setWeekStart((date) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7))}><ArrowRight /></button>
      </section>

      <section className="planning-queue data-panel">
        <header>
          <div><h2>Reportes listos para asignar</h2><p>Solo aparecen después de la evaluación y antes de crear una OT.</p></div>
          <Link to="/ordenes-trabajo/recomendaciones">Ver recomendaciones</Link>
        </header>
        {requests.filter((request) => request.status === "APROBADA").map((request) => (
          <Link key={request.id} to={`/ordenes-trabajo/nueva/${request.id}`}>
            <strong>{request.code}</strong><span>{request.assetDisplayCode || request.assetCode || "Sin bien"}</span>
            <small>{request.description}</small><b>Programar OT →</b>
          </Link>
        )) || <p>Sin reportes aprobados pendientes.</p>}
      </section>

      <section className="technician-directory data-panel">
        <header>
          <div><h2>Técnicos, almaceneros e inspectores</h2><p>Selecciona cualquier fila para ver el detalle. Editar es una acción secundaria.</p></div>
          <UsersThree size={24} />
        </header>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Cargo / especialidad</th>
                <th>Agenda semanal</th>
                <th>Horas registradas</th>
                <th>Tarifa / cuota</th>
                <th>Estado</th>
                <th aria-label="Acciones" />
              </tr>
            </thead>
            <tbody>
              {technicians.map((person) => {
                const assigned = workload(person);
                const planned = assigned.reduce((sum, order) => sum + order.plannedHours * 60, 0);
                const workedMinutes = orders.filter((order) => order.operatorId === person.id).reduce((sum, order) => sum + registeredMinutes(order, range.start, range.end), 0);
                const totalWorkedMinutes = orders.filter((order) => order.operatorId === person.id).reduce((total, order) => total + (order.effectiveWorkMinutes || 0), 0);
                const difference = planned - workedMinutes;
                const cost = (totalWorkedMinutes / 60) * Number(person.hourly_rate || 0);
                return (
                  <tr key={person.id} className="technician-directory-row">
                    <td>
                      <Link className="technician-detail-link" to={`/administracion/tecnicos/${person.id}`}>
                        <strong>{person.full_name}</strong><small>{person.worker_code}</small>
                      </Link>
                    </td>
                    <td>
                      <span className={`status ${person.role === "ALMACENERO" ? "status-info" : person.role === "INSPECTOR" ? "status-warning" : "status-neutral"}`}>
                        {roleLabel(person.role ?? "TECNICO")}
                      </span>
                    </td>
                    <td>
                      {person.position || "Sin cargo"}
                      <small>{person.specialty || "Sin especialidad"}</small>
                      {person.almacen_nombre && <small>📦 {person.almacen_nombre}</small>}
                    </td>
                    <td>
                      <strong>{assigned.length} OT · {formatHours(planned)}</strong>
                      <small>{assigned.map((order) => order.code).join(", ") || "Sin tareas"}</small>
                    </td>
                    <td>
                      <strong>{formatHours(workedMinutes)}</strong>
                      <small className={`technician-hours-difference ${difference > 0 ? "is-pending" : difference < 0 ? "is-extra" : "is-balanced"}`}>
                        {difference === 0 ? "Al día" : difference > 0 ? `${formatHours(difference)} pendiente` : `${formatHours(-difference)} adicional`}
                      </small>
                    </td>
                    <td>
                      <strong>S/ {Number(person.hourly_rate || 0).toFixed(2)}/h</strong>
                      <small>S/ {cost.toFixed(2)} acumulado</small>
                    </td>
                    <td><span className={`status ${person.active ? "status-success" : "status-neutral"}`}>{person.active ? "Activo" : "Inactivo"}</span></td>
                    <td>
                      <div style={{ display: "flex", gap: "6px", alignItems: "center", justifyContent: "flex-end" }}>
                        <button className="icon-button" type="button" title={`Asignar OT a ${person.full_name}`} onClick={() => openWorkOrderModal(person.id)}>
                          <Wrench size={17} />
                        </button>
                        <button className="icon-button" type="button" aria-label={`Editar ${person.full_name}`} onClick={() => openEdit(person)}>
                          <PencilSimple size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {editing !== undefined && (
        <aside className="technician-editor modal-widget" aria-labelledby="technician-editor-title">
          <header>
            <UserGear size={24} />
            <div>
              <h2 id="technician-editor-title">{editing ? "Editar usuario" : "Registrar usuario"}</h2>
              <p>Actualiza solo los datos necesarios.</p>
            </div>
            <button className="icon-button" type="button" aria-label="Cerrar edición" onClick={() => setEditing(undefined)}>×</button>
          </header>
          <form onSubmit={save}>
            <label className="field">
              <span>Nombre completo *</span>
              <input required value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} />
            </label>
            <label className="field">
              <span>Código de trabajador *</span>
              <input required value={form.worker_code} onChange={(event) => setForm({ ...form, worker_code: event.target.value })} />
            </label>
            <label className="field">
              <span>DNI</span>
              <input maxLength={8} value={form.dni} onChange={(event) => setForm({ ...form, dni: event.target.value })} />
            </label>
            <label className="field">
              <span>Correo</span>
              <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </label>
            <label className="field">
              <span>Rol *</span>
              <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as "TECNICO" | "ALMACENERO" | "INSPECTOR" })}>
                {ROLE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </label>
            {ROLES_CON_ALMACEN.includes(form.role as "ALMACENERO" | "INSPECTOR") && (
              <label className="field">
                <span>Almacén asignado *</span>
                <select
                  value={form.almacen ?? ""}
                  onChange={(event) => setForm({ ...form, almacen: event.target.value ? Number(event.target.value) : null })}
                >
                  <option value="">Selecciona un almacén…</option>
                  {almacenes.map((a) => (
                    <option key={a.id} value={a.id}>{a.nombre}</option>
                  ))}
                </select>
                <small>Solo podrá operar sobre este almacén.</small>
              </label>
            )}
            <label className="field">
              <span>Cargo / posición</span>
              <input placeholder="Jefe, ayudante, especialista..." value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value })} />
            </label>
            {form.role === "TECNICO" && (
              <label className="field">
                <span>Especialidad</span>
                <select value={form.specialty} onChange={(event) => setForm({ ...form, specialty: event.target.value })}>
                  <option value="">Selecciona una especialidad</option>
                  {SPECIALTIES.map((item) => <option key={item}>{item}</option>)}
                </select>
              </label>
            )}
            <label className="field">
              <span>Tarifa por hora (S/)</span>
              <input type="number" min="0" step="0.01" value={form.hourly_rate} onChange={(event) => setForm({ ...form, hourly_rate: Number(event.target.value) })} />
              <small>Se multiplica por las horas efectivamente registradas.</small>
            </label>
            <label className="field">
              <span>{editing ? "Nueva contraseña temporal" : "Contraseña temporal *"}</span>
              <input type="password" minLength={10} required={!editing} value={form.temporary_password ?? ""} onChange={(event) => setForm({ ...form, temporary_password: event.target.value })} />
            </label>
            <label className="switch-row">
              <input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />
              <span><strong>Perfil activo</strong><small>Puede recibir asignaciones y notificaciones.</small></span>
            </label>
            <button className="button button-primary" disabled={saving}>
              <FloppyDisk size={18} />{saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </form>
        </aside>
      )}

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

                {error && <div className="form-error" role="alert">{error}</div>}

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