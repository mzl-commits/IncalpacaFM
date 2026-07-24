import {
  ArrowLeft,
  DownloadSimple,
  FileText,
  MapPin,
  ShieldCheck,
  UserCircle,
  X,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getAssignment,
  getAssignmentCatalog,
  registerAssignmentOperation,
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
  useEffect(() => {
    getAssignment(id)
      .then(setItem)
      .catch(() => setError("No se pudo cargar la asignación."));
  }, [id]);
  useEffect(() => {
    getAssignmentCatalog().then(setCatalog);
  }, []);
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
          <p>{item.asset.code}</p>
        </div>
        <div className="detail-actions">
          <span
            className={`status ${item.delivery_status === "ENTREGADO" ? "status-success" : item.delivery_status === "DEVUELTO" ? "status-neutral" : "status-warning"}`}
          >
            {visibleStatus}
          </span>
          {item.status === "ACTIVA" && (
            <>
              <button className="button button-secondary" onClick={() => setOperation("TRASLADAR")}>
                Trasladar
              </button>
              <button className="button button-secondary" onClick={() => setOperation("REASIGNAR")}>
                Reasignar
              </button>
              <button className="button button-primary" onClick={() => setOperation("DEVOLVER")}>
                Registrar devolución
              </button>
            </>
          )}
        </div>
      </div>
      <div className="detail-grid">
        <main>
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
              <div>
                <FileText />
                <dt>Motivo</dt>
                <dd>{item.change_reason}</dd>
              </div>
            </dl>
          </section>
          <section className="detail-section">
            <h2>Historial</h2>
            <ol className="assignment-timeline">
              <li>
                <span />
                <div>
                  <strong>Asignación creada</strong>
                  <p>
                    {new Intl.DateTimeFormat("es-PE", {
                      dateStyle: "long",
                      timeStyle: "short",
                    }).format(new Date(item.start_date))}
                  </p>
                  <small>Responsable: {item.responsible.name}</small>
                </div>
              </li>
              {item.act && (
                <li>
                  <span />
                  <div>
                    <strong>Acta emitida y bien entregado</strong>
                    <p>
                      {new Intl.DateTimeFormat("es-PE", {
                        dateStyle: "long",
                        timeStyle: "short",
                      }).format(new Date(item.act.issued_at))}
                    </p>
                    <small>{item.act.code}</small>
                  </div>
                </li>
              )}
            </ol>
          </section>
        </main>
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
      {operation && (
        <div className="operation-backdrop" role="presentation">
          <section
            className="operation-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="operation-title"
          >
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
              <button className="icon-button" onClick={() => setOperation("")} aria-label="Cerrar">
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
              <button className="button button-secondary" onClick={() => setOperation("")}>
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
        </div>
      )}
    </section>
  );
}
