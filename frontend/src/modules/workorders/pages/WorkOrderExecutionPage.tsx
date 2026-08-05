import {
  ArrowLeft,
  Camera,
  FloppyDisk,
  Pause,
  Play,
  WarningCircle,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";

import { getWorkRequestById } from "@/modules/incidents/incidentRepository";
import { getWorkOrderReturnInfo } from "@/modules/workorders/workOrderModel";
import {
  getWorkOrderById,
  pauseWorkOrder,
  registerWorkOrderProgress,
  startWorkOrder,
} from "@/modules/workorders/workOrderRepository";

function formatMinutesDuration(minutes?: number) {
  if (minutes === undefined || minutes === null || minutes <= 0) return "0 min";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
}

function formatTimer(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return [hours, minutes, rest].map((value) => String(value).padStart(2, "0")).join(":");
}

function getReviewText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "Sin motivo registrado.";
}
export function WorkOrderExecutionPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [workOrder, setWorkOrder] = useState<Awaited<ReturnType<typeof getWorkOrderById>>>();
  const [request, setRequest] = useState<Awaited<ReturnType<typeof getWorkRequestById>>>();
  useEffect(() => {
    if (!id) return;
    void getWorkOrderById(id).then(async (order) => {
      setWorkOrder(order);
      const returnedForCorrection = Boolean(getWorkOrderReturnInfo(order));
      setPercentage(returnedForCorrection ? order.progressPercentage : Math.min(order.progressPercentage + 1, 100));
      setRequest(await getWorkRequestById(order.requestId));
    });
  }, [id]);

  const [percentage, setPercentage] = useState(
    workOrder?.progressPercentage ?? 0,
  );

  const [observation, setObservation] =
    useState("");
  const [timerNow, setTimerNow] = useState(() => Date.now());

  const [evidenceNames, setEvidenceNames] =
    useState<string[]>([]);
  const [startPhoto, setStartPhoto] = useState<File | null>(null);
  const [finishPhoto, setFinishPhoto] = useState<File | null>(null);

  const [error, setError] = useState("");

  useEffect(() => {
    if (!workOrder?.activeWorkSession?.startAt) return undefined;
    const interval = window.setInterval(() => setTimerNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [workOrder?.activeWorkSession?.startAt]);

  async function handleStart() {
    if (!workOrder) {
      return;
    }

    if (!startPhoto && !workOrder.startPhoto) {
      setError("Adjunta una foto del estado inicial antes de iniciar la orden.");
      return;
    }

    const updated = await startWorkOrder(workOrder.id, startPhoto);

    if (updated) {
      setWorkOrder(updated);
      setStartPhoto(null);
      setError("");
    }
  }


  async function handlePause() {
    if (!workOrder) {
      return;
    }

    const updated = await pauseWorkOrder(workOrder.id);

    if (updated) {
      setWorkOrder(updated);
    }
  }
  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!workOrder) {
      return;
    }

    if (workOrder.status !== "EN_PROCESO" || !workOrder.activeWorkSession) {
      setError(
        "Inicia o reanuda el trabajo antes de registrar avance.",
      );
      return;
    }

    const canResendReturnedWork =
      Boolean(getWorkOrderReturnInfo(workOrder)) &&
      workOrder.progressPercentage === 100 &&
      percentage === 100;

    if (percentage <= workOrder.progressPercentage && !canResendReturnedWork) {
      setError(
        `El avance debe ser mayor al ${workOrder.progressPercentage} % registrado.`,
      );
      return;
    }

    if (percentage > 100) {
      setError(
        "El porcentaje no puede superar el 100 %.",
      );
      return;
    }

    if (percentage === 100 && !finishPhoto && !workOrder.finishPhoto) {
      setError("Adjunta una foto del trabajo terminado antes de finalizar la orden.");
      return;
    }

    const updated =
      await registerWorkOrderProgress(
        workOrder.id,
        {
          percentage,
          observation,
          evidenceNames,
          finishPhoto,
        },
      );

    if (!updated) {
      setError(
        "No se pudo registrar el avance.",
      );
      return;
    }

    setWorkOrder(updated);
    setObservation("");
    setEvidenceNames([]);
    setFinishPhoto(null);
    setError("");

    navigate(
      `/ordenes-trabajo/${updated.id}`,
    );
  }

  if (!workOrder) {
    return (
      <section>
        <div className="page-heading">
          <div>
            <p className="breadcrumb">
              Mantenimiento / Órdenes / Ejecución
            </p>

            <h1>Orden no encontrada</h1>

            <p>
              La orden indicada no existe.
            </p>
          </div>

          <Link
            className="button button-secondary"
            to="/ordenes-trabajo"
          >
            <ArrowLeft size={18} />
            Volver
          </Link>
        </div>
      </section>
    );
  }

  const returnInfo = getWorkOrderReturnInfo(workOrder);
  const isCorrectionScheduledForFuture = Boolean(
    returnInfo && workOrder.scheduledDate > new Date().toISOString().slice(0, 10),
  );
  const cannotExecute =
    workOrder.status ===
      "PENDIENTE_DE_SUPERVISION" ||
    workOrder.status ===
      "APROBADA_POR_SUPERVISOR" ||
    workOrder.status === "PENDIENTE_DE_VALIDACION" ||
    workOrder.status === "PENDIENTE_DE_CONFORMIDAD" ||
    workOrder.status === "CERRADA" ||
    workOrder.status === "CANCELADA" ||
    isCorrectionScheduledForFuture;

  const hasActiveSession = Boolean(workOrder.activeWorkSession);
  const isReturnedForCorrection = Boolean(returnInfo);
  const returnComment = getReviewText(returnInfo?.comment);
  const minimumProgress = isReturnedForCorrection ? workOrder.progressPercentage : Math.min(workOrder.progressPercentage + 1, 100);
  const canStartSession = workOrder.status !== "EN_PROCESO" || !hasActiveSession;
  const activeSessionSeconds = workOrder.activeWorkSession?.startAt
    ? Math.max(0, Math.floor((timerNow - new Date(workOrder.activeWorkSession.startAt).getTime()) / 1000))
    : 0;

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="breadcrumb">
            Mantenimiento / Órdenes /{" "}
            {workOrder.code} / Ejecución
          </p>

          <h1>Ejecutar orden de trabajo</h1>

          <p>
            Registra el avance y las evidencias
            del trabajo realizado.
          </p>
        </div>

        <Link
          className="button button-secondary"
          to={`/ordenes-trabajo/${workOrder.id}`}
        >
          <ArrowLeft size={18} />
          Volver
        </Link>
      </div>

      <div className="detail-header data-panel">
        <div>
          <span className="detail-code">
            {workOrder.code}
          </span>

          <h2>
            {request?.description ??
              "Orden de trabajo"}
          </h2>

          <p>
            Operario asignado:{" "}
            {workOrder.operatorName}
          </p>
        </div>

        <strong>
          {workOrder.progressPercentage} %
        </strong>
      </div>

      {cannotExecute ? (
        <article className="data-panel detail-card">
          <h2>
            {isCorrectionScheduledForFuture ? "Corrección programada" : "La orden no admite nuevos avances"}
          </h2>

          <p className="detail-empty">
            {isCorrectionScheduledForFuture
              ? `Esta corrección está programada para ${workOrder.scheduledDate} a las ${workOrder.scheduledStartTime?.slice(0, 5) || "08:00"}.`
              : "Su estado actual ya no permite que el operario registre modificaciones."}
          </p>
        </article>
      ) : (
        <>
          {returnInfo && (
            <article className="data-panel detail-card returned-work-order-card">
              <div>
                <WarningCircle size={28} weight="duotone" />
                <div>
                  <h2>{returnInfo.title}</h2>
                  <p>{returnComment}</p>
                  <small>{returnInfo.nextStep}</small>
                </div>
              </div>
            </article>
          )}

          {canStartSession && (
            <article id="work-session-start" className="data-panel execution-start-card">
              <div>
                <h2>Iniciar ejecución</h2>

                <p>
                  Usa este botón cada vez que empieces o retomes el trabajo.
                </p>
              </div>

              <div className="execution-start-actions">
                {!workOrder.startPhoto && (
                  <label className="button button-secondary execution-photo-picker">
                    <Camera size={18} />
                    {startPhoto ? "Cambiar foto inicial" : "Tomar foto inicial"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      capture="environment"
                      hidden
                      onChange={(event) => setStartPhoto(event.target.files?.[0] ?? null)}
                    />
                  </label>
                )}
                {startPhoto && <small className="execution-photo-name">Foto inicial: {startPhoto.name}</small>}
                <button
                  className="button button-primary"
                  type="button"
                  onClick={() => void handleStart()}
                >
                  <Play
                    size={18}
                    weight="fill"
                  />
                  {workOrder.progressPercentage > 0 ? "Reanudar trabajo" : "Iniciar trabajo"}
                </button>
              </div>
            </article>
          )}


          {hasActiveSession && (
            <article className="data-panel execution-start-card work-session-card">
              <div>
                <h2>Sesión activa</h2>
                <p>
                  El tiempo efectivo está corriendo. Pausa cuando dejes de trabajar en esta OT.
                </p>
                <strong className="work-session-timer" aria-label={`Sesión activa: ${formatTimer(activeSessionSeconds)}`}>
                  {formatTimer(activeSessionSeconds)}
                </strong>
                <small>Tiempo efectivo acumulado: {formatMinutesDuration(workOrder.effectiveWorkMinutes)}</small>
              </div>

              <button
                className="button button-secondary"
                type="button"
                onClick={handlePause}
              >
                <Pause size={18} weight="fill" />
                Pausar trabajo
              </button>
            </article>
          )}
          <form
            className="data-panel"
            onSubmit={handleSubmit}
          >
            <div className="form-section">
              <div className="section-heading">
                <div>
                  <span className="section-number">
                    1
                  </span>

                  <div>
                    <h2>Avance del trabajo</h2>

                    <p>Actualiza el avance. El tiempo se registra únicamente con la sesión activa.</p>
                  </div>
                </div>
              </div>

              <div className="form-grid">
                <label className="field field-wide progress-range-field">
                  <span>Porcentaje de avance <output>{percentage} %</output></span>
                  <input
                    type="range"
                    min={minimumProgress}
                    max={100}
                    step={1}
                    value={percentage}
                    onChange={(event) => setPercentage(Number(event.target.value))}
                    aria-valuetext={`${percentage} por ciento de avance`}
                  />
                  <div className="progress-range-scale"><small>Anterior: {workOrder.progressPercentage} %</small><small>Finalizado: 100 %</small></div>
                  {percentage < 100 && (
                    <button className="progress-complete-button" type="button" onClick={() => setPercentage(100)}>
                      Marcar como terminado
                    </button>
                  )}
                </label>

                <label className="field field-wide">
                  <span>Nota para la solicitud <em>Opcional</em></span>

                  <textarea
                    value={observation}
                    onChange={(event) =>
                      setObservation(
                        event.target.value,
                      )
                    }
                    rows={5}
                    maxLength={1000}
                    placeholder="Comparte una actualización, hallazgo o dificultad si es necesario."
                  />

                  <small>
                    Se enviará junto al avance. {observation.length} / 1000 caracteres
                  </small>
                </label>
              </div>
            </div>

            <div className="form-section">
              <div className="section-heading">
                <div>
                  <span className="section-number">
                    2
                  </span>

                  <div>
                    <h2>Evidencias</h2>

                    <p>
                      Adjunta fotografías del
                      avance o trabajo terminado.
                    </p>
                  </div>
                </div>
              </div>

              <div className="upload-box">
                <Camera size={32} />

                <div>
                  <strong>
                    Adjuntar fotografías
                  </strong>

                  <p>
                    Puedes seleccionar varios
                    archivos.
                  </p>
                </div>

                <label className="button button-secondary">
                  Seleccionar archivos

                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    hidden
                    onChange={(event) => {
                      const names =
                        Array.from(
                          event.target.files ?? [],
                        ).map(
                          (file) => file.name,
                        );

                      setEvidenceNames(names);
                    }}
                  />
                </label>
              </div>

              {evidenceNames.length > 0 && (
                <ul className="selected-files-list">
                  {evidenceNames.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              )}

              {percentage === 100 && !workOrder.finishPhoto && (
                <div className="completion-photo-field">
                  <div><Camera size={24} /><span><strong>Foto de finalización obligatoria</strong><small>Registra el resultado final antes de enviar la OT a supervisión.</small></span></div>
                  <label className="button button-secondary execution-photo-picker">
                    {finishPhoto ? "Cambiar foto final" : "Tomar foto final"}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      capture="environment"
                      hidden
                      onChange={(event) => setFinishPhoto(event.target.files?.[0] ?? null)}
                    />
                  </label>
                  {finishPhoto && <small className="execution-photo-name">Foto final: {finishPhoto.name}</small>}
                </div>
              )}
            </div>

            {error && (
              <div className="form-error">
                {error}
              </div>
            )}

            <div className="form-actions">
              <Link
                className="button button-secondary"
                to={`/ordenes-trabajo/${workOrder.id}`}
              >
                Cancelar
              </Link>

              {hasActiveSession ? (
                <button className="button button-primary" type="submit">
                  <FloppyDisk size={18} weight="bold" />
                  {percentage === 100
                    ? isReturnedForCorrection
                      ? "Reenviar a supervisión"
                      : "Finalizar y enviar a supervisión"
                    : "Guardar avance"}
                </button>
              ) : (
                <button
                  className="button button-primary"
                  type="button"
                  onClick={() => document.getElementById("work-session-start")?.scrollIntoView({ behavior: "smooth", block: "center" })}
                >
                  <Play size={18} weight="fill" />
                  {workOrder.startPhoto ? "Reanudar trabajo para continuar" : "Iniciar trabajo para continuar"}
                </button>
              )}
            </div>
          </form>
        </>
      )}
    </section>
  );
}
