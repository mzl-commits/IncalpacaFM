import { FloppyDisk, PencilSimple, Plus, UploadSimple, UsersThree, X } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { FilterSelect, ListFilterPanel } from "@/components/filters/ListFilterPanel";
import { createManagedUser, importTechnicians, listManagedUsers, updateManagedUser, type Technician, type TechnicianInput } from "@/modules/accounts/technicianRepository";
import type { UserRole } from "@/modules/accounts/types";
import { listAlmacenes } from "@/modules/almacen/catalogoRepository";
import type { Almacen } from "@/modules/almacen/types";

const ROLES_CON_ALMACEN: UserRole[] = ["ALMACENERO", "INSPECTOR"];

const roleOptions: Array<{ value: UserRole; label: string }> = [
  { value: "USUARIO", label: "Usuario" }, { value: "TECNICO", label: "Técnico" },
  { value: "SUPERVISOR", label: "Supervisor" }, { value: "ALMACENERO", label: "Almacenero" },
  { value: "INSPECTOR", label: "Inspector" }, { value: "ADMINISTRADOR", label: "Administrador / Planner" },
];
const emptyUser: TechnicianInput = { full_name: "", email: "", worker_code: "", dni: "", specialty: "", position: "", hourly_rate: 0, active: true, temporary_password: "", role: "USUARIO" };

function getErrorMessage(error: unknown) {
  const data = (error as { response?: { data?: unknown } })?.response?.data;
  if (typeof data === "string") return data;
  if (data && typeof data === "object") { const first = Object.values(data as Record<string, unknown>)[0]; return Array.isArray(first) ? String(first[0]) : String(first ?? "No se pudo guardar el usuario."); }
  return error instanceof Error ? error.message : "No se pudo guardar el usuario.";
}
function roleName(role: UserRole) { return roleOptions.find((option) => option.value === role)?.label ?? role; }

