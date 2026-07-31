import {
  ArrowLeft,
  CheckCircle,
  DownloadSimple,
  FloppyDisk,
  MapPin,
  PencilSimple,
  Printer,
  Tag,
  UserCircle,
  Wrench,
  X,
} from "@phosphor-icons/react";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "@/modules/accounts/AuthContext";
import {
  getAssetDetail,
  classifyAsset,
  updateAssetDetail,
  type AssetDetailRecord,
  type AssetDetailUpdate,
} from "@/modules/assets/assetDetailRepository";
import { TaxonomyPicker } from "@/modules/taxonomy/components/TaxonomyPicker";

type DetailTab = "overview" | "responsibles" | "repairs" | "qr";

function displayCode(asset: AssetDetailRecord) {
  return asset.display_code || asset.fm_code || asset.code;
}

export function AssetDetailPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const [asset, setAsset] = useState<AssetDetailRecord | null>(null);
  const [tab, setTab] = useState<DetailTab>("overview");
  const [qr, setQr] = useState("");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [saved, setSaved] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [classificationOpen, setClassificationOpen] = useState(false);
  const [classificationTaxonomyId, setClassificationTaxonomyId] = useState("");
  const [classificationError, setClassificationError] = useState("");
  const [editForm, setEditForm] = useState<AssetDetailUpdate>({
    name: "",
    description: "",
    brand: "",
    model: "",
    serial_number: "",
    condition: "",
    criticality: "",
  });
  useEffect(() => {
    getAssetDetail(id)
      .then(setAsset)
      .catch(() => setError("No se pudo cargar la ficha del bien."));
  }, [id]);
  useEffect(() => {
    if (asset)
      QRCode.toDataURL(asset.public_url, {
        width: 420,
        margin: 2,
        color: { dark: "#002b58", light: "#ffffff" },
      }).then(setQr);
  }, [asset]);
  if (!asset)
    return <section className="loading-panel">{error || "Cargando ficha del bien…"}</section>;
  const activeAssignment = asset.responsible_history.find((item) => item.status === "ACTIVA");

  function openEditor() {
    if (!asset) return;
    setEditForm({
      name: asset.name,
      description: asset.description,
      brand: asset.brand,
      model: asset.model,
      serial_number: asset.serial_number ?? "",
      condition: asset.condition,
      criticality: asset.criticality,
    });
    setEditError("");
    setSaved(false);
    setEditing(true);
  }

  function updateEditField<Key extends keyof AssetDetailUpdate>(
    field: Key,
    value: AssetDetailUpdate[Key],
  ) {
    setEditForm((current) => ({ ...current, [field]: value }));
  }

  async function saveAsset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!asset) return;
    setSaving(true);
    setEditError("");
    try {
      const updated = await updateAssetDetail(asset.id, editForm);
      setAsset(updated);
      setEditing(false);
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3500);
    } catch {
      setEditError("No se pudieron guardar los cambios. Revisa los datos e inténtalo nuevamente.");
    } finally {
      setSaving(false);
    }
  }

  async function completeClassification() {
    if (!asset || !classificationTaxonomyId) {
      setClassificationError("Selecciona una taxonomía activa.");
      return;
    }
    setClassifying(true);
    setClassificationError("");
    try {
      const updated = await classifyAsset(asset.id, classificationTaxonomyId);
      setAsset(updated);
      setClassificationOpen(false);
      setClassificationTaxonomyId("");
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3500);
    } catch {
      setClassificationError("No se pudo clasificar el bien. La taxonomía puede haber cambiado; actualiza la selección e inténtalo nuevamente.");
    } finally {
      setClassifying(false);
    }
  }

  return (
    <section className="asset-record-page">
      {saved && (
        <div className="asset-edit-success" role="status">
          <CheckCircle weight="fill" />
          Ficha del bien actualizada correctamente.
        </div>
      )}
      <Link className="back-link" to="/bienes">
        <ArrowLeft />
        Volver a bienes
      </Link>
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Bienes / Ficha</p>
          <h1>{asset.name}</h1>
          <p>{displayCode(asset)}{asset.fm_code && <small> · {asset.code}</small>}</p>
        </div>
        <div className="detail-actions">
          <span
            className={`status ${asset.assignment_status === "Sin asignar" ? "status-neutral" : "status-success"}`}
          >
            {asset.assignment_status}
          </span>
          {user?.role === "ADMINISTRADOR" && (
            <button className="button button-secondary" type="button" onClick={openEditor}>
              <PencilSimple />
              Editar ficha
            </button>
          )}
          <button className="button button-secondary" onClick={() => window.print()}>
            <Printer />
            Imprimir ficha
          </button>
        </div>
      </div>
      {user?.role === "ADMINISTRADOR" && (!asset.fm_code || !asset.taxonomy_detail) && (
        <section className="asset-classification-callout">
          <Tag size={25} weight="duotone" />
          <div><strong>Clasificación pendiente</strong><p>Asigna una taxonomía validada para reservar el código FM sin cambiar el identificador técnico ni el enlace QR.</p></div>
          <button className="button button-primary" type="button" onClick={() => setClassificationOpen((current) => !current)}>{classificationOpen ? "Cerrar" : "Completar clasificación"}</button>
        </section>
      )}
      {classificationOpen && (
        <section className="asset-classification-panel" aria-labelledby="asset-classification-title">
          <header><div><span>Administración</span><h2 id="asset-classification-title">Asignar taxonomía y código FM</h2><p>El código se reservará transaccionalmente al confirmar.</p></div><code>{asset.code}</code></header>
          <TaxonomyPicker selectedId={classificationTaxonomyId} onSelect={(taxonomy) => { setClassificationTaxonomyId(taxonomy.id); setClassificationError(""); }} error={classificationError} />
          <footer><button className="button button-secondary" type="button" onClick={() => { setClassificationOpen(false); setClassificationError(""); }}>Cancelar</button><button className="button button-primary" type="button" disabled={classifying || !classificationTaxonomyId} onClick={completeClassification}>{classifying ? "Clasificando…" : "Confirmar clasificación"}</button></footer>
        </section>
      )}
      <nav className="record-tabs" aria-label="Secciones de la ficha">
        {(
          [
            ["overview", "Resumen"],
            ["responsibles", `Responsables (${asset.responsible_history.length})`],
            ["repairs", `Reparaciones (${asset.repair_history.length})`],
            ["qr", "Código QR"],
          ] as Array<[DetailTab, string]>
        ).map(([value, label]) => (
          <button
            key={value}
            aria-current={tab === value ? "page" : undefined}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "overview" && (
        <div className="asset-record-layout">
          <section className="detail-section">
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
            <h2>Situación actual</h2>
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
                <small>Responsable</small>
                <strong>{activeAssignment?.responsible || "Sin asignar"}</strong>
                <small>{activeAssignment?.area}</small>
              </span>
            </div>
          </aside>
        </div>
      )}
      {tab === "responsibles" && (
        <section className="detail-section">
          <h2>Historial de responsables</h2>
          <HistoryResponsibleList items={asset.responsible_history} />
        </section>
      )}
      {tab === "repairs" && (
        <section className="detail-section">
          <h2>Historial de reparaciones</h2>
          <RepairList items={asset.repair_history} />
        </section>
      )}
      {tab === "qr" && (
        <section className="detail-section qr-record">
          <div>
            <h2>Identificación QR</h2>
            <p>Este código abre la ficha pública segura del bien.</p>
            <strong>{displayCode(asset)}</strong>
            {asset.fm_code && <small>ID técnico: {asset.code}</small>}
          </div>
          {qr && <img src={qr} alt={`Código QR de ${displayCode(asset)}`} />}
          <div className="qr-record-actions">
            <button className="button button-primary" onClick={() => window.print()}>
              <Printer />
              Imprimir etiqueta
            </button>
            <a className="button button-secondary" href={qr} download={`${displayCode(asset)}-QR.png`}>
              <DownloadSimple />
              Descargar PNG
            </a>
          </div>
        </section>
      )}
      {editing && (
        <div className="asset-edit-backdrop" role="presentation">
          <section
            className="asset-edit-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-edit-title"
          >
            <header>
              <div>
                <span>Edición administrativa</span>
                <h2 id="asset-edit-title">Actualizar ficha del bien</h2>
                <p>{displayCode(asset)}{asset.fm_code && ` · ${asset.code}`}</p>
              </div>
              <button type="button" aria-label="Cerrar edición" onClick={() => setEditing(false)}>
                <X />
              </button>
            </header>
            <form onSubmit={saveAsset}>
              {editError && (
                <div className="asset-edit-error" role="alert">
                  {editError}
                </div>
              )}
              <div className="asset-edit-fields">
                <label className="field field-wide">
                  <span>Nombre del bien *</span>
                  <input
                    required
                    value={editForm.name}
                    onChange={(event) => updateEditField("name", event.target.value)}
                  />
                </label>
                <label className="field field-wide">
                  <span>Descripción *</span>
                  <textarea
                    required
                    rows={3}
                    value={editForm.description}
                    onChange={(event) => updateEditField("description", event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Marca</span>
                  <input
                    value={editForm.brand}
                    onChange={(event) => updateEditField("brand", event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Modelo</span>
                  <input
                    value={editForm.model}
                    onChange={(event) => updateEditField("model", event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Número de serie</span>
                  <input
                    value={editForm.serial_number}
                    onChange={(event) => updateEditField("serial_number", event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Condición *</span>
                  <select
                    required
                    value={editForm.condition}
                    onChange={(event) => updateEditField("condition", event.target.value)}
                  >
                    {["Nuevo", "Bueno", "Regular", "Requiere revisión"].map((condition) => (
                      <option value={condition} key={condition}>
                        {condition}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Criticidad *</span>
                  <select
                    required
                    value={editForm.criticality}
                    onChange={(event) => updateEditField("criticality", event.target.value)}
                  >
                    {["Baja", "Media", "Alta", "Crítica"].map((criticality) => (
                      <option value={criticality} key={criticality}>
                        {criticality}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <aside className="asset-edit-boundary">
                La ubicación y el responsable se actualizan desde Asignaciones para conservar su
                historial y las actas correspondientes.
              </aside>
              <footer>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => setEditing(false)}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button className="button button-primary" disabled={saving}>
                  <FloppyDisk />
                  {saving ? "Guardando…" : "Guardar cambios"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </section>
  );
}

function HistoryResponsibleList({ items }: { items: AssetDetailRecord["responsible_history"] }) {
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
              <span
                className={`status ${item.status === "ACTIVA" ? "status-success" : "status-neutral"}`}
              >
                {item.status === "ACTIVA" ? "Actual" : "Finalizada"}
              </span>
            </div>
            <p>{item.area || item.type.toLowerCase()}</p>
            <dl className="history-metadata">
              <div>
                <dt>Periodo</dt>
                <dd>
                  {formatDate(item.start_date)} —{" "}
                  {item.end_date ? formatDate(item.end_date) : "Actualidad"}
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(new Date(value));
}
