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
  updateServiceOrderStatus,
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
  const [serviceComment, setServiceComment] = useState("");
  const [serviceError, setServiceError] = useState("");
  const [savingServiceStatus, setSavingServiceStatus] = useState(false);

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

  async function handleServiceStatus(action: "SERVICE_START" | "SERVICE_CLOSE" | "SERVICE_CANCEL") {
    if (!workOrder) return;
    if (action === "SERVICE_CANCEL" && serviceComment.trim().length < 8) {
      setServiceError("Escribe un motivo breve antes de cancelar la OS.");
      return;
    }

    setSavingServiceStatus(true);
    setServiceError("");
    try {
      const updated = await updateServiceOrderStatus(workOrder.id, action, serviceComment.trim());
      setWorkOrder(updated);
      setServiceComment("");
    } catch {
      setServiceError("No se pudo actualizar el estado de la OS.");
    } finally {
      setSavingServiceStatus(false);
    }
  }

  if (!workOrder) {
  return (
      <section>
        <div className="page-heading">
          <div>
            <p className="breadcrumb">Mantenimiento / Ordenes operativas / Detalle</p>
            <h1>Orden no encontrada</h1>
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

  const isServiceOrder = workOrder.orderType === "OS" || workOrder.code.startsWith("OS-");
  const isCleaningOrder = workOrder.orderType === "OL" || workOrder.code.startsWith("OL-");
  const orderCopy = {
    singular: isServiceOrder ? "orden de servicio" : isCleaningOrder ? "orden de limpieza" : "orden de trabajo",
    singularTitle: isServiceOrder ? "Orden de servicio" : isCleaningOrder ? "Orden de limpieza" : "Orden de trabajo",
    detailTitle: isServiceOrder ? "Detalle de orden de servicio" : isCleaningOrder ? "Detalle de orden de limpieza" : "Detalle de orden de trabajo",
    detailDescription: isServiceOrder ? "Gestiona proveedor, documento, monto y cierre administrativo." : isCleaningOrder ? "Revisa limpieza, supervisión y validación administrativa." : "Revisa ejecución, supervisión y validación administrativa.",
    defaultDescription: isServiceOrder ? "Orden de servicio" : isCleaningOrder ? "Orden de limpieza" : "Orden de trabajo",
    linkedPrefix: isCleaningOrder ? "Esta OL corrige a:" : "Esta OT corrige a:",
    linkedCorrectionLabel: isCleaningOrder ? "OL de corrección" : "OT de corrección",
    progressLabel: isCleaningOrder ? "Avance de la limpieza" : "Avance de la orden",
    validationTitle: isCleaningOrder ? "Validación de la limpieza" : "Validación del trabajo",
    operatorStep: isCleaningOrder ? "1. Responsable" : "1. Operario",
    doneLabel: isCleaningOrder ? "Limpieza terminada" : "Trabajo terminado",
    runningLabel: isCleaningOrder ? "En limpieza" : "En ejecución",
    adminPendingHelp: isCleaningOrder ? "Debe aprobar o devolver la limpieza" : "Debe aprobar o devolver la ejecución",
    correctionCreated: isCleaningOrder ? "Se creó una nueva OL para que el responsable atienda la corrección." : "Se creó una nueva OT para que el operario atienda la corrección.",
    correctionHelp: isCleaningOrder ? "Define cuándo debe retomar la limpieza el responsable." : "Define cuándo debe retomar el trabajo el operario.",
    correctionNotesLabel: isCleaningOrder ? "Indicaciones para limpieza" : "Indicaciones para el operario",
    correctionPlaceholder: isCleaningOrder ? "Ej. Repetir limpieza del ambiente y adjuntar foto final." : "Ej. Revisar evidencia faltante y corregir el acabado indicado.",
    adminCommentPlaceholder: isCleaningOrder ? "Observaciones finales, conformidad o motivo de devolución de la limpieza." : "Observaciones finales, conformidad o motivo de devolución.",
    dataTitle: isCleaningOrder ? "Datos de la OL" : "Datos de la orden",
    operatorLabel: isCleaningOrder ? "Responsable de limpieza" : "Operario asignado",
    scheduleTitle: isCleaningOrder ? "Programación de limpieza" : "Programación",
    durationTitle: isCleaningOrder ? "Tiempo de limpieza" : "Tiempo de ejecución",
    startLabel: isCleaningOrder ? "Inicio del responsable" : "Inicio del operario",
    endLabel: isCleaningOrder ? "Fin del responsable" : "Fin del operario",
    effectiveTimeLabel: isCleaningOrder ? "Tiempo efectivo de limpieza" : "Tiempo efectivo trabajado",
    locationTitle: isCleaningOrder ? "Ubicación de limpieza" : "Ubicación del trabajo",
    executionTitle: isCleaningOrder ? "Ejecución de la limpieza" : "Ejecución de la orden",
    executionEmpty: isCleaningOrder ? "Los avances y evidencias del responsable aparecerán en esta sección." : "Los avances, materiales, herramientas y evidencias del operario aparecerán en esta sección.",
    progressButton: isCleaningOrder ? "Registrar avance de limpieza" : "Registrar avance",
    diagnosisButton: isCleaningOrder ? "Observación inicial" : "Diagnóstico técnico",
  };
  const isAdmin = user?.role === "ADMINISTRADOR";
  const needsAdminReview = workOrder.status === "PENDIENTE_DE_VALIDACION";
  const isAssignedTechnician = user?.id === workOrder.operatorId;
  const canRegisterProgress = isAssignedTechnician && ![
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
          <p className="breadcrumb">Mantenimiento / Ordenes operativas / {workOrder.code}</p>
          <h1>{orderCopy.detailTitle}</h1>
          <p>{orderCopy.detailDescription}</p>
        </div>

        <Link className="button button-secondary" to="/ordenes-trabajo">
          <ArrowLeft size={18} />
          Volver
        </Link>
      </div>

      <div className="detail-header data-panel">
        <div>
          <span className="detail-code">{workOrder.code}</span>
          <h2>{request?.description ?? orderCopy.defaultDescription}</h2>
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

      {isServiceOrder && (
        <article className="data-panel detail-card service-order-admin-card">
          <div className="detail-card-heading">
            <Briefcase size={22} />
            <h2>Gestión administrativa de OS</h2>
          </div>
          <p className="detail-empty">
            Esta orden corresponde a un servicio externo. No se envía a agenda técnica ni requiere supervisor.
          </p>
          <dl className="detail-list">
            <div><dt>Fecha del servicio</dt><dd>{formatDate(workOrder.scheduledDate)}</dd></div>
            <div><dt>Estado actual</dt><dd>{workOrderStatusLabels[workOrder.status]}</dd></div>
            <div><dt>Registro administrativo</dt><dd>{workOrder.administratorNotes || "Sin datos administrativos."}</dd></div>
            <div><dt>Última actualización</dt><dd>{formatDateTime(workOrder.updatedAt)}</dd></div>
          </dl>

          {isAdmin && !["CERRADA", "CANCELADA"].includes(workOrder.status) && (
            <form className="admin-review-form" onSubmit={(event) => event.preventDefault()}>
              <label className="field field-wide">
                <span>Comentario administrativo</span>
                <textarea
                  rows={3}
                  value={serviceComment}
                  onChange={(event) => setServiceComment(event.target.value)}
                  placeholder="Ej. Servicio coordinado con proveedor, pendiente de factura o conformidad."
                />
              </label>

              {serviceError && <div className="form-error">{serviceError}</div>}

              <div className="admin-evaluation-actions">
                {workOrder.status === "PROGRAMADA" && (
                  <button
                    className="button button-secondary"
                    type="button"
                    disabled={savingServiceStatus}
                    onClick={() => void handleServiceStatus("SERVICE_START")}
                  >
                    Pasar a coordinación
                  </button>
                )}
                <button
                  className="button button-danger"
                  type="button"
                  disabled={savingServiceStatus}
                  onClick={() => void handleServiceStatus("SERVICE_CANCEL")}
                >
                  Cancelar OS
                </button>
                <button
                  className="button button-primary"
                  type="button"
                  disabled={savingServiceStatus}
                  onClick={() => void handleServiceStatus("SERVICE_CLOSE")}
                >
                  Cerrar OS
                </button>
              </div>
            </form>
          )}
        </article>
      )}


      {(workOrder.correctionOfId || workOrder.correctionWorkOrderId) && (
        <article className="data-panel linked-work-order-card">
          <Briefcase size={22} />
          <div>
            {workOrder.correctionOfId ? (
              <>
                <strong>{orderCopy.linkedPrefix}</strong>
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
      {!isServiceOrder && <div className="work-order-progress data-panel">
        <div className="work-order-progress-heading">
          <div>
            <span>{orderCopy.progressLabel}</span>
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
      </div>}

      {!isServiceOrder && <article className="data-panel detail-card work-order-validation-card">
        <div className="detail-card-heading">
          <ShieldCheck size={22} />
          <h2>{orderCopy.validationTitle}</h2>
        </div>

        <div className="validation-flow-grid">
          <div>
            <span>{orderCopy.operatorStep}</span>
            <strong>{workOrder.progressPercentage === 100 ? orderCopy.doneLabel : orderCopy.runningLabel}</strong>
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
            <small>{needsAdminReview ? orderCopy.adminPendingHelp : adminRegisteredComment}</small>
          </div>
          <div>
            <span>4. Solicitante - opcional</span>
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
                <p>{orderCopy.correctionCreated}</p>
              </div>
            </div>
            <dl>
              <div><dt>Fecha</dt><dd>{formatDate(correctionSchedule.scheduledDate)}</dd></div>
              <div><dt>Hora</dt><dd>{correctionSchedule.scheduledStartTime}</dd></div>
              <div><dt>Duración estimada</dt><dd>{correctionSchedule.plannedHours} h</dd></div>
              <div><dt>Indicaciones</dt><dd>{correctionSchedule.administratorNotes}</dd></div>
              {workOrder.correctionWorkOrderId && (
                <div><dt>{orderCopy.linkedCorrectionLabel}</dt><dd><Link className="detail-link" to={`/ordenes-trabajo/${workOrder.correctionWorkOrderId}`}>{workOrder.correctionWorkOrderCode}</Link></dd></div>
              )}
            </dl>
          </div>
        )}

        {canScheduleCorrection && (
          <form className="correction-schedule-form" onSubmit={handleScheduleCorrection}>
            <div>
              <strong>Programar corrección</strong>
              <p>{orderCopy.correctionHelp}</p>
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
                <span>{orderCopy.correctionNotesLabel}</span>
                <textarea
                  rows={3}
                  value={correctionNotes}
                  onChange={(event) => setCorrectionNotes(event.target.value)}
                  placeholder={orderCopy.correctionPlaceholder}
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
                placeholder={orderCopy.adminCommentPlaceholder}
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
      </article>}

      <div className="detail-grid work-order-detail-grid">
        <article className="data-panel detail-card">
          <div className="detail-card-heading">
            <Briefcase size={22} />
            <h2>{orderCopy.dataTitle}</h2>
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

        {!isServiceOrder && <article className="data-panel detail-card">
          <div className="detail-card-heading">
            <User size={22} />
            <h2>Responsables</h2>
          </div>
          <dl className="detail-list">
            <div><dt>{orderCopy.operatorLabel}</dt><dd>{workOrder.operatorName}</dd></div>
            <div><dt>Supervisor asignado</dt><dd>{workOrder.supervisorName}</dd></div>
          </dl>
        </article>}

        <article className="data-panel detail-card">
          <div className="detail-card-heading">
            <CalendarBlank size={22} />
            <h2>{orderCopy.scheduleTitle}</h2>
          </div>
          <dl className="detail-list">
            <div><dt>Fecha programada</dt><dd>{formatDate(workOrder.scheduledDate)}</dd></div>
            <div><dt>Fecha de inicio</dt><dd>{formatDateTime(workOrder.startedAt)}</dd></div>
            <div><dt>Fecha de finalización</dt><dd>{formatDateTime(workOrder.finishedAt)}</dd></div>
            <div><dt>Fecha de cierre</dt><dd>{formatDateTime(workOrder.closedAt)}</dd></div>
          </dl>
        </article>

        {!isServiceOrder && <article className="data-panel detail-card work-order-duration-card">
          <div className="detail-card-heading">
            <ClockCounterClockwise size={22} />
            <h2>{orderCopy.durationTitle}</h2>
          </div>
          <dl className="detail-list">
            <div><dt>{orderCopy.startLabel}</dt><dd>{formatDateTime(workOrder.startedAt)}</dd></div>
            <div><dt>{orderCopy.endLabel}</dt><dd>{formatDateTime(workOrder.finishedAt)}</dd></div>
            <div><dt>{orderCopy.effectiveTimeLabel}</dt><dd>{formatMinutesDuration(workOrder.effectiveWorkMinutes)}</dd></div>
            <div><dt>Tiempo calendario</dt><dd>{formatWorkDuration(workOrder.startedAt, workOrder.finishedAt)}</dd></div>
          </dl>
        </article>}

        <article className="data-panel detail-card">
          <div className="detail-card-heading">
            <MapPin size={22} />
            <h2>{orderCopy.locationTitle}</h2>
          </div>
          {request ? (
            <dl className="detail-list">
              <div><dt>Zona</dt><dd>{request.zone}</dd></div>
              <div><dt>Edificio</dt><dd>{request.building}</dd></div>
              <div><dt>Area</dt><dd>{request.area}</dd></div>
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

      {!isServiceOrder && <article className="data-panel detail-card work-order-actions-card">
        <div className="detail-card-heading">
          <Wrench size={22} />
          <h2>{orderCopy.executionTitle}</h2>
        </div>
        <p className="detail-empty">
          {orderCopy.executionEmpty}
        </p>

        {canRegisterProgress && (
          <div className="work-order-detail-actions">
            <Link className="button button-primary" to={`/ordenes-trabajo/${workOrder.id}/ejecutar`}>
              {orderCopy.progressButton}
            </Link>
            <Link className="button button-secondary" to={`/ordenes-trabajo/${workOrder.id}/diagnostico`}>
              <Stethoscope size={18} />
              {orderCopy.diagnosisButton}
            </Link>
          </div>
        )}
      </article>}
    </section>
  );
}
