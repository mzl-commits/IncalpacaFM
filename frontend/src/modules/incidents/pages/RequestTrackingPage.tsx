import { MagnifyingGlass, ClipboardText } from "@phosphor-icons/react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { TrackingStatusCard } from "../components/TrackingStatusCard";
import { TrackingTimeline } from "../components/TrackingTimeline";
import { TrackingWorkerCard } from "../components/TrackingWorkerCard";
import type { RequestTracking } from "../trackingModel";
import { getTrackingByIncidentId } from "../trackingRepository";

export function RequestTrackingPage() {
  const params = useParams();
  const navigate = useNavigate();
  const token = params.code ?? params.id ?? "";
  const [searchCode, setSearchCode] = useState(token);
  const [tracking, setTracking] = useState<RequestTracking>();
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

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

  return (
    <main className="public-request-page tracking-public-page">
      <section className="public-request-shell tracking-public-shell">
        <div className="page-heading tracking-public-heading">
          <div>
            <p className="breadcrumb">Seguimiento de solicitud</p>
            <h1>Consulta el avance de tu solicitud</h1>
            <p>Ingresa el codigo que recibiste al registrar la solicitud.</p>
          </div>
          <Link className="button button-secondary" to="/solicitud-trabajo">
            Nueva solicitud
          </Link>
        </div>

        <form className="data-panel tracking-search-card" onSubmit={handleSearch}>
          <label className="field">
            <span>Codigo de solicitud</span>
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
            <p>Revisa que el codigo este escrito igual al que recibiste al registrar la solicitud.</p>
          </article>
        )}

        {!loading && !failed && !tracking && (
          <article className="data-panel detail-card tracking-empty-state">
            <ClipboardText size={30} />
            <h2>Busca tu solicitud</h2>
            <p>No necesitas codigo QR. Solo usa el codigo de solicitud que se genero al registrarla.</p>
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

            <TrackingTimeline events={tracking.events} />
          </>
        )}
      </section>
    </main>
  );
}