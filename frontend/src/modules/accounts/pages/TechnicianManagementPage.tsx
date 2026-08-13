import { ArrowLeft, ArrowRight, FloppyDisk, PencilSimple, Plus, UserGear, UsersThree } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createTechnician, listTechnicians, updateTechnician, type Technician, type TechnicianInput } from "@/modules/accounts/technicianRepository";
import { listWorkOrders } from "@/modules/workorders/workOrderRepository";
import { listWorkRequests } from "@/modules/incidents/incidentRepository";
import { listAlmacenes } from "@/modules/almacen/catalogoRepository";
import type { Almacen } from "@/modules/almacen/types";

const SPECIALTIES = ["Electricista", "Gasfitero", "Carpintero", "Soldador", "Mecanico", "Pintor", "Climatizacion", "Limpieza", "Jardineria", "Multitecnico"];
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
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof listWorkOrders>>>([]);
  const [requests, setRequests] = useState<Awaited<ReturnType<typeof listWorkRequests>>>([]);
  const [editing, setEditing] = useState<Technician | null | undefined>();
  const [form, setForm] = useState<TechnicianInput>(emptyForm);
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    const [people, workOrders, workRequests, warehouses] = await Promise.all([
      listTechnicians(), listWorkOrders(), listWorkRequests(), listAlmacenes(),
    ]);
    setTechnicians(people);
    setOrders(workOrders);
    setRequests(workRequests);
    setAlmacenes(warehouses);
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
        <button className="button button-primary" type="button" onClick={() => openEdit()}>
          <Plus size={18} />Nuevo usuario
        </button>
      </header>
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
                      <button className="icon-button" type="button" aria-label={`Editar ${person.full_name}`} onClick={() => openEdit(person)}>
                        <PencilSimple size={18} />
                      </button>
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
    </section>
  );
}