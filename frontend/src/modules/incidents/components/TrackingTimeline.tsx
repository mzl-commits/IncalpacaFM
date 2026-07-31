import type { TrackingEvent } from "../trackingModel";

interface Props {
  events: TrackingEvent[];
}

export function TrackingTimeline({ events }: Props) {

  return (
    <article className="data-panel detail-card">
      <h2>Historial</h2>

      <div className="tracking-timeline">
        {events.map((event, index) => (
          <div 
            className="tracking-item"
            key={event.id}
          >
            <div
            className={`tracking-dot ${
                event.status === events[events.length - 1].status
                ? "active"
                : ""
            }`}
            ></div>

            <div>
              <h4>{event.status}</h4>
              <p>{event.description}</p>
              <small>
                Fecha: {event.date}
              </small>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}