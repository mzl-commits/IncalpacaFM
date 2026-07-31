import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";

import { TrackingStatusCard } from "../components/TrackingStatusCard";
import { TrackingTimeline } from "../components/TrackingTimeline";
import { TrackingWorkerCard } from "../components/TrackingWorkerCard";
import type { RequestTracking } from "../trackingModel";
import { getTrackingByIncidentId } from "../trackingRepository";

export function RequestTrackingPage() {
  const { id } = useParams();

  const [tracking, setTracking] = useState<RequestTracking>();

  useEffect(() => {
    if (!id) return;

    void getTrackingByIncidentId(id).then(setTracking);
  }, [id]);

  if (!tracking) {
    return (
      <section>
        <h1>Seguimiento no encontrado</h1>
        <p>No existe información de seguimiento para esta solicitud.</p>
      </section>
    );
  }

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="breadcrumb">
            Mantenimiento / Solicitudes / Seguimiento
          </p>

          <h1>Seguimiento de solicitud</h1>

          <p>
            Consulta el avance y las acciones realizadas sobre la solicitud.
          </p>
        </div>
      </div>

      <div className="detail-grid">
        <TrackingStatusCard
          status={tracking.currentStatus}
        />

        <TrackingWorkerCard
          name={tracking.workerName}
          specialty={tracking.workerSpecialty}
        />
      </div>

      <TrackingTimeline
        events={tracking.events}
      />
    </section>
  );
}