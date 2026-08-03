import { ArrowLeft, ArrowRight, FloppyDisk, Plus, UserGear, UsersThree } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";

import { listWorkOrders } from "@/modules/workorders/workOrderRepository";
import {
  createTechnician,
  listTechnicians,
  updateTechnician,
  type Technician,
  type TechnicianInput,
} from "@/modules/accounts/technicianRepository";

const SPECIALTIES = ["Electricista", "Gasfitero", "Carpintero", "Soldador", "Mecánico", "Pintor", "Climatización", "Multitécnico"];
const emptyForm: TechnicianInput = { full_name: "", email: "", worker_code: "", specialty: "", active: true, temporary_password: "" };

function mondayOf(date: Date) {
  const value = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  value.setDate(value.getDate() - ((value.getDay() + 6) % 7));
  return value;
}
function keyFor(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function formatHours(minutes: number) { const hours = Math.floor(minutes / 60); const remainder = minutes % 60; return remainder ? `${hours} h ${remainder} min` : `${hours} h`; }
function registeredMinutes(order: Awaited<ReturnType<typeof listWorkOrders>>[number], start: string, end: string) {
  const sessions = order.workSessions ?? [];
  if (sessions.length) return sessions.reduce((total, session) => {
    const sessionStart = new Date(session.startAt);
    const key = keyFor(sessionStart);
    if (key < start || key > end) return total;
    const sessionEnd = session.endAt ? new Date(session.endAt) : new Date();
    return total + Math.max(0, Math.round((sessionEnd.getTime() - sessionStart.getTime()) / 60000));
  }, 0);
  return (order.advances ?? []).filter((advance) => {
    const key = advance.createdAt.slice(0, 10);
    return key >= start && key <= end;
  }).reduce((sum, advance) => sum + (advance.workedMinutes ?? 0), 0);
}

export function TechnicianManagementPage() {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof listWorkOrders>>>([]);
  const [selected, setSelected] = useState<Technician>();
  const [form, setForm] = useState<TechnicianInput>(emptyForm);
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    const [nextTechnicians, nextOrders] = await Promise.all([listTechnicians(), listWorkOrders()]);
    setTechnicians(nextTechnicians); setOrders(nextOrders);
  }
  useEffect(() => { void refresh().catch(() => setError("No se pudo cargar el equipo técnico.")); }, []);

  const range = useMemo(() => {
    const end = new Date(weekStart); end.setDate(end.getDate() + 6);
    return { start: keyFor(weekStart), end: keyFor(end), label: `${weekStart.toLocaleDateString("es-PE", { day: "2-digit", month: "short" })} — ${end.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })}` };
  }, [weekStart]);
  const workload = (technician: Technician) => orders.filter((order) => order.operatorId === technician.id && order.scheduledDate >= range.start && order.scheduledDate <= range.end);
  const workedMinutes = (technician: Technician) => orders
    .filter((order) => order.operatorId === technician.id)
    .reduce((total, order) => total + registeredMinutes(order, range.start, range.end), 0);

  function selectTechnician(technician: Technician) {
    setSelected(technician);
    setForm({
      full_name: technician.full_name,
      email: technician.email,
      worker_code: technician.worker_code,
      specialty: technician.specialty,
      active: technician.active,
      temporary_password: "",
    });
    setError("");
  }
  function newTechnician() { setSelected(undefined); setForm(emptyForm); setError(""); }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setSaving(true); setError("");
    try {
      const payload = { ...form, temporary_password: form.temporary_password || undefined };
      if (selected) await updateTechnician(selected.id, payload);
      else if (!payload.temporary_password) { setError("Define una contraseña temporal para el nuevo técnico."); return; }
      else await createTechnician(payload);
      await refresh(); newTechnician();
    } catch { setError("No se pudo guardar. Revisa el código, correo y los campos obligatorios."); }
    finally { setSaving(false); }
  }

  return <section className="technician-management-page">
    <header className="page-heading"><div><p className="breadcrumb">Administración / Técnicos</p><h1>Equipo técnico</h1><p>Administra perfiles y revisa la carga programada de cada técnico.</p></div><button className="button button-primary" type="button" onClick={newTechnician}><Plus size={18} />Nuevo técnico</button></header>
    {error && <div className="form-error" role="alert">{error}</div>}
    <section className="technician-admin-week"><button className="icon-button" type="button" aria-label="Semana anterior" onClick={() => setWeekStart((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() - 7))}><ArrowLeft /></button><strong>{range.label}</strong><button className="icon-button" type="button" aria-label="Semana siguiente" onClick={() => setWeekStart((current) => new Date(current.getFullYear(), current.getMonth(), current.getDate() + 7))}><ArrowRight /></button></section>
    <div className="technician-management-layout">
      <section className="technician-directory data-panel" aria-labelledby="technician-directory-title"><header><div><h2 id="technician-directory-title">Técnicos y carga semanal</h2><p>Compara lo programado con las horas registradas.</p></div><UsersThree size={24} /></header><div className="table-scroll"><table><thead><tr><th>Técnico</th><th>Especialidad</th><th>Agenda</th><th>Registrado</th><th>Diferencia</th><th>Estado</th></tr></thead><tbody>{technicians.map((technician) => { const assigned = workload(technician); const plannedMinutes = assigned.reduce((sum, order) => sum + (order.plannedHours || 2) * 60, 0); const technicianMinutes = workedMinutes(technician); const difference = plannedMinutes - technicianMinutes; return <tr key={technician.id} className={selected?.id === technician.id ? "is-selected" : ""} onClick={() => selectTechnician(technician)}><td><strong>{technician.full_name}</strong><small>{technician.worker_code}</small></td><td>{technician.specialty || "Sin especialidad"}</td><td><strong>{assigned.length} OT · {formatHours(plannedMinutes)}</strong><small>{assigned.map((order) => order.code).join(", ") || "Sin tareas"}</small></td><td><strong>{formatHours(technicianMinutes)}</strong><small>Sesiones registradas</small></td><td><span className={`technician-hours-difference ${difference > 0 ? "is-pending" : difference < 0 ? "is-extra" : "is-balanced"}`}>{difference === 0 ? "Al día" : difference > 0 ? `${formatHours(difference)} pendiente` : `${formatHours(Math.abs(difference))} adicional`}</span></td><td><span className={`status ${technician.active ? "status-success" : "status-neutral"}`}>{technician.active ? "Activo" : "Inactivo"}</span></td></tr>; })}</tbody></table></div></section>
      <aside className="technician-editor" aria-labelledby="technician-editor-title"><header><UserGear size={24} /><div><h2 id="technician-editor-title">{selected ? "Editar técnico" : "Registrar técnico"}</h2><p>{selected ? "Actualiza perfil, especialidad o disponibilidad." : "El acceso temporal deberá cambiarse al iniciar sesión."}</p></div></header><form onSubmit={save}><label className="field"><span>Nombre completo *</span><input required value={form.full_name} onChange={(event) => setForm({ ...form, full_name: event.target.value })} /></label><label className="field"><span>Código de trabajador *</span><input required value={form.worker_code} onChange={(event) => setForm({ ...form, worker_code: event.target.value })} /></label><label className="field"><span>Correo</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label className="field"><span>Especialidad</span><select value={form.specialty} onChange={(event) => setForm({ ...form, specialty: event.target.value })}><option value="">Selecciona una especialidad</option>{SPECIALTIES.map((specialty) => <option key={specialty}>{specialty}</option>)}</select></label><label className="field"><span>{selected ? "Nueva contraseña temporal (opcional)" : "Contraseña temporal *"}</span><input type="password" minLength={10} value={form.temporary_password ?? ""} onChange={(event) => setForm({ ...form, temporary_password: event.target.value })} /></label><label className="switch-row"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /><span><strong>Perfil activo</strong><small>Desactívalo para retirar al técnico de futuras asignaciones sin perder su historial.</small></span></label><button className="button button-primary" disabled={saving}><FloppyDisk size={18} />{saving ? "Guardando…" : selected ? "Guardar cambios" : "Crear técnico"}</button></form></aside>
    </div>
  </section>;
}
