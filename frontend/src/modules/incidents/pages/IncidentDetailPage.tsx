import {
  ArrowLeft,
  Briefcase,
  CalendarBlank,
  EnvelopeSimple,
  MapPin,
  Paperclip,
  User,
  Warning,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { currentUser } from "@/modules/accounts/currentUser";
import { LocationMarkerPicker } from "@/modules/assets/components/LocationMarkerPicker";
import { useLocations } from "@/modules/assets/locationMapQueries";
import {
  requestPriorityLabels,
  requestStatusLabels,
  requestTypeLabels,
  type RequestStatus,
} from "@/modules/incidents/incidentModel";
import {
  getWorkRequestAssetDisplayCode,
  getWorkRequestById,
  updateWorkRequest,
} from "@/modules/incidents/incidentRepository";
import type { WorkRequest } from "@/modules/incidents/types";

const statusClass: Record<RequestStatus, string> = {
  PENDIENTE: "status-warning",
  EN_EVALUACION: "status-neutral",
  APROBADA: "status-success",
  RECHAZADA: "status-error",
  CONVERTIDA_EN_OT: "status-success",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

const impactAnswerLabels: Record<string, string> = {
  SI: "Si",
  NO: "No",
  SOLO_YO: "Solo yo",
  VARIAS_PERSONAS: "Varias personas",
  TODA_EL_AREA: "Toda el area",
};

function getOtherIssueCategoryDetail(request: WorkRequest) {
  const detail = request.impactAssessment?.answers?.otherIssueCategoryDetail ?? request.impactAssessment?.answers?.otherRequestDetail;
  return typeof detail === "string" ? detail.trim() : "";
}
function labelImpactAnswer(value?: string) {
  return value ? impactAnswerLabels[value] ?? value : "No indicado";
}

const reportedConditionLabels: Record<string, string> = {
  NO_FUNCIONA: "No funciona",
  FUNCIONA_PARCIALMENTE: "Funciona parcialmente",
  DANADO: "Está dañado o deteriorado",
  RIESGO: "Presenta una condición de riesgo",
};

const reportedTimingLabels: Record<string, string> = {
  AHORA: "Hace unos minutos",
  HOY: "Hoy",
  SEMANA: "Durante esta semana",
  MAS_TIEMPO: "Hace más de una semana",
};
export function IncidentDetailPage() {
  const { id } = useParams();

  const [request, setRequest] = useState<Awaited<ReturnType<typeof getWorkRequestById>>>();
  const locationsQuery = useLocations();
  useEffect(() => {
    if (id) void getWorkRequestById(id).then(setRequest);
  }, [id]);

  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [evaluationError, setEvaluationError] = useState("");

  const isAdministrator = currentUser.role === "ADMINISTRADOR";

  async function changeRequestStatus(
    status: "EN_EVALUACION" | "APROBADA",
  ) {
    if (!request) {
      return;
    }

    const updatedRequest = await updateWorkRequest(request.id, {
      status,
      rejectionReason: undefined,
    });

    if (updatedRequest) {
      setRequest(updatedRequest);
      setShowRejectForm(false);
      setRejectionReason("");
      setEvaluationError("");
    }
  }

  async function rejectRequest() {
    if (!request) {
      return;
    }

    const normalizedReason = rejectionReason.trim();

    if (normalizedReason.length < 10) {
      setEvaluationError(
        "El motivo del rechazo debe tener al menos 10 caracteres.",
      );
      return;
    }

    const updatedRequest = await updateWorkRequest(request.id, {
      status: "RECHAZADA",
      rejectionReason: normalizedReason,
    });

    if (updatedRequest) {
      setRequest(updatedRequest);
      setShowRejectForm(false);
      setRejectionReason("");
      setEvaluationError("");
    }
  }

  if (!request) {
    return (
      <section>
        <div className="page-heading">
          <div>
            <p className="breadcrumb">
              Mantenimiento / Solicitudes / Detalle
            </p>

            <h1>Solicitud no encontrada</h1>

            <p>
              La solicitud indicada no existe o ya no está disponible.
            </p>
          </div>

          <Link className="button button-secondary" to="/incidencias">
            <ArrowLeft size={18} />
            Volver
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="breadcrumb">
            Mantenimiento / Solicitudes / {request.code}
          </p>

          <h1>Detalle de solicitud</h1>

          <p>
            Consulta la información, ubicación y estado actual de la solicitud.
          </p>
        </div>

        <Link className="button button-secondary" to="/incidencias">
          <ArrowLeft size={18} />
          Volver
        </Link>
      </div>

      <div className="detail-header data-panel">
        <div>
          <span className="detail-code">{request.code}</span>

          <h2>{requestTypeLabels[request.requestType]}</h2>

          <p>{request.description}</p>
        </div>

        <span className={`status ${statusClass[request.status]}`}>
          {requestStatusLabels[request.status]}
        </span>
      </div>

      {isAdministrator && request.status !== "CONVERTIDA_EN_OT" && (
        <article className="data-panel admin-evaluation-card">
          <div>
            <h2>Evaluación administrativa</h2>

            <p>
              Revisa los datos de la solicitud y determina si procede su
              atención.
            </p>
          </div>

          <div className="admin-evaluation-actions">
            {request.status === "APROBADA" && (
              <div className="request-derivation-panel">
                <div>
                  <strong>Derivar solicitud</strong>
                  <p>Selecciona el tipo de atención que se generará para esta solicitud.</p>
                </div>

                <div className="request-derivation-options">
                  <Link className="request-derivation-option is-active" to={`/ordenes-trabajo/nueva/${request.id}`}>
                    <span>OT</span>
                    <strong>Orden de trabajo</strong>
                    <small>Mantenimiento o reparación con operario y supervisor.</small>
                  </Link>

                  <button className="request-derivation-option" type="button" disabled>
                    <span>OS</span>
                    <strong>Orden de servicio</strong>
                    <small>Pendiente de definir flujo de proveedor/servicio.</small>
                  </button>

                  <button className="request-derivation-option" type="button" disabled>
                    <span>OL</span>
                    <strong>Orden de limpieza</strong>
                    <small>Pendiente de definir flujo de limpieza.</small>
                  </button>
                </div>
              </div>
            )}

            {request.status === "PENDIENTE" && (
                <button
                className="button button-secondary"
                type="button"
                onClick={() => changeRequestStatus("EN_EVALUACION")}
                >
                Marcar en evaluación
                </button>
            )}

            {request.status !== "APROBADA" && (
                <button
                className="button button-primary"
                type="button"
                onClick={() => changeRequestStatus("APROBADA")}
                >
                Aprobar solicitud
                </button>
            )}

            {request.status !== "RECHAZADA" && (
                <button
                className="button button-danger"
                type="button"
                onClick={() => {
                    setShowRejectForm(true);
                    setEvaluationError("");
                }}
                >
                No aprobar solicitud
                </button>
            )}
            </div>

          {showRejectForm && (
            <div className="rejection-form">
              <label className="field">
                <span>Motivo de no aprobación *</span>

                <textarea
                  value={rejectionReason}
                  onChange={(event) =>
                    setRejectionReason(event.target.value)
                  }
                  placeholder="Explica claramente por qué la solicitud no será atendida."
                  rows={4}
                  maxLength={500}
                />

                <small>{rejectionReason.length} / 500 caracteres</small>
              </label>

              {evaluationError && (
                <div className="form-error">
                  {evaluationError}
                </div>
              )}

              <p className="rejection-scope-note">
                Esta acción cierra la solicitud de atención, pero no da de baja el bien.
              </p>

              <div className="rejection-form-actions">
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => {
                    setShowRejectForm(false);
                    setRejectionReason("");
                    setEvaluationError("");
                  }}
                >
                  Cancelar
                </button>

                <button
                  className="button button-danger"
                  type="button"
                  onClick={rejectRequest}
                >
                  Confirmar no aprobación
                </button>
              </div>
            </div>
          )}
        </article>
      )}

      <div className="detail-grid">
        <article className="data-panel detail-card">
          <div className="detail-card-heading">
            <User size={22} />
            <h2>Solicitante</h2>
          </div>

          <dl className="detail-list">
            {getWorkRequestAssetDisplayCode(request) && (
              <div>
                <dt>Bien asociado</dt>
                <dd>
                  {request.assetId ? (
                    <Link to={`/bienes/${request.assetId}`} style={{textDecoration: "underline", color: "var(--brand-primary)"}}>
                      {getWorkRequestAssetDisplayCode(request)}
                    </Link>
                  ) : (
                    getWorkRequestAssetDisplayCode(request)
                  )}
                </dd>
              </div>
            )}
            <div>
              <dt>Nombre</dt>
              <dd>{request.requesterName}</dd>
            </div>

            <div>
              <dt>Correo</dt>
              <dd>
                <EnvelopeSimple size={17} />
                {request.requesterEmail}
              </dd>
            </div>

            {request.requesterPhone && (
              <div>
                <dt>Telefono</dt>
                <dd>{request.requesterPhone}</dd>
              </div>
            )}

            {request.requesterContact?.workerCode && (
              <div>
                <dt>Codigo de trabajador</dt>
                <dd>{request.requesterContact.workerCode}</dd>
              </div>
            )}

            <div>
              <dt>Fecha de reporte</dt>
              <dd>
                <CalendarBlank size={17} />
                {formatDate(request.reportedAt)}
              </dd>
            </div>
          </dl>
          {(() => {
            const location = locationsQuery.data?.find((item) => item.id === request.locationId);
            return location?.activeMap ? <LocationMarkerPicker locationName={`${location.building} / ${location.room}`} locationMap={location.activeMap} markerX={request.locationMarkerX ?? null} markerY={request.locationMarkerY ?? null} subjectLabel="incidente" readOnly onChange={() => undefined} /> : null;
          })()}
        </article>

        <article className="data-panel detail-card">
          <div className="detail-card-heading">
            <MapPin size={22} />
            <h2>Ubicación</h2>
          </div>

          <dl className="detail-list">
            <div>
              <dt>Zona</dt>
              <dd>{request.zone}</dd>
            </div>

            <div>
              <dt>Edificio</dt>
              <dd>{request.building}</dd>
            </div>

            <div>
              <dt>Área</dt>
              <dd>{request.area}</dd>
            </div>

            <div>
              <dt>Ambiente</dt>
              <dd>{request.room}</dd>
            </div>
          </dl>
        </article>

        <article className="data-panel detail-card">
          <div className="detail-card-heading">
            <Warning size={22} />
            <h2>Clasificación</h2>
          </div>

          <dl className="detail-list">
            <div>
              <dt>Tipo de solicitud</dt>
              <dd>{requestTypeLabels[request.requestType]}</dd>
            </div>
            {getOtherIssueCategoryDetail(request) && (
              <div>
                <dt>Detalle indicado</dt>
                <dd>{getOtherIssueCategoryDetail(request)}</dd>
              </div>
            )}

            <div>
              <dt>Prioridad declarada</dt>
              <dd>{requestPriorityLabels[request.requesterPriority]}</dd>
            </div>

            <div>
              <dt>¿Corresponde a proyecto?</dt>
              <dd>{request.project ? "Sí" : "No"}</dd>
            </div>
          </dl>
        </article>

        <article className="data-panel detail-card">
          <div className="detail-card-heading">
            <Briefcase size={22} />
            <h2>Orden de trabajo</h2>
          </div>

          {request.workOrderId ? (
            <>
              <dl className="detail-list">
                <div>
                  <dt>Orden relacionada</dt>
                  <dd>
                    <Link to={`/ordenes-trabajo/${request.workOrderId}`} style={{textDecoration: "underline", color: "var(--brand-primary)"}}>
                      {request.workOrderId}
                    </Link>
                  </dd>
                </div>
              </dl>

              <Link
                className="button button-primary"
                to={`/incidencias/${request.id}/seguimiento`}
              >
                Ver seguimiento
              </Link>
            </>
          ) : (
            <p className="detail-empty">
              Esta solicitud todavía no tiene una orden de trabajo asociada.
            </p>
          )}
        </article>
      </div>


      {request.impactAssessment && (
        <article className="data-panel detail-card public-impact-review">
          <div className="detail-card-heading">
            <Warning size={22} />
            <h2>Evaluacion del impacto</h2>
          </div>

          <dl className="detail-list">
            <div>
              <dt>Solicitud registrada</dt>
              <dd>{requestTypeLabels[request.requestType]}</dd>
            </div>
{request.impactAssessment.answers?.assetCondition ? (
              <div>
                <dt>Estado informado</dt>
                <dd>{reportedConditionLabels[request.impactAssessment.answers.assetCondition] ?? request.impactAssessment.answers.assetCondition}</dd>
              </div>
            ) : null}

            {request.impactAssessment.answers?.startedWhen ? (
              <div>
                <dt>Cuándo se notó</dt>
                <dd>{reportedTimingLabels[request.impactAssessment.answers.startedWhen] ?? request.impactAssessment.answers.startedWhen}</dd>
              </div>
            ) : null}

            <div>
              <dt>Prioridad sugerida</dt>
              <dd>
                {request.impactAssessment.suggestedPriority
                  ? requestPriorityLabels[request.impactAssessment.suggestedPriority]
                  : "No indicada"}
              </dd>
            </div>

            <div>
              <dt>Impide trabajar normalmente</dt>
              <dd>{labelImpactAnswer(request.impactAssessment.answers?.stopsWork)}</dd>
            </div>

            <div>
              <dt>Riesgo para seguridad o salud</dt>
              <dd>{labelImpactAnswer(request.impactAssessment.answers?.safetyRisk)}</dd>
            </div>

            <div>
              <dt>Afecta equipo o servicio indispensable</dt>
              <dd>{labelImpactAnswer(request.impactAssessment.answers?.essentialService)}</dd>
            </div>

            <div>
              <dt>Puede generar danos mayores</dt>
              <dd>{labelImpactAnswer(request.impactAssessment.answers?.biggerDamageRisk)}</dd>
            </div>

            <div>
              <dt>Personas afectadas</dt>
              <dd>{labelImpactAnswer(request.impactAssessment.answers?.affectedPeople)}</dd>
            </div>
          </dl>

          {request.impactAssessment.priorityReasons?.length ? (
            <div className="impact-reasons">
              <strong>Motivos</strong>
              <ul>
                {request.impactAssessment.priorityReasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>
      )}
      <article className="data-panel detail-card detail-evidence">
        <div className="detail-card-heading">
          <Paperclip size={22} />
          <h2>Evidencias adjuntas</h2>
        </div>

        {request.evidence.length ? (
          <ul className="evidence-list">
            {request.evidence.map((evidence) => (
              <li key={evidence.id}>
                <strong>{evidence.name}</strong>
                <span>{evidence.mimeType}</span>
              </li>
            ))}
          </ul>
        ) : request.impactAssessment?.noPhotoReason ? (
          <div className="detail-empty evidence-empty-note">
            <span>No adjunto fotografia</span>
            <p>Motivo: {request.impactAssessment.noPhotoReason}</p>
          </div>
        ) : (
          <p className="detail-empty">
            La solicitud no tiene fotografias o archivos adjuntos.
          </p>
        )}
      </article>

      {request.rejectionReason && (
        <article className="data-panel rejection-card">
          <h2>Motivo de no aprobación</h2>
          <p>{request.rejectionReason}</p>
        </article>
      )}
    </section>
  );
}
