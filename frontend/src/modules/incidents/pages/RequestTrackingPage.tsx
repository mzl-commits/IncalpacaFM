import { Camera, CheckCircle, ClipboardText, MagnifyingGlass, Star, XCircle } from "@phosphor-icons/react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { TrackingStatusCard } from "../components/TrackingStatusCard";
import { TrackingTimeline } from "../components/TrackingTimeline";
import { TrackingWorkerCard } from "../components/TrackingWorkerCard";
import type { RequestTracking } from "../trackingModel";
import { getTrackingByIncidentId, submitPublicConformity } from "../trackingRepository";

const finishedWorkStatuses = new Set([
  "PENDIENTE_DE_SUPERVISION",
  "PENDIENTE_DE_VALIDACION",
  "PENDIENTE_DE_CONFORMIDAD",
  "CERRADA",
]);

function isWorkFinished(tracking: RequestTracking) {
  return finishedWorkStatuses.has(tracking.workOrderStatus) || tracking.progressPercentage >= 100;
}

function getRejectionReason(tracking: RequestTracking) {
  return (
    tracking.events.find((event) => event.status === "RECHAZADO")?.description ||
    "La solicitud fue revisada y no fue aprobada para atención."
  );
}

function RejectedRequestCard({ tracking }: { tracking: RequestTracking }) {
  return (
    <article className="data-panel detail-card tracking-rejection-card">
      <div className="tracking-rejection-heading">
        <XCircle size={30} weight="duotone" />
        <div>
          <span>Solicitud no aprobada</span>
          <h2>No se generará una orden de trabajo</h2>
          <p>{getRejectionReason(tracking)}</p>
        </div>
      </div>
    </article>
  );
}

