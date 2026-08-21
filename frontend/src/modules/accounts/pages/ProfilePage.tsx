import { CheckCircle, IdentificationBadge, LockKey, ShieldCheck, UserCircle } from "@phosphor-icons/react";
import { useState } from "react";
import { api } from "@/services/api";
import { useAuth } from "../AuthContext";

const roleLabels: Record<string, string> = { ADMINISTRADOR: "Administrador / Planner", TECNICO: "Técnico", SUPERVISOR: "Supervisor", SOLICITANTE: "Usuario" };

export function ProfilePage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function changePassword(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    if (newPassword.length < 10) return setMessage({ type: "error", text: "La nueva contraseña debe tener al menos 10 caracteres." });
    if (newPassword !== confirmation) return setMessage({ type: "error", text: "Las contraseñas nuevas no coinciden." });
    setSaving(true);
    try {
      await api.post("/auth/change-password/", { current_password: currentPassword, new_password: newPassword });
      setCurrentPassword(""); setNewPassword(""); setConfirmation("");
      setMessage({ type: "success", text: "Contraseña actualizada correctamente." });
    } catch (error) {
      const detail = (error as { response?: { data?: { detail?: string; current_password?: string[] } } })?.response?.data;
      setMessage({ type: "error", text: detail?.detail || detail?.current_password?.[0] || "No se pudo actualizar la contraseña." });
    } finally { setSaving(false); }
  }

  if (!user) return null;
  const initials = user.fullName.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();

  return <section className="profile-page">
    <header className="page-heading profile-heading"><div><p className="breadcrumb">Configuración / Mi perfil</p><h1>Mi perfil</h1><p>Consulta tus datos de acceso y actualiza tu contraseña.</p></div></header>
    <div className="profile-layout">
      <section className="profile-identity-card" aria-labelledby="profile-identity-title"><div className="profile-avatar">{initials || <UserCircle size={42} />}</div><div><span className="profile-kicker"><ShieldCheck size={15} /> Perfil activo</span><h2 id="profile-identity-title">{user.fullName}</h2><p>{roleLabels[user.role] || user.role}</p></div><span className="profile-active-badge"><CheckCircle size={15} /> Activo</span></section>
      <section className="profile-details-card"><header><div><span className="profile-kicker">Información de cuenta</span><h2>Datos personales y laborales</h2></div><IdentificationBadge size={24} /></header><dl className="profile-details-grid"><div><dt>Código de trabajador</dt><dd>{user.workerCode || "No registrado"}</dd></div><div><dt>DNI</dt><dd>{user.dni || "No registrado"}</dd></div><div><dt>Correo</dt><dd>{user.email || "No registrado"}</dd></div><div><dt>Cargo / posición</dt><dd>{user.position || "No especificado"}</dd></div><div><dt>Especialidad</dt><dd>{user.specialtyId || "No especificada"}</dd></div>{user.hourlyRate && (
  <div>
    <dt>Tarifa por hora</dt>
    <dd>S/ {Number(user.hourlyRate).toFixed(2)}</dd>
  </div>
)}</dl></section>
      <section className="profile-password-card"><header><div><span className="profile-kicker"><LockKey size={15} /> Seguridad</span><h2>Cambiar contraseña</h2><p>Usa una contraseña de al menos 10 caracteres.</p></div></header><form onSubmit={changePassword}><label className="field"><span>Contraseña actual</span><input type="password" autoComplete="current-password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label><label className="field"><span>Nueva contraseña</span><input type="password" minLength={10} autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label><label className="field"><span>Confirmar nueva contraseña</span><input type="password" minLength={10} autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required /></label>{message && <div className={`profile-message is-${message.type}`} role="status">{message.text}</div>}<button className="button button-primary" type="submit" disabled={saving}>{saving ? "Actualizando..." : "Actualizar contraseña"}</button></form></section>
    </div>
  </section>;
}
