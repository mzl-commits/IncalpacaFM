import type { TrackingEvent, TrackingStatus } from "../trackingModel";

interface Props {
  events: TrackingEvent[];
}

const statusLabels: Record<TrackingStatus, string> = {
  REPORTADO: "Reportado",
  EN_REVISION: "En revisión",
  RECHAZADO: "No aprobado",
  ASIGNADO: "Asignado",
  EN_PROCESO: "En atención",
  FINALIZADO: "Finalizado",
  PENDIENTE_CONFORMIDAD: "Pendiente de conformidad",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function TrackingTimeline({ events }: Props) {
  const lastEventId = events.at(-1)?.id;

  return (
    <article className="data-panel detail-card tracking-history-card">
      <h2>Historial</h2>

      <div className="tracking-timeline">
        {events.map((event) => (
          <div className="tracking-item" key={event.id}>
            <div className={`tracking-dot ${event.id === lastEventId ? "active" : ""}`} />
            <div>
              <h4>{statusLabels[event.status]}</h4>
              <p>{event.description}</p>
              {event.actor && <span className="tracking-actor">Realizado por: <strong>{event.actor}</strong></span>}
              <small>{formatDate(event.date)}</small>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}
