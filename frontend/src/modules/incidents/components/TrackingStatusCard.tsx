import type { TrackingStatus } from "../trackingModel";

interface Props {
  status: TrackingStatus;
}

export function TrackingStatusCard({ status }: Props) {
  return (
    <article className="data-panel detail-card">
      <h2>Estado actual</h2>
      <strong>{status}</strong>
    </article>
  );
}