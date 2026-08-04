import type { TrackingStatus } from "../trackingModel";

interface Props {
  status: TrackingStatus;
  progress: number;
  workOrderCode?: string;
}

const statusLabels: Record<TrackingStatus, string> = {
  REPORTADO: "Solicitud recibida",
  EN_REVISION: "En revisión",
  RECHAZADO: "No aprobada",
  ASIGNADO: "Orden asignada",
  EN_PROCESO: "En atención",
  FINALIZADO: "Finalizada",
  PENDIENTE_CONFORMIDAD: "Pendiente de tu conformidad",
};

export function TrackingStatusCard({ status, progress, workOrderCode }: Props) {
  return (
    <article className="data-panel detail-card tracking-summary-card">
      <span className={`status tracking-status-${status.toLowerCase()}`}>
        {statusLabels[status]}
      </span>
      <h2>Estado actual</h2>
      <strong>{progress}% de avance</strong>
      {workOrderCode ? <p>Orden relacionada: {workOrderCode}</p> : <p>Aún no tiene orden de trabajo asignada.</p>}
    </article>
  );
}
