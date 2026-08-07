import {
  ArrowLeft,
  Briefcase,
  CalendarBlank,
  CheckCircle,
  ClockCounterClockwise,
  ClipboardText,
  MapPin,
  ShieldCheck,
  Stethoscope,
  User,
  Wrench,
  XCircle,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { useAuth } from "@/modules/accounts/AuthContext";
import { getWorkRequestById } from "@/modules/incidents/incidentRepository";
import {
  adminPriorityLabels,
  getWorkOrderReturnInfo,
  specialtyLabels,
  workOrderStatusLabels,
  type WorkOrderStatus,
} from "@/modules/workorders/workOrderModel";
import {
  adminReviewWorkOrder,
  getWorkOrderAssetDisplayCode,
  getWorkOrderById,
  scheduleWorkOrderCorrection,
} from "@/modules/workorders/workOrderRepository";
import type { WorkOrder } from "@/modules/workorders/types";

const statusClass: Record<WorkOrderStatus, string> = {
  PROGRAMADA: "status-neutral",
  ASIGNADA: "status-warning",
  EN_PROCESO: "status-warning",
  PENDIENTE_DE_SUPERVISION: "status-neutral",
  PENDIENTE_DE_VALIDACION: "status-warning",
  PENDIENTE_DE_CONFORMIDAD: "status-warning",
  DEVUELTA: "status-error",
  REPROCESO: "status-error",
  APROBADA_POR_SUPERVISOR: "status-success",
  CERRADA: "status-success",
  CANCELADA: "status-error",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateTime(value?: string) {
  if (!value) return "No registrado";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatWorkDuration(start?: string, end?: string) {
  if (!start) return "Aún no inicia";
  if (!end) return "En curso";

  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return "No disponible";

  const totalMinutes = Math.round(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}


function formatMinutesDuration(minutes?: number) {
  if (minutes === undefined || minutes === null) return "No registrado";
  if (minutes <= 0) return "0 min";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
}
function getTextValue(data: Record<string, unknown> | { comment?: unknown } | null | undefined, key: string, fallback: string) {
  const value = data && key === "comment" ? data.comment : (data as Record<string, unknown> | undefined)?.[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function getRatingLabel(data: Record<string, unknown> | { rating?: unknown } | null | undefined) {
  const value = data && "rating" in data ? data.rating : undefined;
  if (typeof value === "number") return `${value} de 5`;
  if (typeof value === "string" && value.trim()) return `${value} de 5`;
  return "Sin puntuación";
}



type CorrectionSchedule = {
  scheduledDate: string;
  scheduledStartTime: string;
  plannedHours: string;
  administratorNotes: string;
};

function getCorrectionSchedule(workOrder: WorkOrder): CorrectionSchedule | undefined {
  const raw = workOrder.recommendation_snapshot?.correctionSchedule;
  if (!raw || typeof raw !== "object") return undefined;
  const value = raw as Record<string, unknown>;
  const scheduledDate = typeof value.scheduledDate === "string" ? value.scheduledDate : "";
  if (!scheduledDate) return undefined;
  return {
    scheduledDate,
    scheduledStartTime: typeof value.scheduledStartTime === "string" ? value.scheduledStartTime : "08:00",
    plannedHours: typeof value.plannedHours === "number" || typeof value.plannedHours === "string" ? String(value.plannedHours) : "-",
    administratorNotes: typeof value.administratorNotes === "string" && value.administratorNotes.trim() ? value.administratorNotes : "Sin indicaciones adicionales.",
  };
}
function getValidationLabel(data: Record<string, unknown> | undefined, returnedLabel = "Devuelta") {
  if (!data || typeof data.approved !== "boolean") return "Sin validar";
  return data.approved ? "Aprobada" : "Devuelta";
}

export function WorkOrderDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [workOrder, setWorkOrder] = useState<WorkOrder>();
  const [request, setRequest] = useState<Awaited<ReturnType<typeof getWorkRequestById>>>();
  const [adminComment, setAdminComment] = useState("");
  const [adminError, setAdminError] = useState("");
  const [savingAdminReview, setSavingAdminReview] = useState(false);
  const [correctionDate, setCorrectionDate] = useState(todayKey());
  const [correctionTime, setCorrectionTime] = useState("08:00");
  const [correctionHours, setCorrectionHours] = useState(2);
  const [correctionNotes, setCorrectionNotes] = useState("");
  const [correctionError, setCorrectionError] = useState("");
  const [correctionSuccess, setCorrectionSuccess] = useState("");
  const [savingCorrection, setSavingCorrection] = useState(false);

  useEffect(() => {
    if (!id) return;
    void getWorkOrderById(id).then(async (order) => {
      setWorkOrder(order);
      setCorrectionDate(order.scheduledDate || todayKey());
      setCorrectionTime(order.scheduledStartTime?.slice(0, 5) || "08:00");
      setCorrectionHours(order.plannedHours || 2);
      setCorrectionNotes(order.administratorNotes || "");
      setRequest(await getWorkRequestById(order.requestId));
    });
  }, [id]);

  async function handleAdminReview(approved: boolean) {
    if (!workOrder) return;
    if (!approved && adminComment.trim().length < 10) {
      setAdminError("Escribe el motivo antes de devolver la orden.");
      return;
    }

    setSavingAdminReview(true);
    setAdminError("");
    try {
      const updated = await adminReviewWorkOrder(workOrder.id, approved, adminComment.trim());
      setWorkOrder(updated);
      setAdminComment("");
    } catch {
      setAdminError("No se pudo registrar la validación administrativa.");
    } finally {
      setSavingAdminReview(false);
    }
  }


  async function handleScheduleCorrection(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!workOrder) return;
    if (!correctionDate) {
      setCorrectionError("Selecciona la fecha de corrección.");
      return;
    }
    if (correctionHours < 1 || correctionHours > 16) {
      setCorrectionError("Las horas estimadas deben estar entre 1 y 16.");
      return;
    }

    setSavingCorrection(true);
    setCorrectionError("");
    setCorrectionSuccess("");
    try {
      const updated = await scheduleWorkOrderCorrection(workOrder.id, {
        scheduledDate: correctionDate,
        scheduledStartTime: correctionTime,
        plannedHours: correctionHours,
        administratorNotes: correctionNotes.trim(),
      });
      setWorkOrder(updated);
      setCorrectionSuccess("Programación guardada. El operario verá la corrección en su agenda.");
    } catch {
      setCorrectionError("No se pudo programar la corrección. Revisa los datos e intenta nuevamente.");
    } finally {
      setSavingCorrection(false);
    }
  }

  if (!workOrder) {
  return (
      <section>
        <div className="page-heading">
          <div>
            <p className="breadcrumb">Mantenimiento / Órdenes de trabajo / Detalle</p>
            <h1>Orden de trabajo no encontrada</h1>
            <p>La orden indicada no existe o ya no está disponible.</p>
          </div>
          <Link className="button button-secondary" to="/ordenes-trabajo">
            <ArrowLeft size={18} />
            Volver
          </Link>
        </div>
      </section>
    );
  }

  const isAdmin = user?.role === "ADMINISTRADOR";
  const needsAdminReview = workOrder.status === "PENDIENTE_DE_VALIDACION";
  const canRegisterProgress = ![
    "CERRADA",
    "CANCELADA",
    "PENDIENTE_DE_SUPERVISION",
    "PENDIENTE_DE_VALIDACION",
    "PENDIENTE_DE_CONFORMIDAD",
  ].includes(workOrder.status);
  const supervisorComment = getTextValue(
    workOrder.supervisor_validation,
    "comment",
    "Sin comentario del supervisor",
  );
  const adminRegisteredComment = getTextValue(
    workOrder.administrator_validation,
    "comment",
    "Sin comentario administrativo",
  );

  const requesterComment = getTextValue(
    workOrder.satisfaction,
    "comment",
    "La evaluación del solicitante es opcional",
  );
  const returnInfo = getWorkOrderReturnInfo(workOrder);
  const correctionSchedule = getCorrectionSchedule(workOrder);
  const hasLinkedCorrection = Boolean(workOrder.correctionWorkOrderId);
  const canScheduleCorrection = isAdmin && Boolean(returnInfo) && !correctionSchedule && !hasLinkedCorrection;

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="breadcrumb">Mantenimiento / Órdenes de trabajo / {workOrder.code}</p>
          <h1>Detalle de orden de trabajo</h1>
          <p>Revisa ejecución, supervisión y validación administrativa.</p>
        </div>

        <Link className="button button-secondary" to="/ordenes-trabajo">
          <ArrowLeft size={18} />
          Volver
        </Link>
      </div>

      <div className="detail-header data-panel">
        <div>
          <span className="detail-code">{workOrder.code}</span>
          <h2>{request?.description ?? "Orden de trabajo"}</h2>
          <p>
            Solicitud de origen:{" "}
            <Link className="detail-link" to={`/incidencias/${workOrder.requestId}`}>
              {workOrder.requestCode}
            </Link>
          </p>
        </div>
        <span className={`status ${statusClass[workOrder.status]}`}>
          {workOrderStatusLabels[workOrder.status]}
        </span>
      </div>


      {(workOrder.correctionOfId || workOrder.correctionWorkOrderId) && (
        <article className="data-panel linked-work-order-card">
          <Briefcase size={22} />
          <div>
            {workOrder.correctionOfId ? (
              <>
                <strong>Esta OT corrige a:</strong>
                <Link className="detail-link" to={`/ordenes-trabajo/${workOrder.correctionOfId}`}>
                  {workOrder.correctionOfCode}
                </Link>
              </>
            ) : (
              <>
                <strong>Tiene corrección vinculada:</strong>
                <Link className="detail-link" to={`/ordenes-trabajo/${workOrder.correctionWorkOrderId}`}>
                  {workOrder.correctionWorkOrderCode}
                </Link>
              </>
            )}
          </div>
        </article>
      )}
      <div className="work-order-progress data-panel">
        <div className="work-order-progress-heading">
          <div>
            <span>Avance de la orden</span>
            <strong>{workOrder.progressPercentage} %</strong>
          </div>
          <small>Ultima actualizacion: {formatDateTime(workOrder.updatedAt)}</small>
        </div>
        <div className="progress-track" aria-label={`Avance ${workOrder.progressPercentage} por ciento`}>
          <div
            className="progress-value"
            style={{ width: `${Math.min(Math.max(workOrder.progressPercentage, 0), 100)}%` }}
          />
        </div>
      </div>

      <article className="data-panel detail-card work-order-validation-card">
        <div className="detail-card-heading">
          <ShieldCheck size={22} />
          <h2>Validación del trabajo</h2>
        </div>

        <div className="validation-flow-grid">
          <div>
            <span>1. Operario</span>
            <strong>{workOrder.progressPercentage === 100 ? "Trabajo terminado" : "En ejecución"}</strong>
            <small>{formatWorkDuration(workOrder.startedAt, workOrder.finishedAt)}</small>
          </div>
          <div>
            <span>2. Supervisor</span>
            <strong>{getValidationLabel(workOrder.supervisor_validation)}</strong>
            <small>{supervisorComment}</small>
          </div>
          <div>
            <span>3. Administrador</span>
            <strong>{needsAdminReview ? "Pendiente de decision" : getValidationLabel(workOrder.administrator_validation)}</strong>
            <small>{needsAdminReview ? "Debe aprobar o devolver la ejecución" : adminRegisteredComment}</small>
          </div>
          <div>
            <span>4. Solicitante · opcional</span>
            <strong>{workOrder.satisfaction ? "Evaluación registrada" : "Sin evaluación"}</strong>
            <small>{getRatingLabel(workOrder.satisfaction)} - {requesterComment}</small>
          </div>
        </div>

        {returnInfo && (
          <div className="return-observation-card">
            <strong>{returnInfo.title}</strong>
            <p>{returnInfo.comment}</p>
            <small>{returnInfo.nextStep}</small>
          </div>
        )}

        {isAdmin && returnInfo && correctionSchedule && (
          <div className="correction-scheduled-card">
            <div>
              <CheckCircle size={22} />
              <div>
                <strong>Corrección programada</strong>
                <p>Se creó una nueva OT para que el operario atienda la corrección.</p>
              </div>
            </div>
            <dl>
              <div><dt>Fecha</dt><dd>{formatDate(correctionSchedule.scheduledDate)}</dd></div>
              <div><dt>Hora</dt><dd>{correctionSchedule.scheduledStartTime}</dd></div>
              <div><dt>Duración estimada</dt><dd>{correctionSchedule.plannedHours} h</dd></div>
              <div><dt>Indicaciones</dt><dd>{correctionSchedule.administratorNotes}</dd></div>
              {workOrder.correctionWorkOrderId && (
                <div><dt>OT de corrección</dt><dd><Link className="detail-link" to={`/ordenes-trabajo/${workOrder.correctionWorkOrderId}`}>{workOrder.correctionWorkOrderCode}</Link></dd></div>
              )}
            </dl>
          </div>
        )}

        {canScheduleCorrection && (
          <form className="correction-schedule-form" onSubmit={handleScheduleCorrection}>
            <div>
              <strong>Programar corrección</strong>
              <p>Define cuándo debe retomar el trabajo el operario.</p>
            </div>
            <div className="form-grid">
              <label className="field">
                <span>Fecha de corrección</span>
                <input
                  type="date"
                  min={todayKey()}
                  value={correctionDate}
                  onChange={(event) => setCorrectionDate(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Hora de inicio</span>
                <input
                  type="time"
                  value={correctionTime}
                  onChange={(event) => setCorrectionTime(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Horas estimadas</span>
                <input
                  type="number"
                  min={1}
                  max={16}
                  value={correctionHours}
                  onChange={(event) => setCorrectionHours(Number(event.target.value))}
                />
              </label>
              <label className="field field-wide">
                <span>Indicaciones para el operario</span>
                <textarea
                  rows={3}
                  value={correctionNotes}
                  onChange={(event) => setCorrectionNotes(event.target.value)}
                  placeholder="Ej. Revisar evidencia faltante y corregir el acabado indicado."
                />
              </label>
            </div>
            {correctionError && <div className="form-error">{correctionError}</div>}
            {correctionSuccess && <div className="form-success">{correctionSuccess}</div>}
            <div className="admin-evaluation-actions">
              <button className="button button-primary" type="button" disabled={savingCorrection} onClick={() => void handleScheduleCorrection()}>
                <CalendarBlank size={18} />
                Guardar programación
              </button>
            </div>
          </form>
        )}

        {isAdmin && needsAdminReview && (
          <form className="admin-review-form" onSubmit={(event) => { event.preventDefault(); void handleAdminReview(true); }}>
            <label className="field field-wide">
              <span>Comentario administrativo</span>
              <textarea
                rows={4}
                value={adminComment}
                onChange={(event) => setAdminComment(event.target.value)}
                placeholder="Observaciones finales, conformidad o motivo de devolución."
              />
            </label>

            {adminError && <div className="form-error">{adminError}</div>}

            <div className="admin-evaluation-actions">
              <button
                className="button button-danger"
                type="button"
                disabled={savingAdminReview}
                onClick={() => void handleAdminReview(false)}
              >
                <XCircle size={18} />
                Devolver a corrección
              </button>
              <button className="button button-primary" disabled={savingAdminReview}>
                <CheckCircle size={18} />
                Aprobar ejecución
              </button>
            </div>
          </form>
        )}
      </article>

      <div className="detail-grid work-order-detail-grid">
        <article className="data-panel detail-card">
          <div className="detail-card-heading">
            <Briefcase size={22} />
            <h2>Datos de la orden</h2>
          </div>
          <dl className="detail-list">
            <div><dt>Especialidad</dt><dd>{specialtyLabels[workOrder.specialty]}</dd></div>
            <div><dt>Prioridad administrativa</dt><dd>{adminPriorityLabels[workOrder.adminPriority]}</dd></div>
            <div><dt>Estado actual</dt><dd>{workOrderStatusLabels[workOrder.status]}</dd></div>
            <div><dt>Solicitud de origen</dt><dd>{workOrder.requestCode}</dd></div>
            {getWorkOrderAssetDisplayCode(workOrder) && (
              <div><dt>Bien asociado</dt><dd>{workOrder.assetId ? <Link className="detail-link" to={`/bienes/${workOrder.assetId}`}>{getWorkOrderAssetDisplayCode(workOrder)}</Link> : getWorkOrderAssetDisplayCode(workOrder)}</dd></div>
            )}
          </dl>
        </article>

        <article className="data-panel detail-card">
          <div className="detail-card-heading">
            <User size={22} />
            <h2>Responsables</h2>
          </div>
          <dl className="detail-list">
            <div><dt>Operario asignado</dt><dd>{workOrder.operatorName}</dd></div>
            <div><dt>Supervisor asignado</dt><dd>{workOrder.supervisorName}</dd></div>
          </dl>
        </article>

        <article className="data-panel detail-card">
          <div className="detail-card-heading">
            <CalendarBlank size={22} />
            <h2>Programación</h2>
          </div>
          <dl className="detail-list">
            <div><dt>Fecha programada</dt><dd>{formatDate(workOrder.scheduledDate)}</dd></div>
            <div><dt>Fecha de inicio</dt><dd>{formatDateTime(workOrder.startedAt)}</dd></div>
            <div><dt>Fecha de finalización</dt><dd>{formatDateTime(workOrder.finishedAt)}</dd></div>
            <div><dt>Fecha de cierre</dt><dd>{formatDateTime(workOrder.closedAt)}</dd></div>
          </dl>
        </article>

        <article className="data-panel detail-card work-order-duration-card">
          <div className="detail-card-heading">
            <ClockCounterClockwise size={22} />
            <h2>Tiempo de ejecución</h2>
          </div>
          <dl className="detail-list">
            <div><dt>Inicio del operario</dt><dd>{formatDateTime(workOrder.startedAt)}</dd></div>
            <div><dt>Fin del operario</dt><dd>{formatDateTime(workOrder.finishedAt)}</dd></div>
            <div><dt>Tiempo efectivo trabajado</dt><dd>{formatMinutesDuration(workOrder.effectiveWorkMinutes)}</dd></div>
            <div><dt>Tiempo calendario</dt><dd>{formatWorkDuration(workOrder.startedAt, workOrder.finishedAt)}</dd></div>
          </dl>
        </article>

        <article className="data-panel detail-card">
          <div className="detail-card-heading">
            <MapPin size={22} />
            <h2>Ubicación del trabajo</h2>
          </div>
          {request ? (
            <dl className="detail-list">
              <div><dt>Zona</dt><dd>{request.zone}</dd></div>
              <div><dt>Edificio</dt><dd>{request.building}</dd></div>
              <div><dt>Área</dt><dd>{request.area}</dd></div>
              <div><dt>Ambiente</dt><dd>{request.room}</dd></div>
            </dl>
          ) : (
            <p className="detail-empty">No se encontro la solicitud relacionada.</p>
          )}
        </article>
      </div>

      <article className="data-panel detail-card work-order-notes">
        <div className="detail-card-heading">
          <ClipboardText size={22} />
          <h2>Indicaciones del administrador</h2>
        </div>
        <p>{workOrder.administratorNotes || "No se registraron indicaciones adicionales."}</p>
      </article>

      <article className="data-panel detail-card work-order-actions-card">
        <div className="detail-card-heading">
          <Wrench size={22} />
          <h2>Ejecución de la orden</h2>
        </div>
        <p className="detail-empty">
          Los avances, materiales, herramientas y evidencias del operario aparecerán en está seccion.
        </p>

        {canRegisterProgress && (
          <div className="work-order-detail-actions">
            <Link className="button button-primary" to={`/ordenes-trabajo/${workOrder.id}/ejecutar`}>
              Registrar avance
            </Link>
            <Link className="button button-secondary" to={`/ordenes-trabajo/${workOrder.id}/diagnostico`}>
              <Stethoscope size={18} />
              Diagnóstico técnico
            </Link>
          </div>
        )}
      </article>
    </section>
  );
}
