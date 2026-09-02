import { PencilSimple, UserCircle, UserPlus } from "@phosphor-icons/react";
import type { AssetDetailRecord } from "@/modules/assets/assetDetailRepository";
import { formatDate, type ResponsibleItem } from "@/modules/assets/pages/assetDetailUtils";

interface AssetResponsiblesTabProps {
  items: AssetDetailRecord["responsible_history"];
  onOpenAddResponsible: () => void;
  onOpenEditResponsible: (item: ResponsibleItem) => void;
}

export function AssetResponsiblesTab({ items, onOpenAddResponsible, onOpenEditResponsible }: AssetResponsiblesTabProps) {
  return (
    <section className="detail-section">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <h2>Historial de responsables</h2>
        <button className="button button-primary" type="button" onClick={onOpenAddResponsible}>
          <UserPlus />
          Asignar nuevo responsable
        </button>
      </div>
      <HistoryResponsibleList items={items} onEdit={onOpenEditResponsible} />
    </section>
  );
}

function HistoryResponsibleList({
  items,
  onEdit,
}: {
  items: AssetDetailRecord["responsible_history"];
  onEdit: (item: ResponsibleItem) => void;
}) {
  return (
    <ol className="history-list">
      {items.map((item) => (
        <li key={item.id}>
          <div className="history-icon">
            <UserCircle />
          </div>
          <div className="history-content">
            <div className="history-title">
              <strong>{item.responsible}</strong>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span className={`status ${item.status === "ACTIVA" ? "status-success" : "status-neutral"}`}>
                  {item.status === "ACTIVA" ? "Actual" : "Finalizada"}
                </span>
                <button
                  type="button"
                  className="button button-secondary"
                  style={{ padding: "3px 8px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                  onClick={() => onEdit(item)}
                >
                  <PencilSimple size={13} /> Editar
                </button>
              </div>
            </div>
            <p>{item.area || item.type.toLowerCase()}</p>
            <dl className="history-metadata">
              <div>
                <dt>Periodo</dt>
                <dd>
                  {formatDate(item.start_date)} — {item.end_date ? formatDate(item.end_date) : "Actualidad"}
                </dd>
              </div>
              <div>
                <dt>Motivo</dt>
                <dd>{item.reason}</dd>
              </div>
            </dl>
          </div>
        </li>
      ))}
    </ol>
  );
}