export function UserManagementPage() {
  const [users, setUsers] = useState<Technician[]>([]);
  const [almacenes, setAlmacenes] = useState<Almacen[]>([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "TODOS">("TODOS");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Technician | null | undefined>(undefined);
  const [form, setForm] = useState<TechnicianInput>(emptyUser);
  const [almacenId, setAlmacenId] = useState<number | "">("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true); setError("");
    try {
      const [usersResult, almacenesResult] = await Promise.allSettled([listManagedUsers(), listAlmacenes()]);
      if (usersResult.status === "fulfilled") setUsers(usersResult.value);
      if (almacenesResult.status === "fulfilled") setAlmacenes(almacenesResult.value);
      if (usersResult.status === "rejected") setError("No se pudo cargar el registro de usuarios. Verifica que el backend esté actualizado y vuelve a intentarlo.");
    }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const visibleUsers = useMemo(() => users.filter((user) => {
    const term = query.trim().toLocaleLowerCase();
    return (!term || [user.full_name, user.email, user.worker_code, user.dni, user.position, user.specialty].some((value) => value.toLocaleLowerCase().includes(term))) && (roleFilter === "TODOS" || user.role === roleFilter);
  }), [users, query, roleFilter]);
  const activeCount = users.filter((user) => user.active).length;
  const technicalRole = ["TECNICO", "SUPERVISOR", "ALMACENERO", "INSPECTOR"].includes(form.role);
  const necesitaAlmacen = ROLES_CON_ALMACEN.includes(form.role as UserRole);
  function update<K extends keyof TechnicianInput>(field: K, value: TechnicianInput[K]) {
    setForm((current) => ({ ...current, [field]: value }));
    // Limpiar almacén si se cambia a un rol que no lo requiere
    if (field === "role" && !ROLES_CON_ALMACEN.includes(value as UserRole)) setAlmacenId("");
  }
  function openCreate() { setEditing(null); setForm(emptyUser); setAlmacenId(""); setError(""); setFeedback(""); }
  function openEdit(user: Technician) {
    setEditing(user);
    setForm({ ...user, temporary_password: "" });
    setAlmacenId((user as unknown as { almacen_id?: number }).almacen_id ?? "");
    setError(""); setFeedback("");
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setFeedback("");
    if (!form.full_name.trim() || !form.worker_code.trim() || !form.dni.trim() || (!editing && !form.temporary_password)) { setError("Completa nombre, código de trabajador, DNI y contraseña temporal al crear una cuenta."); return; }
    if (form.role === "ALMACENERO" && !almacenId) { setError("El rol Almacenero requiere un almacén asignado."); return; }
    setSaving(true);
    const payload = {
      ...form,
      full_name: form.full_name.trim(),
      worker_code: form.worker_code.trim().toUpperCase(),
      dni: form.dni.replace(/\D/g, ""),
      ...(necesitaAlmacen && almacenId !== "" ? { almacen_id: almacenId } : { almacen_id: null }),
    };
    try {
      const saved = editing ? await updateManagedUser(editing.id, payload) : await createManagedUser(payload);
      setUsers((current) => editing ? current.map((user) => user.id === saved.id ? saved : user) : [...current, saved]);
      setFeedback(editing ? "Usuario actualizado correctamente." : "Usuario creado. Deberá cambiar su contraseña al ingresar."); setEditing(undefined);
    } catch (saveError) { setError(getErrorMessage(saveError)); } finally { setSaving(false); }
  }
  async function importFile(file?: File) {
    if (!file) return; setError(""); setFeedback("");
    try { const result = await importTechnicians(file); setFeedback(`Importación completada: ${result.created} creados y ${result.updated} actualizados.${result.errors.length ? ` ${result.errors.length} fila(s) requieren revisión.` : ""}`); await load(); }
    catch (importError) { setError(getErrorMessage(importError)); } finally { if (fileInput.current) fileInput.current.value = ""; }
  }

  return (
    <section className="user-management-page">
      <header className="page-heading user-management-heading">
        <div><p className="breadcrumb">Administración / Usuarios</p><h1>Usuarios</h1><p>Administra accesos, roles y datos laborales desde un solo lugar.</p></div>
        <div className="user-management-actions">
          <input ref={fileInput} hidden type="file" accept=".xlsx,.xlsm" onChange={(event) => void importFile(event.target.files?.[0])} />
          <button className="button button-secondary" type="button" onClick={() => fileInput.current?.click()}><UploadSimple size={18} />Importar Excel</button>
          <button className="button button-primary" type="button" onClick={openCreate}><Plus size={18} />Nuevo usuario</button>
        </div>
      </header>
      {(feedback || error) && <div className={`user-management-notice ${error ? "is-error" : ""}`} role={error ? "alert" : "status"}><span>{error || feedback}</span>{error && <button className="button button-secondary" type="button" onClick={() => void load()}>Reintentar</button>}</div>}
      <div className="user-management-summary" aria-label="Resumen de usuarios">
        <div><UsersThree size={21} /><span><strong>{users.length}</strong><small>Usuarios registrados</small></span></div>
        <div><span><strong>{activeCount}</strong><small>Con acceso activo</small></span></div>
        <div><span><strong>{users.filter((user) => user.role === "SOLICITANTE").length}</strong><small>Solicitantes</small></span></div>
      </div>
      {editing !== undefined && (
        <form className="data-panel user-management-editor" onSubmit={save}>
          <header>
            <div><h2>{editing ? "Editar usuario" : "Nuevo usuario"}</h2><p>Los cambios se aplican al próximo inicio de sesión.</p></div>
            <button type="button" className="icon-button" onClick={() => setEditing(undefined)} aria-label="Cerrar formulario"><X size={20} /></button>
          </header>
          <div className="form-grid">
            <label className="field field-wide"><span>Nombre completo *</span><input required value={form.full_name} onChange={(event) => update("full_name", event.target.value)} /></label>
            <label className="field"><span>Código de trabajador *</span><input required maxLength={40} value={form.worker_code} onChange={(event) => update("worker_code", event.target.value.toUpperCase())} /></label>
            <label className="field"><span>DNI *</span><input required inputMode="numeric" maxLength={8} value={form.dni} onChange={(event) => update("dni", event.target.value.replace(/\D/g, "").slice(0, 8))} /></label>
            <label className="field"><span>Correo electrónico</span><input type="email" value={form.email} onChange={(event) => update("email", event.target.value)} /></label>
            <label className="field"><span>Rol *</span>
              <select value={form.role} onChange={(event) => update("role", event.target.value as UserRole)}>
                {roleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            {necesitaAlmacen && (
              <label className="field">
                <span>Almacén asignado {form.role === "ALMACENERO" ? "*" : "(opcional)"}</span>
                <select
                  value={almacenId}
                  onChange={(event) => setAlmacenId(event.target.value ? Number(event.target.value) : "")}
                  required={form.role === "ALMACENERO"}
                >
                  <option value="">Seleccionar almacén…</option>
                  {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </label>
            )}
            <label className="field"><span>{editing ? "Nueva contraseña temporal" : "Contraseña temporal *"}</span><input required={!editing} type="password" minLength={10} value={form.temporary_password} onChange={(event) => update("temporary_password", event.target.value)} placeholder={editing ? "Déjalo vacío para conservarla" : "Mínimo 10 caracteres"} /></label>
            <label className="field"><span>Cargo</span><input value={form.position} onChange={(event) => update("position", event.target.value)} /></label>
            <label className="field"><span>Especialidad o área</span><input value={form.specialty} onChange={(event) => update("specialty", event.target.value)} /></label>
            <label className="field"><span>Tarifa por hora (S/)</span><input type="number" min="0" step="0.01" disabled={!technicalRole} value={form.hourly_rate} onChange={(event) => update("hourly_rate", Number(event.target.value) || 0)} /></label>
            <label className="field field-toggle"><input type="checkbox" checked={form.active} onChange={(event) => update("active", event.target.checked)} /><span>Cuenta activa</span></label>
          </div>
          <footer className="form-actions">
            <button className="button button-secondary" type="button" onClick={() => setEditing(undefined)}>Cancelar</button>
            <button className="button button-primary" disabled={saving} type="submit"><FloppyDisk size={18} />{saving ? "Guardando…" : "Guardar usuario"}</button>
          </footer>
        </form>
      )}
      <ListFilterPanel title="Directorio de usuarios" description="Busca una cuenta o limita el listado por rol." searchLabel="Buscar usuarios" searchPlaceholder="Nombre, DNI, código o cargo" searchValue={query} onSearchChange={setQuery} resultCount={visibleUsers.length} totalCount={users.length} activeFilters={roleFilter === "TODOS" ? [] : [{ key: "role", label: "Rol", value: roleName(roleFilter), onRemove: () => setRoleFilter("TODOS") }]} onClear={() => { setQuery(""); setRoleFilter("TODOS"); }}>
        <FilterSelect label="Rol" value={roleFilter === "TODOS" ? "" : roleFilter} onChange={(value) => setRoleFilter((value as UserRole) || "TODOS")} options={roleOptions} allLabel="Todos los roles" />
      </ListFilterPanel>
      <article className="data-panel user-management-list">
        {loading ? <div className="loading-panel">Cargando usuarios…</div> : !visibleUsers.length ? (
          <div className="empty-state user-management-empty"><UsersThree size={28} /><strong>{error ? "No fue posible obtener el directorio" : "No hay usuarios con esos filtros"}</strong><span>{error ? "Reintenta cuando el backend actualizado esté disponible." : "Cambia los filtros o crea el primer usuario."}</span></div>
        ) : (
          <div className="responsive-table">
            <table>
              <thead>
                <tr><th>Usuario</th><th>Rol</th><th>Código / DNI</th><th>Área o cargo</th><th>Almacén</th><th>Acceso</th><th aria-label="Acciones" /></tr>
              </thead>
              <tbody>
                {visibleUsers.map((user) => {
                  const userAny = user as unknown as { almacen_nombre?: string; almacen_id?: number };
                  const showAlmacen = ROLES_CON_ALMACEN.includes(user.role as UserRole);
                  return (
                    <tr key={user.id}>
                      <td><strong>{user.full_name}</strong><small>{user.email || "Sin correo"}</small></td>
                      <td><span className="status-badge">{roleName(user.role)}</span></td>
                      <td><strong>{user.worker_code}</strong><small>{user.dni || "Sin DNI"}</small></td>
                      <td>{user.position || user.specialty || "No registrado"}</td>
                      <td>
                        {showAlmacen
                          ? (userAny.almacen_nombre
                            ? <span style={{ fontSize: 13 }}>{userAny.almacen_nombre}</span>
                            : <span style={{ fontSize: 12, color: "var(--error, #dc2626)" }}>Sin asignar</span>)
                          : <span style={{ color: "var(--muted)", fontSize: 12 }}>—</span>}
                      </td>
                      <td><span className={`status-badge ${user.active ? "" : "is-muted"}`}>{user.active ? "Activo" : "Inactivo"}</span></td>
                      <td><button className="table-action" type="button" onClick={() => openEdit(user)}><PencilSimple size={17} />Editar</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );

}
