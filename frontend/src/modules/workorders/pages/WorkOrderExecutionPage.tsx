import {
  ArrowLeft,
  Camera,
  FloppyDisk,
  Pause,
  Play,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";

import { currentUser } from "@/modules/accounts/currentUser";
import { getWorkRequestById } from "@/modules/incidents/incidentRepository";
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
export function WorkOrderExecutionPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [workOrder, setWorkOrder] = useState<Awaited<ReturnType<typeof getWorkOrderById>>>();
  const [request, setRequest] = useState<Awaited<ReturnType<typeof getWorkRequestById>>>();
  useEffect(() => {
    if (!id) return;
    void getWorkOrderById(id).then(async (order) => {
      setWorkOrder(order);
      setPercentage(order.progressPercentage);
      setRequest(await getWorkRequestById(order.requestId));
    });
  }, [id]);

  const [percentage, setPercentage] = useState(
    workOrder?.progressPercentage ?? 0,
  );

  const [observation, setObservation] =
    useState("");

  const [evidenceNames, setEvidenceNames] =
    useState<string[]>([]);

  const [error, setError] = useState("");

  async function handleStart() {
    if (!workOrder) {
      return;
    }

    const updated = await startWorkOrder(workOrder.id);

    if (updated) {
      setWorkOrder(updated);
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

    if (
      percentage <=
      workOrder.progressPercentage
    ) {
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

    if (observation.trim().length < 10) {
      setError(
        "La observación debe tener al menos 10 caracteres.",
      );
      return;
    }

    const updated =
      await registerWorkOrderProgress(
        workOrder.id,
        {
          operatorId: currentUser.id,
          operatorName: currentUser.fullName,
          percentage,
          observation,
          evidenceNames,
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

  const cannotExecute =
    workOrder.status ===
      "PENDIENTE_DE_SUPERVISION" ||
    workOrder.status ===
      "APROBADA_POR_SUPERVISOR" ||
    workOrder.status === "PENDIENTE_DE_VALIDACION" ||
    workOrder.status === "PENDIENTE_DE_CONFORMIDAD" ||
    workOrder.status === "CERRADA" ||
    workOrder.status === "CANCELADA";

  const hasActiveSession = Boolean(workOrder.activeWorkSession);
  const canStartSession = workOrder.status !== "EN_PROCESO" || !hasActiveSession;

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
            La orden no admite nuevos avances
          </h2>

          <p className="detail-empty">
            Su estado actual ya no permite que
            el operario registre modificaciones.
          </p>
        </article>
      ) : (
        <>
          {canStartSession && (
            <article className="data-panel execution-start-card">
              <div>
                <h2>Iniciar ejecución</h2>

                <p>
                  Usa este boton cada vez que empieces o retomes el trabajo.
                </p>
              </div>

              <button
                className="button button-primary"
                type="button"
                onClick={handleStart}
              >
                <Play
                  size={18}
                  weight="fill"
                />
                {workOrder.progressPercentage > 0 ? "Reanudar trabajo" : "Iniciar trabajo"}
              </button>
            </article>
          )}


          {hasActiveSession && (
            <article className="data-panel execution-start-card work-session-card">
              <div>
                <h2>Sesión activa</h2>
                <p>
                  El tiempo efectivo está corriendo. Pausa cuando dejes de trabajar en esta OT.
                </p>
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

                    <p>
                      Registra el porcentaje y
                      describe lo realizado.
                    </p>
                  </div>
                </div>
              </div>

              <div className="form-grid">
                <label className="field">
                  <span>
                    Porcentaje de avance *
                  </span>

                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={percentage}
                    onChange={(event) =>
                      setPercentage(
                        Number(
                          event.target.value,
                        ),
                      )
                    }
                  />

                  <small>
                    Avance anterior:{" "}
                    {
                      workOrder.progressPercentage
                    }{" "}
                    %
                  </small>
                </label>

                <label className="field field-wide">
                  <span>
                    Observación del operario *
                  </span>

                  <textarea
                    value={observation}
                    onChange={(event) =>
                      setObservation(
                        event.target.value,
                      )
                    }
                    rows={5}
                    maxLength={1000}
                    placeholder="Describe las tareas ejecutadas, dificultades y resultados."
                  />

                  <small>
                    {observation.length} / 1000
                    caracteres
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

              <button
                className="button button-primary"
                type="submit"
                disabled={workOrder.status !== "EN_PROCESO" || !hasActiveSession}
              >
                <FloppyDisk
                  size={18}
                  weight="bold"
                />

                {percentage === 100
                  ? "Finalizar y enviar a supervisión"
                  : "Guardar avance"}
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}
