import {
  ArrowLeft,
  DownloadSimple,
  FileText,
  MapPin,
  ShieldCheck,
  UserCircle,
  X,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useLocationMapImage } from "@/modules/assets/locationMapQueries";
import {
  getAssignment,
  getAssignmentAssetDisplayCode,
  getAssignmentCatalog,
  registerAssignmentOperation,
  updateAssignment,
  type AssignmentCatalog,
  type AssignmentRecord,
} from "@/modules/assignments/assignmentRepository";

export function AssignmentDetailPage() {
  const { id = "" } = useParams();
  const [item, setItem] = useState<AssignmentRecord | null>(null);
  const [error, setError] = useState("");
  const [operation, setOperation] = useState<"" | "REASIGNAR" | "TRASLADAR" | "DEVOLVER">("");
  const [catalog, setCatalog] = useState<AssignmentCatalog | null>(null);
  const [reason, setReason] = useState("");
  const [responsibleId, setResponsibleId] = useState("");
  const [locationId, setLocationId] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingInfo, setEditingInfo] = useState(false);
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoForm, setInfoForm] = useState({ reason: "", status: "ACTIVA", assetStatus: "" });
  const locationMapImage = useLocationMapImage(item?.location?.reference_map?.id);
  const operationDialogRef = useRef<HTMLDialogElement>(null);
  const operationTriggerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    getAssignment(id)
      .then((value) => { setItem(value); setInfoForm({ reason: value.change_reason, status: value.status, assetStatus: value.asset.assignment_status }); })
      .catch(() => setError("No se pudo cargar la asignación."));
  }, [id]);
  useEffect(() => {
    getAssignmentCatalog().then(setCatalog);
  }, []);
  useEffect(() => {
    const dialog = operationDialogRef.current;
    if (!dialog) return;

    if (operation && !dialog.open) {
      operationTriggerRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      dialog.showModal();
    } else if (!operation && dialog.open) {
      dialog.close();
    }
  }, [operation]);
  const openOperation = (nextOperation: "REASIGNAR" | "TRASLADAR" | "DEVOLVER") => {
    setError("");
    setOperation(nextOperation);
  };
  const closeOperation = () => setOperation("");
  const submitOperation = async () => {
    if (!operation || !reason.trim()) return setError("Ingresa el motivo de la operación.");
    setSaving(true);
    setError("");
    try {
      await registerAssignmentOperation(id, {
        type: operation,
        reason,
        responsible_id: responsibleId || undefined,
        location_id: locationId || undefined,
      });
      setOperation("");
      setItem(await getAssignment(id));
    } catch {
      setError("No se pudo registrar la operación. Revisa los campos obligatorios.");
    } finally {
      setSaving(false);
    }
  };
  if (!item) return <section className="loading-panel">{error || "Cargando detalle…"}</section>;
  const visibleStatus = {
    ASIGNADO: "Asignado",
    ENTREGADO: "Entregado",
    EN_TRASLADO: "En traslado",
    DEVUELTO: "Devuelto",
  }[item.delivery_status];
  async function saveInfo() {
    if (!item) return;
    setSavingInfo(true);
    try {
      const updated = await updateAssignment(item.id, { change_reason: infoForm.reason.trim(), status: infoForm.status, asset_status: infoForm.assetStatus });
      setItem(updated);
      setEditingInfo(false);
    } finally { setSavingInfo(false); }
  }
  return (
    <section className="assignment-detail">
      <Link className="back-link" to="/asignaciones">
        <ArrowLeft />
        Volver a asignaciones
      </Link>
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Asignaciones / Detalle</p>
          <h1>{item.asset.name}</h1>
          <p>{getAssignmentAssetDisplayCode(item.asset)}</p>
        </div>
        <div className="detail-actions">
          <span
            className={`status ${item.delivery_status === "ENTREGADO" ? "status-success" : item.delivery_status === "DEVUELTO" ? "status-neutral" : "status-warning"}`}
          >
            {visibleStatus}
          </span>
          {item.status === "ACTIVA" && (
            <>
              <button
                className="button button-secondary"
                onClick={() => openOperation("TRASLADAR")}
              >
                Trasladar
              </button>
              <button
                className="button button-secondary"
                onClick={() => openOperation("REASIGNAR")}
              >
                Reasignar
              </button>
              <button className="button button-primary" onClick={() => openOperation("DEVOLVER")}>
                Registrar devolución
              </button>
            </>
          )}
        </div>
      </div>
      <div className="detail-grid">
        <div className="assignment-detail-main">
          <section className="detail-section">
            <h2>Asignación vigente</h2>
            <dl className="detail-facts">
              <div>
                <UserCircle />
                <dt>Responsable</dt>
                <dd>
                  {item.responsible.name}
                  <small>{item.responsible.area}</small>
                </dd>
              </div>
              <div>
                <MapPin />
                <dt>Ubicación</dt>
                <dd>
                  {item.location
                    ? `${item.location.zone} / ${item.location.building} / ${item.location.area} / ${item.location.room}`
                    : "Por confirmar"}
                </dd>
              </div>
              <div className="assignment-fact-editable">
                <FileText />
                <dt>Motivo</dt>
                <dd>{editingInfo ? <textarea rows={3} value={infoForm.reason} onChange={(event) => setInfoForm({ ...infoForm, reason: event.target.value })} /> : item.change_reason}</dd>
              </div>
            </dl>
            <div className="assignment-inline-editor">
              {editingInfo && <label><span>Estado de asignación</span><select value={infoForm.status} onChange={(event) => setInfoForm({ ...infoForm, status: event.target.value })}><option value="ACTIVA">Activa</option><option value="FINALIZADA">Finalizada</option><option value="ANULADA">Anulada</option></select></label>}
              {editingInfo && <label><span>Estado del bien</span><select value={infoForm.assetStatus} onChange={(event) => setInfoForm({ ...infoForm, assetStatus: event.target.value })}><option>Asignado</option><option>Entregado</option><option>En traslado</option><option>Devuelto</option><option>En Mantenimiento</option><option>Sin asignar</option></select></label>}
              {editingInfo ? <><button className="button button-secondary" type="button" onClick={() => setEditingInfo(false)}>Cancelar</button><button className="button button-primary" type="button" disabled={savingInfo} onClick={() => void saveInfo()}>Guardar cambios</button></> : <button className="button button-secondary" type="button" onClick={() => setEditingInfo(true)}>Editar información</button>}
            </div>
          </section>
          <section className="detail-section">
            <div className="section-heading">
              <div>
                <h2>Mapa de ubicación</h2>
                <p>Referencia operativa del lugar donde se encuentra el bien dentro de la sede.</p>
              </div>
              <Link className="map-asset-link" to={`/bienes/${item.asset.id}`}>
                Ver ficha e historial
              </Link>
            </div>
            {item.location ? (
              <div
                className="assignment-reference-map"
                aria-label={`Ubicación: ${item.location.zone}, ${item.location.building}, ${item.location.area}, ${item.location.room}`}
              >
                <nav className="assignment-location-breadcrumb" aria-label="Ruta de ubicación">
                  <span>{item.location.zone}</span>
                  <span aria-hidden="true">›</span>
                  <span>{item.location.building}</span>
                  <span aria-hidden="true">›</span>
                  <span>{item.location.area}</span>
                  <span aria-hidden="true">›</span>
                  <strong>{item.location.room}</strong>
                </nav>
                {item.location.reference_map && locationMapImage.isPending && <div className="assignment-reference-map-loading" aria-label="Cargando imagen referencial" />}
                {item.location.reference_map && locationMapImage.isError && (
                  <div className="assignment-reference-map-empty" role="alert">No se pudo cargar la imagen referencial del ambiente.</div>
                )}
                {item.location.reference_map && locationMapImage.data && (
                  <div className="assignment-reference-map-stage">
                    <img src={locationMapImage.data} alt={`Imagen referencial de ${item.location.room}`} />
                    {item.location.marker && (
                      <span
                        className="assignment-reference-map-marker"
                        style={{ left: `${Number(item.location.marker.x) * 100}%`, top: `${Number(item.location.marker.y) * 100}%` }}
                        aria-label={`Ubicación marcada: ${item.location.room}`}
                      >
                        <MapPin weight="fill" />
                      </span>
                    )}
                  </div>
                )}
                {!item.location.reference_map && (
                  <div className="assignment-reference-map-empty">Este ambiente todavía no tiene una imagen referencial cargada.</div>
                )}
                <div className="map-building">
                  <span className="map-caption">{item.location.zone}</span>
                  <strong>{item.location.building}</strong>
                  <div className="map-floor">
                    <span>{item.location.area}</span>
                    <div className="map-room">
                      <MapPin weight="fill" />
                      <strong>{item.location.room}</strong>
                      <small>{item.location.specific_location || "Ubicación confirmada"}</small>
                    </div>
                  </div>
                </div>
                <div className="map-legend">
                  <span>
                    <i />
                    Ubicación actual
                  </span>
                  <small>
                    Ruta: {item.location.zone} → {item.location.building} → {item.location.area} →{" "}
                    {item.location.room}
                  </small>
                </div>
              </div>
            ) : (
              <p className="map-empty">
                <MapPin />
                La ubicación todavía no ha sido confirmada.
              </p>
            )}
          </section>
        </div>
        <aside className="act-panel">
          <h2>Acta de entrega</h2>
          {item.act ? (
            <>
              <FileText size={36} />
              <strong>{item.act.code}</strong>
              <span className="status status-success">Documento emitido</span>
              <label>Hash SHA-256</label>
              <code>{item.act.hash_sha256}</code>
              <button className="button button-secondary" onClick={() => window.print()}>
                <DownloadSimple />
                Imprimir / guardar PDF
              </button>
              <p>
                <ShieldCheck />
                El documento es inmutable y conserva su integridad mediante hash.
              </p>
            </>
          ) : (
            <>
              <p>La asignación aún no cuenta con acta emitida.</p>
              <Link className="button button-primary" to="/asignaciones/nueva">
                Completar entrega
              </Link>
            </>
          )}
        </aside>
      </div>
      <dialog
        ref={operationDialogRef}
        className="operation-native-dialog"
        aria-labelledby="operation-title"
        onCancel={(event) => {
          event.preventDefault();
          closeOperation();
        }}
        onClose={() => {
          setOperation("");
          operationTriggerRef.current?.focus();
        }}
      >
        {operation && (
          <section className="operation-dialog">
            <header>
              <div>
                <p className="breadcrumb">Gestión de operación</p>
                <h2 id="operation-title">
                  {operation === "REASIGNAR"
                    ? "Reasignar bien"
                    : operation === "TRASLADAR"
                      ? "Registrar traslado"
                      : "Registrar devolución"}
                </h2>
              </div>
              <button className="icon-button" onClick={closeOperation} aria-label="Cerrar">
                <X />
              </button>
            </header>
            <p>
              Esta acción conservará el historial vigente y registrará el motivo de forma auditable.
            </p>
            {operation === "REASIGNAR" && (
              <label className="field">
                <span>Nuevo responsable *</span>
                <select value={responsibleId} onChange={(e) => setResponsibleId(e.target.value)}>
                  <option value="">Seleccionar</option>
                  {catalog?.responsibles.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.display_name} — {x.type}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {operation !== "DEVOLVER" && (
              <label className="field">
                <span>Ubicación destino *</span>
                <select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
                  <option value="">Seleccionar</option>
                  {catalog?.locations.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.building} / {x.area} / {x.room}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="field">
              <span>Motivo *</span>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} />
            </label>
            {error && (
              <p className="form-alert" role="alert">
                {error}
              </p>
            )}
            <footer>
              <button className="button button-secondary" onClick={closeOperation}>
                Cancelar
              </button>
              <button className="button button-primary" disabled={saving} onClick={submitOperation}>
                {saving
                  ? "Registrando…"
                  : operation === "REASIGNAR"
                    ? "Confirmar reasignación"
                    : operation === "TRASLADAR"
                      ? "Iniciar traslado"
                      : "Registrar devolución"}
              </button>
            </footer>
          </section>
        )}
      </dialog>
    </section>
  );
}
