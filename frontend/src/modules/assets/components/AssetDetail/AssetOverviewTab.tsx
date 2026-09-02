import { MapPin, Tag, UserCircle, UserPlus } from "@phosphor-icons/react";
import type { AssetDetailRecord } from "@/modules/assets/assetDetailRepository";
import { displayCode, formatDate } from "@/modules/assets/pages/assetDetailUtils";

interface AssetOverviewTabProps {
  asset: AssetDetailRecord;
  activeAssignment: AssetDetailRecord["responsible_history"][number] | undefined;
  onOpenAddResponsible: () => void;
}

export function AssetOverviewTab({ asset, activeAssignment, onOpenAddResponsible }: AssetOverviewTabProps) {
  return (
    <div className="asset-record-layout">
      <section className="detail-section">
        <div className="asset-detail-photo-wrap">
          {asset.photo_url ? (
            <img
              src={asset.photo_url}
              alt={`Fotografía registrada de ${asset.name}`}
              style={{
                width: "100%",
                maxHeight: "260px",
                objectFit: "cover",
                borderRadius: "10px",
                border: "1px solid #E8E8E8",
                display: "block",
              }}
            />
          ) : (
            <div className="asset-detail-photo-empty">
              <Tag size={30} />
              <span>Este bien no tiene fotografía registrada</span>
            </div>
          )}
        </div>
        <h2>Información del bien</h2>
        <p className="record-description">{asset.description}</p>
        <dl className="record-facts">
          <div>
            <dt>Código FM</dt>
            <dd>{displayCode(asset)}</dd>
          </div>
          <div>
            <dt>Identificador técnico</dt>
            <dd>{asset.code}</dd>
          </div>
          <div>
            <dt>Marca / modelo</dt>
            <dd>{[asset.brand, asset.model].filter(Boolean).join(" ") || "No registrado"}</dd>
          </div>
          <div>
            <dt>Número de serie</dt>
            <dd>{asset.serial_number || "No registrado"}</dd>
          </div>
          <div>
            <dt>Condición</dt>
            <dd>{asset.condition}</dd>
          </div>
          <div>
            <dt>Clasificación</dt>
            <dd>
              {asset.taxonomy_detail
                ? `${asset.taxonomy_detail.prefix ? `${asset.taxonomy_detail.prefix} — ` : ""}${asset.taxonomy_detail.category} / ${asset.taxonomy_detail.subcategory}`
                : "Pendiente"}
            </dd>
          </div>
          <div>
            <dt>Ingreso</dt>
            <dd>
              {asset.entry_type_label} · {formatDate(asset.created_at)}
            </dd>
          </div>
        </dl>
      </section>
      <aside className="detail-section current-custody">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <h2>Situación actual</h2>
          <button
            type="button"
            className="button button-secondary"
            style={{ padding: "4px 10px", fontSize: "12px" }}
            onClick={onOpenAddResponsible}
          >
            <UserPlus size={14} /> Cambiar
          </button>
        </div>
        <div>
          <MapPin />
          <span>
            <small>Ubicación</small>
            <strong>
              {asset.location_detail
                ? `${asset.location_detail.building} / ${asset.location_detail.area} / ${asset.location_detail.room}`
                : "Por confirmar"}
            </strong>
          </span>
        </div>
        <div>
          <UserCircle />
          <span>
            <small>Responsable actual</small>
            <strong>{activeAssignment?.responsible || "Sin asignar"}</strong>
            {activeAssignment?.area && <small>{activeAssignment.area}</small>}
          </span>
        </div>
      </aside>
    </div>
  );
}
