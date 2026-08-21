import {
  ArrowClockwise,
  Bell,
  CheckCircle,
  Checks,
  ClipboardText,
  Clock,
  Cube,
  EnvelopeSimple,
  Funnel,
  WarningCircle,
  Wrench,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/modules/accounts/AuthContext";
import {
  type EmailNotification,
  listNotifications,
  markNotificationRead,
  notificationActionPath,
  retryNotification,
} from "@/modules/notifications/notificationRepository";

function dateTime(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

const emailStatusLabel = {
  PENDIENTE: "En cola",
  ENVIADA: "Enviada",
  ERROR: "Error",
  CANCELADA: "Cancelada",
} as const;

function getNotificationIcon(item: EmailNotification) {
  if (item.event.includes("INSPECTION")) {
    return <ClipboardText size={20} style={{ color: "#2563eb" }} weight="duotone" />;
  }
  if (item.event.includes("STOCK") || item.entityType === "Material" || item.event.includes("SOLICITUD")) {
    return <Cube size={20} style={{ color: "#d97706" }} weight="duotone" />;
  }
  if (item.entityType === "WorkOrder" || item.event.includes("WORK_ORDER")) {
    return <Wrench size={20} style={{ color: "#7c3aed" }} weight="duotone" />;
  }
  return <Bell size={20} style={{ color: "#475569" }} weight="duotone" />;
}

export function NotificationsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMINISTRADOR";
  const navigate = useNavigate();

  const [items, setItems] = useState<EmailNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [filtroNoLeidas, setFiltroNoLeidas] = useState(false);
  const [retrying, setRetrying] = useState("");
  const [marcandoTodas, setMarcandoTodas] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await listNotifications({ includeAll: isAdmin && showHistory }));
    } catch {
      setError("No se pudo cargar tu bandeja de notificaciones.");
    } finally {
      setLoading(false);
    }
  }, [isAdmin, showHistory]);

  useEffect(() => {
    void load();
  }, [load]);

  const unread = useMemo(() => items.filter((item) => !item.readAt).length, [items]);
  const failures = items.filter((item) => item.status === "ERROR").length;

  const visibleItems = useMemo(() => {
    if (filtroNoLeidas) {
      return items.filter((item) => !item.readAt);
    }
    return items;
  }, [items, filtroNoLeidas]);

  async function read(item: EmailNotification) {
    if (!item.readAt) {
      try {
        const updated = await markNotificationRead(item.id);
        setItems((current) =>
          current.map((entry) => (entry.id === updated.id ? updated : entry)),
        );
      } catch {
        setError("No se pudo actualizar la notificación.");
      }
    }
    const targetPath = notificationActionPath(item);
    navigate(targetPath ?? "/notificaciones");
  }

  async function handleMarkAllAsRead() {
    const unreadItems = items.filter((i) => !i.readAt);
    if (!unreadItems.length) return;
    setMarcandoTodas(true);
    try {
      await Promise.all(unreadItems.map((item) => markNotificationRead(item.id)));
      const nowIso = new Date().toISOString();
      setItems((current) =>
        current.map((entry) => (entry.readAt ? entry : { ...entry, readAt: nowIso })),
      );
    } catch {
      setError("No se pudieron marcar todas las notificaciones como leídas.");
    } finally {
      setMarcandoTodas(false);
    }
  }

  async function retry(item: EmailNotification) {
    setRetrying(item.id);
    try {
      const updated = await retryNotification(item.id);
      setItems((current) =>
        current.map((entry) => (entry.id === updated.id ? updated : entry)),
      );
    } catch {
      setError("No se pudo reprogramar el correo.");
    } finally {
      setRetrying("");
    }
  }

  return (
    <section className="notifications-page">
      <header className="page-heading">
        <div>
          <p className="breadcrumb">Comunicaciones</p>
          <h1>Notificaciones</h1>
          <p>Alertas operativas y avisos importantes dirigidos a tu usuario.</p>
        </div>
      </header>

      {/* Tarjetas resumen */}
      <div className="notification-summary" aria-label="Resumen de notificaciones">
        <article
          style={{ cursor: "pointer" }}
          onClick={() => setFiltroNoLeidas(true)}
          title="Ver solo no leídas"
        >
          <span>Sin leer</span>
          <strong>{unread}</strong>
          <small>Requieren tu atención</small>
        </article>
        <article
          style={{ cursor: "pointer" }}
          onClick={() => setFiltroNoLeidas(false)}
          title="Ver todas"
        >
          <span>Registradas</span>
          <strong>{items.length}</strong>
          <small>En esta bandeja</small>
        </article>
        <article className={failures ? "has-errors" : ""}>
          <span>Con error de correo</span>
          <strong style={{ color: failures ? "#dc2626" : undefined }}>{failures}</strong>
          <small>{isAdmin ? "Puedes reintentar el envío" : "En seguimiento por FM"}</small>
        </article>
      </div>

      {/* Panel principal de notificaciones */}
      <article className="data-panel notification-panel">
        <header>
          <div>
            <Bell size={22} weight="duotone" />
            <div>
              <h2>{showHistory ? "Historial general de correos" : "Tu bandeja de notificaciones"}</h2>
              <p>
                {showHistory
                  ? "Vista administrativa de todos los correos generados por el sistema."
                  : "Haz clic en una notificación para abrir el elemento asociado y marcarla como leída."}
              </p>
            </div>
          </div>

          <div className="notification-toolbar" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            {/* Filtro todas / no leídas */}
            {!showHistory && (
              <div style={{ display: "inline-flex", borderRadius: 8, border: "1px solid var(--border, #e2e8f0)", padding: 2, background: "#f1f5f9" }}>
                <button
                  type="button"
                  onClick={() => setFiltroNoLeidas(false)}
                  style={{
                    border: 0,
                    borderRadius: 6,
                    padding: "5px 12px",
                    fontSize: 12,
                    fontWeight: !filtroNoLeidas ? 600 : 400,
                    background: !filtroNoLeidas ? "#fff" : "transparent",
                    color: !filtroNoLeidas ? "var(--primary, #0f172a)" : "var(--muted, #64748b)",
                    boxShadow: !filtroNoLeidas ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                    cursor: "pointer",
                  }}
                >
                  Todas ({items.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroNoLeidas(true)}
                  style={{
                    border: 0,
                    borderRadius: 6,
                    padding: "5px 12px",
                    fontSize: 12,
                    fontWeight: filtroNoLeidas ? 600 : 400,
                    background: filtroNoLeidas ? "#fff" : "transparent",
                    color: filtroNoLeidas ? "#2563eb" : "var(--muted, #64748b)",
                    boxShadow: filtroNoLeidas ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
                    cursor: "pointer",
                  }}
                >
                  Sin leer ({unread})
                </button>
              </div>
            )}

            {unread > 0 && !showHistory && (
              <button
                className="button button-secondary"
                type="button"
                onClick={() => void handleMarkAllAsRead()}
                disabled={marcandoTodas}
                title="Marcar todas las notificaciones como leídas"
                style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <Checks size={16} />
                {marcandoTodas ? "Marcando…" : "Marcar leídas"}
              </button>
            )}

            {isAdmin && (
              <label className="switch-row compact-switch" style={{ cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={showHistory}
                  onChange={(event) => setShowHistory(event.target.checked)}
                />
                <span style={{ fontSize: 12 }}>Ver todos los correos</span>
              </label>
            )}

            <button
              className="button button-secondary"
              type="button"
              onClick={() => void load()}
              disabled={loading}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              <ArrowClockwise size={16} className={loading ? "spin" : ""} />
              Actualizar
            </button>
          </div>
        </header>

        {loading ? (
          <div className="loading-panel">Cargando notificaciones…</div>
        ) : error ? (
          <div className="form-error">
            <WarningCircle size={18} /> {error}
          </div>
        ) : !visibleItems.length ? (
          <div className="notification-empty">
            <CheckCircle size={36} weight="duotone" />
            <strong style={{ fontSize: 16 }}>Todo está al día</strong>
            <span>
              {filtroNoLeidas
                ? "No tienes notificaciones pendientes por leer."
                : "Las asignaciones, reportes, inspecciones y alertas aparecerán aquí."}
            </span>
          </div>
        ) : (
          <div className="notification-list">
            {visibleItems.map((item) => {
              const isUnread = !item.readAt;

              return (
                <article
                  key={item.id}
                  className={`notification-row ${isUnread ? "is-unread" : ""}`}
                >
                  <button
                    type="button"
                    className="notification-row-main"
                    onClick={() => void read(item)}
                  >
                    <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flex: 1 }}>
                      <div
                        style={{
                          marginTop: 2,
                          padding: 8,
                          borderRadius: 8,
                          background: isUnread ? "#dbeafe" : "#f1f5f9",
                          flexShrink: 0,
                        }}
                      >
                        {getNotificationIcon(item)}
                      </div>

                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <strong>{item.subject}</strong>
                          {isUnread && (
                            <span
                              style={{
                                display: "inline-block",
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: "#2563eb",
                              }}
                              title="No leída"
                            />
                          )}
                        </div>
                        <p>{item.body}</p>
                      </div>
                    </div>

                    {/* Badge de estado */}
                    <div style={{ flexShrink: 0, marginLeft: 12 }}>
                      {showHistory ? (
                        <span
                          className={`status status-${
                            item.status === "ERROR"
                              ? "error"
                              : item.status === "PENDIENTE"
                                ? "warning"
                                : item.status === "ENVIADA"
                                  ? "success"
                                  : "neutral"
                          }`}
                        >
                          {emailStatusLabel[item.status]}
                        </span>
                      ) : isUnread ? (
                        <span
                          style={{
                            background: "#dbeafe",
                            color: "#1e40af",
                            fontSize: 11,
                            fontWeight: 600,
                            padding: "3px 9px",
                            borderRadius: 12,
                          }}
                        >
                          Nueva
                        </span>
                      ) : (
                        <span
                          style={{
                            background: "#f1f5f9",
                            color: "#64748b",
                            fontSize: 11,
                            fontWeight: 500,
                            padding: "3px 9px",
                            borderRadius: 12,
                          }}
                        >
                          Leída
                        </span>
                      )}
                    </div>
                  </button>

                  <footer>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "#64748b" }}>
                      <Clock size={14} />
                      {item.readAt
                        ? `Leída el ${dateTime(item.readAt)} · Recibida el ${dateTime(item.createdAt)}`
                        : `Recibida el ${dateTime(item.createdAt)}`}
                    </span>

                    {item.status === "ERROR" && isAdmin && (
                      <button
                        className="button button-secondary"
                        type="button"
                        onClick={() => void retry(item)}
                        disabled={retrying === item.id}
                        style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 6 }}
                      >
                        <ArrowClockwise size={14} className={retrying === item.id ? "spin" : ""} />
                        {retrying === item.id ? "Reprogramando…" : "Reintentar correo"}
                      </button>
                    )}
                  </footer>
                </article>
              );
            })}
          </div>
        )}
      </article>
    </section>
  );
}