function WorkEvidenceCard({ tracking }: { tracking: RequestTracking }) {
  const evidence = tracking.workEvidence ?? [];
  const hasWorkOrder = Boolean(tracking.workOrderCode);
  const workFinished = isWorkFinished(tracking);
  const beforeEvidence = evidence[0];
  const afterEvidence = evidence.length > 1 ? evidence[evidence.length - 1] : undefined;

  if (!hasWorkOrder) {
    return (
      <article className="data-panel detail-card tracking-work-evidence-card">
        <div className="tracking-work-evidence-heading">
          <Camera size={28} weight="duotone" />
          <div>
            <span>Evidencias del trabajo</span>
            <h2>Aún no hay evidencias del trabajo</h2>
            <p>La solicitud todavía no tiene una orden de trabajo asignada.</p>
          </div>
        </div>
      </article>
    );
  }

  if (!workFinished) {
    return (
      <article className="data-panel detail-card tracking-work-evidence-card">
        <div className="tracking-work-evidence-heading">
          <Camera size={28} weight="duotone" />
          <div>
            <span>Evidencias del trabajo</span>
            <h2>Trabajo en proceso</h2>
            <p>Las evidencias aparecerán cuando el operario registre avances.</p>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="data-panel detail-card tracking-work-evidence-card">
      <div className="tracking-work-evidence-heading">
        <Camera size={28} weight="duotone" />
        <div>
          <span>Resultado del trabajo</span>
          <h2>Evidencias registradas</h2>
          <p>Por ahora mostramos los nombres de archivo. Cuando se guarden imágenes reales, aparecerán aquí.</p>
        </div>
      </div>

      {evidence.length ? (
        <div className="tracking-work-evidence-grid">
          <div className="tracking-work-evidence-item">
            <span>Antes</span>
            <strong>{beforeEvidence.name}</strong>
            <small>Avance {beforeEvidence.progressPercentage ?? 0}%</small>
          </div>
          <div className="tracking-work-evidence-item">
            <span>Después</span>
            <strong>{afterEvidence?.name ?? beforeEvidence.name}</strong>
            <small>Avance {afterEvidence?.progressPercentage ?? beforeEvidence.progressPercentage ?? 100}%</small>
          </div>
        </div>
      ) : (
        <p className="tracking-work-evidence-empty">El trabajo terminó sin evidencias registradas.</p>
      )}
    </article>
  );
}

export function RequestTrackingPage() {
  const params = useParams();
  const navigate = useNavigate();
  const token = params.code ?? params.id ?? "";
  const hasLoggedUser = Boolean(sessionStorage.getItem("sgtb_current_user"));
  const [searchCode, setSearchCode] = useState(token);
  const [tracking, setTracking] = useState<RequestTracking>();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [conformityComment, setConformityComment] = useState("");
  const [rating, setRating] = useState(5);
  const [conformityError, setConformityError] = useState("");
  const [sendingConformity, setSendingConformity] = useState(false);

  useEffect(() => {
    setSearchCode(token);
    setTracking(undefined);
    setFailed(false);
    if (!token) return;

    setLoading(true);
    void getTrackingByIncidentId(token)
      .then((data) => {
        setTracking(data);
        setFailed(false);
      })
      .catch(() => {
        setFailed(true);
      })
      .finally(() => setLoading(false));
  }, [token]);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanCode = searchCode.trim();
    if (!cleanCode) return;
    navigate(`/seguimiento-solicitud/${encodeURIComponent(cleanCode)}`);
  }

  async function handleConformity() {
    if (!tracking) return;

    setSendingConformity(true);
    setConformityError("");
    try {
      const updated = await submitPublicConformity(tracking.code, {
        rating,
        comment: conformityComment.trim(),
      });
      setTracking(updated);
      setConformityComment("");
    } catch {
      setConformityError("No pudimos registrar tu calificación. Intenta nuevamente.");
    } finally {
      setSendingConformity(false);
    }
  }
  const isRejected = tracking?.currentStatus === "RECHAZADO";

  return (
    <main className="public-request-page tracking-public-page">
      <section className="public-request-shell tracking-public-shell">
        <div className="page-heading tracking-public-heading">
          <div>
            <p className="breadcrumb">Seguimiento de solicitud</p>
            <h1>Consulta el avance de tu solicitud</h1>
            <p>Ingresa el código que recibiste al registrar la solicitud.</p>
          </div>
          <Link className="button button-secondary" to={hasLoggedUser ? "/incidencias/nueva" : "/solicitud-trabajo"}>
            Nueva solicitud
          </Link>
        </div>

        <form className="data-panel tracking-search-card" onSubmit={handleSearch}>
          <label className="field">
            <span>Código de solicitud</span>
            <input
              value={searchCode}
              onChange={(event) => setSearchCode(event.target.value)}
              placeholder="Ej. SOL-2026-0001"
            />
          </label>
          <button className="button button-primary" type="submit">
            <MagnifyingGlass size={18} />
            Consultar
          </button>
        </form>

        {loading && (
          <article className="data-panel detail-card tracking-empty-state">
            <ClipboardText size={30} />
            <h2>Buscando solicitud</h2>
            <p>Estamos consultando el estado registrado por mantenimiento.</p>
          </article>
        )}

        {!loading && failed && (
          <article className="data-panel detail-card tracking-empty-state">
            <ClipboardText size={30} />
            <h2>No encontramos esa solicitud</h2>
            <p>Revisa que el código esté escrito igual al que recibiste al registrar la solicitud.</p>
          </article>
        )}

        {!loading && !failed && !tracking && (
          <article className="data-panel detail-card tracking-empty-state">
            <ClipboardText size={30} />
            <h2>Busca tu solicitud</h2>
            <p>No necesitas código QR. Solo usa el código de solicitud que se generó al registrarla.</p>
          </article>
        )}

        {tracking && (
          <>
            <article className="data-panel detail-card tracking-request-card">
              <div>
                <span className="detail-code">{tracking.code}</span>
                <h2>{tracking.description}</h2>
                <p>{tracking.location}</p>
              </div>
            </article>

            {isRejected ? (
              <RejectedRequestCard tracking={tracking} />
            ) : (
              <>
                <div className="detail-grid tracking-detail-grid">
                  <TrackingStatusCard
                    status={tracking.currentStatus}
                    progress={tracking.progressPercentage}
                    workOrderCode={tracking.workOrderCode}
                  />

                  <TrackingWorkerCard
                    name={tracking.workerName}
                    specialty={tracking.workerSpecialty}
                  />
                </div>

                <WorkEvidenceCard tracking={tracking} />

                {tracking.canSubmitConformity && (
                  <article className="data-panel detail-card public-conformity-card">
                    <div className="public-conformity-heading">
                      <CheckCircle size={30} weight="duotone" />
                      <div>
                        <span>Trabajo ejecutado</span>
                        <h2>Califica la atención recibida</h2>
                        <p>Tu puntuación ayuda a mejorar el servicio de mantenimiento.</p>
                      </div>
                    </div>

                    <div className="public-rating-row" aria-label="Calificación del servicio">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={value}
                          type="button"
                          className={value <= rating ? "is-active" : ""}
                          onClick={() => setRating(value)}
                          aria-label={`Calificar con ${value}`}
                        >
                          <Star size={22} weight="fill" />
                        </button>
                      ))}
                    </div>

                    <label className="field field-wide">
                      <span>Comentario</span>
                      <textarea
                        rows={4}
                        value={conformityComment}
                        onChange={(event) => setConformityComment(event.target.value)}
                        placeholder="Ej. Buena atención, gracias. También puedes dejar una observación."
                      />
                    </label>

                    {conformityError && <div className="form-error">{conformityError}</div>}

                    <div className="public-conformity-actions">
                      <button
                        className="button button-primary"
                        type="button"
                        disabled={sendingConformity}
                        onClick={() => void handleConformity()}
                      >
                        <CheckCircle size={18} />
                        Enviar calificación
                      </button>
                    </div>
                  </article>
                )}

                {!tracking.canSubmitConformity && tracking.conformity?.at && (
                  <article className="data-panel detail-card public-conformity-card is-complete">
                    <div className="public-conformity-heading">
                      <CheckCircle size={30} weight="duotone" />
                      <div>
                        <span>Respuesta registrada</span>
                        <h2>Gracias por calificar</h2>
                        <p>{tracking.conformity.comment || "Tu calificación quedó registrada correctamente."}</p>
                      </div>
                    </div>
                  </article>
                )}
              </>
            )}

            <TrackingTimeline events={tracking.events} />
          </>
        )}
      </section>
    </main>
  );
}
