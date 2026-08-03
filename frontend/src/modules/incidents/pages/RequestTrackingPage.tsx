import { CheckCircle, ClipboardText, MagnifyingGlass, Star, XCircle } from "@phosphor-icons/react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { TrackingStatusCard } from "../components/TrackingStatusCard";
import { TrackingTimeline } from "../components/TrackingTimeline";
import { TrackingWorkerCard } from "../components/TrackingWorkerCard";
import type { RequestTracking } from "../trackingModel";
import { getTrackingByIncidentId, submitPublicConformity } from "../trackingRepository";

export function RequestTrackingPage() {
  const params = useParams();
  const navigate = useNavigate();
  const token = params.code ?? params.id ?? "";
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

  async function handleConformity(accepted: boolean) {
    if (!tracking) return;
    if (!accepted && conformityComment.trim().length < 10) {
      setConformityError("Cuéntanos brevemente que falta revisar.");
      return;
    }

    setSendingConformity(true);
    setConformityError("");
    try {
      const updated = await submitPublicConformity(tracking.code, {
        accepted,
        rating: accepted ? rating : undefined,
        comment: conformityComment.trim(),
      });
      setTracking(updated);
      setConformityComment("");
    } catch {
      setConformityError("No pudimos registrar tu respuesta. Intenta nuevamente.");
    } finally {
      setSendingConformity(false);
    }
  }
  return (
    <main className="public-request-page tracking-public-page">
      <section className="public-request-shell tracking-public-shell">
        <div className="page-heading tracking-public-heading">
          <div>
            <p className="breadcrumb">Seguimiento de solicitud</p>
            <h1>Consulta el avance de tu solicitud</h1>
            <p>Ingresa el código que recibiste al registrar la solicitud.</p>
          </div>
          <Link className="button button-secondary" to="/solicitud-trabajo">
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
            <p>Revisa que el código este escrito igual al que recibiste al registrar la solicitud.</p>
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


            {tracking.canSubmitConformity && (
              <article className="data-panel detail-card public-conformity-card">
                <div className="public-conformity-heading">
                  <CheckCircle size={30} weight="duotone" />
                  <div>
                    <span>Trabajo ejecutado</span>
                    <h2>¿Todo quedó conforme?</h2>
                    <p>Tu respuestá ayuda a cerrar la atención o devolverla para revisión.</p>
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
                    placeholder="Ej. Quedó bien, gracias. Si falta algo, cuéntanos qué debemos revisar."
                  />
                </label>

                {conformityError && <div className="form-error">{conformityError}</div>}

                <div className="public-conformity-actions">
                  <button
                    className="button button-danger"
                    type="button"
                    disabled={sendingConformity}
                    onClick={() => void handleConformity(false)}
                  >
                    <XCircle size={18} />
                    Aún falta revisar
                  </button>
                  <button
                    className="button button-primary"
                    type="button"
                    disabled={sendingConformity}
                    onClick={() => void handleConformity(true)}
                  >
                    <CheckCircle size={18} />
                    Sí, quedó conforme
                  </button>
                </div>
              </article>
            )}

            {!tracking.canSubmitConformity && tracking.conformity?.at && (
              <article className="data-panel detail-card public-conformity-card is-complete">
                <div className="public-conformity-heading">
                  <CheckCircle size={30} weight="duotone" />
                  <div>
                    <span>Respuestá registrada</span>
                    <h2>{tracking.conformity.accepted ? "Gracias por confirmar" : "Revisión solicitada"}</h2>
                    <p>{tracking.conformity.comment || "Tu respuestá quedó guardada correctamente."}</p>
                  </div>
                </div>
              </article>
            )}
            <TrackingTimeline events={tracking.events} />
          </>
        )}
      </section>
    </main>
  );
}
