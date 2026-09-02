import { Wrench } from "@phosphor-icons/react";
import type { AssetDetailRecord } from "@/modules/assets/assetDetailRepository";
import { formatDate } from "@/modules/assets/pages/assetDetailUtils";

interface AssetRepairsTabProps {
  items: AssetDetailRecord["repair_history"];
}

export function AssetRepairsTab({ items }: AssetRepairsTabProps) {
  return (
    <section className="detail-section">
      <h2>Historial de reparaciones</h2>
      <RepairList items={items} />
    </section>
  );
}

function RepairList({ items }: { items: AssetDetailRecord["repair_history"] }) {
  return (
    <ol className="history-list">
      {items.map((item) => (
        <li key={item.id}>
          <div className="history-icon history-icon-repair">
            <Wrench />
          </div>
          <div className="history-content">
            <div className="history-title">
              <strong>{item.work_order}</strong>
              <span className="status status-success">{item.status.toLowerCase()}</span>
            </div>
            <p>{item.issue}</p>
            <dl className="history-metadata">
              <div>
                <dt>Fecha y tipo</dt>
                <dd>
                  {formatDate(item.reported_at)} · {item.type.toLowerCase()}
                </dd>
              </div>
              <div>
                <dt>Trabajo</dt>
                <dd>{item.work_performed}</dd>
              </div>
              <div>
                <dt>Técnico</dt>
                <dd>
                  {item.technician_name} · {item.provider}
                </dd>
              </div>
              <div>
                <dt>Resultado</dt>
                <dd>
                  {item.resulting_condition} · S/ {Number(item.cost).toFixed(2)}
                </dd>
              </div>
            </dl>
          </div>
        </li>
      ))}
    </ol>
  );
}
