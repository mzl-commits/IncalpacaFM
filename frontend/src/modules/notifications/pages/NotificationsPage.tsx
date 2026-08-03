import { ArrowClockwise, CheckCircle, EnvelopeSimple, WarningCircle } from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/modules/accounts/AuthContext";
import {
  type DeliveryStatus,
  type EmailNotification,
  listNotifications,
  retryNotification,
} from "@/modules/notifications/notificationRepository";

const labels: Record<DeliveryStatus, string> = {
  PENDIENTE: "Pendiente de envío",
  ENVIADA: "Enviada",
  ERROR: "Requiere revisión",
  CANCELADA: "Cancelada",
};

const statusClasses: Record<DeliveryStatus, string> = {
  PENDIENTE: "status-warning",
  ENVIADA: "status-success",
  ERROR: "status-error",
  CANCELADA: "status-neutral",
};

function dateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function NotificationsPage() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<EmailNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryingId, setRetryingId] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      setNotifications(await listNotifications());
    } catch {
      setError("No se pudo cargar el historial de correos.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const summary = useMemo(() => ({
    pending: notifications.filter((item) => item.status === "PENDIENTE").length,
    sent: notifications.filter((item) => item.status === "ENVIADA").length,
    errors: notifications.filter((item) => item.status === "ERROR").length,
  }), [notifications]);

  async function retry(notification: EmailNotification) {
    setRetryingId(notification.id);
    try {
      const updated = await retryNotification(notification.id);
      setNotifications((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch {
      setError("No se pudo reprogramar el correo.");
    } finally {
      setRetryingId("");
    }
  }

  return <section className="notifications-page">
    <div className="page-heading">
      <div><p className="breadcrumb">Administración / Comunicaciones</p><h1>Notificaciones por correo</h1><p>Consulta el estado de los avisos generados por solicitudes, órdenes de trabajo y bajas.</p></div>
    </div>
    <div className="notification-summary" aria-label="Resumen de envíos">
      <article><span>Pendientes</span><strong>{summary.pending}</strong><small>En cola para envío</small></article>
      <article><span>Enviadas</span><strong>{summary.sent}</strong><small>Confirmadas por el servidor</small></article>
      <article className={summary.errors ? "has-errors" : ""}><span>Con error</span><strong>{summary.errors}</strong><small>Requieren seguimiento</small></article>
    </div>
    <article className="data-panel notification-panel">
      <header><div><EnvelopeSimple size={22} /><div><h2>Historial de comunicaciones</h2><p>Los envíos fallidos se conservan en cola para reintento; el proceso operativo no se detiene.</p></div></div><button className="button button-secondary" type="button" onClick={() => void load()} disabled={loading}><ArrowClockwise size={17} />Actualizar</button></header>
      {loading ? <div className="loading-panel">Cargando notificaciones…</div> : error ? <div className="form-error"><WarningCircle />{error}</div> : !notifications.length ? <div className="notification-empty"><CheckCircle size={30} /><strong>No hay notificaciones registradas</strong><span>Los correos aparecerán aquí cuando se produzca un evento operativo.</span></div> : <div className="notification-list">
        {notifications.map((notification) => <article key={notification.id} className="notification-row">
          <div className="notification-row-main"><div><strong>{notification.subject}</strong><p>{notification.body}</p></div><span className={`status ${statusClasses[notification.status]}`}>{labels[notification.status]}</span></div>
          <dl><div><dt>Destinatario</dt><dd>{user?.role === "ADMINISTRADOR" ? `${notification.recipientName} · ${notification.recipientEmail}` : notification.recipientEmail}</dd></div><div><dt>Creada</dt><dd>{dateTime(notification.createdAt)}</dd></div><div><dt>Enviada</dt><dd>{dateTime(notification.sentAt)}</dd></div><div><dt>Intentos</dt><dd>{notification.attempts} / {notification.max_attempts}</dd></div></dl>
          {notification.status === "ERROR" && <footer><span><WarningCircle />{notification.last_error || "El proveedor no confirmó el envío."}</span>{user?.role === "ADMINISTRADOR" && <button className="button button-secondary" type="button" onClick={() => void retry(notification)} disabled={retryingId === notification.id}><ArrowClockwise size={16} />{retryingId === notification.id ? "Reprogramando…" : "Reintentar"}</button>}</footer>}
        </article>)}
      </div>}
    </article>
  </section>;
}
