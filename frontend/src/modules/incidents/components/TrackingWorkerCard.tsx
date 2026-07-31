interface Props {
  name: string;
  specialty: string;
}

export function TrackingWorkerCard({
  name,
  specialty,
}: Props) {
  return (
    <article className="data-panel detail-card">
      <h2>Operario asignado</h2>

      <p>{name}</p>
      <small>{specialty}</small>
    </article>
  );
}