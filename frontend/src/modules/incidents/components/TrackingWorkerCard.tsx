interface Props {
  name: string;
  specialty: string;
}

export function TrackingWorkerCard({ name, specialty }: Props) {
  return (
    <article className="data-panel detail-card tracking-worker-card">
      <h2>Responsable de atención</h2>
      <strong>{name}</strong>
      <p>{specialty}</p>
    </article>
  );
}