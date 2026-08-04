import { Bell, BellRinging, CheckCircle, GearSix, WarningCircle } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  type EmailNotification,
  listNotifications,
  markNotificationRead,
} from "@/modules/notifications/notificationRepository";

const POLL_INTERVAL_MS = 45_000;

function relativeDate(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60_000));
  if (minutes < 1) return "Ahora";
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  return new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short" }).format(new Date(value));
}

function typeLabel(item: EmailNotification) {
  if (item.status === "ERROR") return "Requiere seguimiento";
  if (item.event.includes("WORK_ORDER")) return "Orden de trabajo";
  if (item.event.includes("INCIDENT")) return "Reporte";
  if (item.event.includes("ASSIGNMENT")) return "Asignación";
  return "Aviso del sistema";
}

export function NotificationCenter() {
  const navigate = useNavigate();
  const [items, setItems] = useState<EmailNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [toastItem, setToastItem] = useState<EmailNotification | null>(null);
  const [browserEnabled, setBrowserEnabled] = useState(() =>
    "Notification" in window && window.Notification.permission === "granted",
  );
  const knownIds = useRef<Set<string> | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async (showNew = true) => {
    try {
      const next = await listNotifications();
      const unread = next.filter((item) => !item.readAt);
      const previous = knownIds.current;
      const incoming = previous ? unread.filter((item) => !previous.has(item.id)) : [];
      knownIds.current = new Set(next.map((item) => item.id));
      setItems(next);

      if (showNew && incoming.length) setToastItem(incoming[0]);

      if (showNew && incoming.length && browserEnabled && "Notification" in window) {
        const item = incoming[0];
        new window.Notification(item.subject, { body: item.body, tag: item.id });
      }
    } catch {
      // El centro se recupera en el siguiente ciclo sin interrumpir el trabajo actual.
    }
  }, [browserEnabled]);

  useEffect(() => {
    void refresh(false);
    const interval = window.setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    function closeOnOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, [open]);

  useEffect(() => {
    if (!toastItem) return;
    const timeout = window.setTimeout(() => setToastItem(null), 7000);
    return () => window.clearTimeout(timeout);
  }, [toastItem]);

  const unread = items.filter((item) => !item.readAt);

  async function openItem(item: EmailNotification) {
    if (!item.readAt) {
      try {
        const updated = await markNotificationRead(item.id);
        setItems((current) => current.map((entry) => entry.id === updated.id ? updated : entry));
      } catch {
        // Abrir el centro completo sigue disponible si la marca de lectura no se completa.
      }
    }
  }

  async function enableBrowserNotifications() {
    if (!("Notification" in window)) return;
    const permission = await window.Notification.requestPermission();
    setBrowserEnabled(permission === "granted");
  }

  return (
    <div className="notification-center" ref={popoverRef}>
      <button
        className="icon-button"
        type="button"
        aria-label={unread.length ? `Abrir ${unread.length} notificaciones sin leer` : "Abrir notificaciones"}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((current) => !current)}
      >
        {unread.length ? <BellRinging size={20} weight="duotone" /> : <Bell size={20} />}
        {unread.length > 0 && <span className="notification-dot" aria-hidden="true" />}
      </button>

      {open && (
        <section className="notification-popover" role="dialog" aria-label="Notificaciones recientes">
          <header>
            <div>
              <span>Centro de avisos</span>
              <h2>{unread.length ? `${unread.length} pendiente${unread.length === 1 ? "" : "s"}` : "Todo al día"}</h2>
            </div>
            <button type="button" className="notification-close" aria-label="Cerrar notificaciones" onClick={() => setOpen(false)}>×</button>
          </header>

          {!browserEnabled && "Notification" in window && (
            <button className="browser-alert-optin" type="button" onClick={() => void enableBrowserNotifications()}>
              <BellRinging size={18} weight="duotone" />
              <span><strong>Activar avisos del navegador</strong><small>Recibe hitos clave incluso fuera de esta pestaña.</small></span>
            </button>
          )}

          <div className="notification-popover-list">
            {!unread.length ? (
              <div className="notification-popover-empty"><CheckCircle size={24} weight="duotone" /><span>No tienes avisos pendientes.</span></div>
            ) : unread.slice(0, 5).map((item) => (
              <button className="notification-popover-item" type="button" key={item.id} onClick={() => void openItem(item)}>
                <span className={item.status === "ERROR" ? "notification-item-icon is-error" : "notification-item-icon"}>
                  {item.status === "ERROR" ? <WarningCircle size={18} /> : <Bell size={18} weight="duotone" />}
                </span>
                <span>
                  <small>{typeLabel(item)} · {relativeDate(item.createdAt)}</small>
                  <strong>{item.subject}</strong>
                  <em>{item.body}</em>
                </span>
              </button>
            ))}
          </div>

          <footer>
            <button type="button" className="notification-text-button" onClick={() => void refresh(false)}>Actualizar</button>
            <button type="button" className="notification-text-button" onClick={() => { setOpen(false); navigate("/notificaciones"); }}>
              <GearSix size={16} /> Ver historial
            </button>
          </footer>
        </section>
      )}

      {toastItem && (
        <button
          className="notification-toast"
          type="button"
          onClick={() => { setOpen(true); void openItem(toastItem); setToastItem(null); }}
        >
          <BellRinging size={20} weight="duotone" />
          <span><strong>{toastItem.subject}</strong><small>{toastItem.body}</small></span>
          <span className="notification-toast-close" aria-hidden="true">×</span>
        </button>
      )}
    </div>
  );
}
