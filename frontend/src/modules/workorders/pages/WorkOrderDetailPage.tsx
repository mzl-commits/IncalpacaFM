import {
  ArrowLeft,
  Briefcase,
  CalendarBlank,
  CheckCircle,
  ClockCounterClockwise,
  ClipboardText,
  FileText,
  MapPin,
  Pulse,
  ShareNetwork,
  ShieldCheck,
  Stethoscope,
  Tag,
  User,
  Wrench,
  XCircle,
} from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "@/services/api";

import { useAuth } from "@/modules/accounts/AuthContext";
import { getWorkRequestById } from "@/modules/incidents/incidentRepository";
import { MaterialesOTAdminSection } from "@/modules/workorders/components/MaterialesOTAdminSection";
import { OperatorAvailabilityPanel, findScheduleConflicts } from "@/modules/workorders/components/OperatorAvailabilityPanel";
import {
  adminPriorityLabels,
  getWorkOrderStatusLabel,
  getWorkOrderReturnInfo,
  specialtyLabels,
  type WorkOrderStatus,
} from "@/modules/workorders/workOrderModel";
import {
  adminReviewWorkOrder,
  getWorkOrderAssetDisplayCode,
  getWorkOrderById,
  listWorkOrders,
  scheduleWorkOrderCorrection,
  updateServiceOrderStatus,
} from "@/modules/workorders/workOrderRepository";
import type { WorkOrder } from "@/modules/workorders/types";

const statusClass: Record<WorkOrderStatus, string> = {
  PROGRAMADA: "status-neutral",
  PENDIENTE_REPROGRAMACION: "status-error",
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
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(`${value}T00:00:00`));
  } catch {
    return value;
  }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateTime(value?: string) {
  if (!value) return "No registrado";
  try {
    return new Intl.DateTimeFormat("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
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
    administratorNotes: typeof value.administratorNotes === "string" && value.administratorNotes.trim() ? value.administratorNotes : "Sin indicaciones.",
  };
}

function getValidationLabel(data: Record<string, unknown> | undefined) {
  if (!data || typeof data.approved !== "boolean") return "Pendiente";
  return data.approved ? "Aprobada" : "Devuelta";
}

function getServiceOrderDetails(notes?: string) {
  const details = {
    provider: "No registrado",
    documentCode: "No registrado",
    amount: "No registrado",
    observations: "",
  };

  (notes || "").split("\n").forEach((line) => {
    const [rawLabel, ...rawValue] = line.split(":");
    const label = rawLabel.trim().toLowerCase();
    const value = rawValue.join(":").trim();
    if (!value) return;
    if (label === "proveedor") details.provider = value;
    if (label === "orden de compra o servicio") details.documentCode = value;
    if (label === "monto") details.amount = value;
    if (label === "observaciones") details.observations = value;
  });

  return details;
}

function getStringList(data: Record<string, unknown> | undefined, key: string) {
  const value = data?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
}

function getServiceStatusCopy(workOrder: WorkOrder) {
  const serviceStatus = typeof workOrder.administrator_validation?.serviceStatus === "string"
    ? workOrder.administrator_validation.serviceStatus
    : "";
  if (workOrder.status === "CERRADA" || serviceStatus === "CERRADA") {
    return {
      title: "Servicio externo cerrado",
      description: "El proveedor terminó el servicio y administración cerró la OS.",
    };
  }
  if (workOrder.status === "CANCELADA" || serviceStatus === "CANCELADA") {
    return {
      title: "OS cancelada",
      description: "La orden quedó cancelada por decisión administrativa.",
    };
  }
  if (workOrder.status === "EN_PROCESO" || serviceStatus === "EN_COORDINACION") {
    return {
      title: "OS en coordinación",
      description: "Administración está coordinando el servicio con el proveedor.",
    };
  }
  return {
    title: "OS programada",
    description: "La orden está registrada y pendiente de coordinación.",
  };
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
  const [serviceAttachments, setServiceAttachments] = useState<string[]>([]);
  const [orders, setOrders] = useState<Awaited<ReturnType<typeof listWorkOrders>>>([]);
  const [photoUrls, setPhotoUrls] = useState<{ start: string | null; finish: string | null }>({ start: null, finish: null });

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
    void listWorkOrders().then(setOrders);
  }, [id]);

  useEffect(() => {
    let disposed = false;
    const objectUrls: string[] = [];
    async function loadPhoto(url: string | null | undefined) {
      if (!url) return null;
      try {
        const response = await api.get<Blob>(url, { responseType: "blob" });
        const objectUrl = URL.createObjectURL(response.data);
        objectUrls.push(objectUrl);
        return objectUrl;
      } catch {
        return null;
      }
    }
    if (!workOrder) {
      setPhotoUrls({ start: null, finish: null });
      return () => undefined;
    }

    void (async () => {
      const [start, finish] = await Promise.all([
        loadPhoto(workOrder.startPhoto),
        loadPhoto(workOrder.finishPhoto),
      ]);
      if (!disposed) {
        setPhotoUrls({ start, finish });
      }
    })();

    return () => {
      disposed = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [workOrder?.id, workOrder?.startPhoto, workOrder?.finishPhoto]);

  async function handleAdminReview(approved: boolean) {
    if (!workOrder) return;
    if (!approved && adminComment.trim().length < 8) {
      setAdminError("Escribe una observación o motivo de devolución breve.");
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
    const conflicts = findScheduleConflicts({
      orders,
      operatorId: workOrder.operatorId,
      dates: [correctionDate],
      startTime: correctionTime,
      plannedHours: correctionHours,
      currentOrderId: workOrder.id,
    });
    if (conflicts.length) {
      setCorrectionError(`El operario ya tiene una orden en ese horario: ${conflicts.map((order) => order.code).join(", ")}.`);
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
      const previousAttachments = getStringList(workOrder.administrator_validation, "attachments");
      const nextAttachments = Array.from(new Set([...previousAttachments, ...serviceAttachments]));
      const updated = await updateServiceOrderStatus(workOrder.id, action, serviceComment.trim(), nextAttachments);
      setWorkOrder(updated);
      setServiceComment("");
      setServiceAttachments([]);
    } catch {
      setServiceError("No se pudo actualizar el estado de la OS.");
    } finally {
      setSavingServiceStatus(false);
    }
  }

  if (!workOrder) {
    return (
      <section className="wo-detail-wrapper">
        <div className="page-heading wo-detail-page-heading">
          <div>
            <p className="breadcrumb">Mantenimiento / Ordenes operativas / Detalle</p>
            <h1 className="wo-page-title">Orden no encontrada</h1>
            <p className="wo-subtitle wo-section-description">La orden indicada no existe o ya no está disponible.</p>
          </div>
          <Link className="button button-secondary wo-back-btn" to="/ordenes-trabajo">
            <ArrowLeft size={16} weight="bold" />
            Volver
          </Link>
        </div>
      </section>
    );
  }

  const isServiceOrder = workOrder.orderType === "OS" || workOrder.code.startsWith("OS-");
  const isCleaningOrder = workOrder.orderType === "OL" || workOrder.code.startsWith("OL-");
  const orderCopy = {
    typeCode: isServiceOrder ? "OS" : isCleaningOrder ? "OL" : "OT",
    typeName: isServiceOrder ? "Servicio externo" : isCleaningOrder ? "Limpieza" : "Mantenimiento",
    singular: isServiceOrder ? "orden de servicio" : isCleaningOrder ? "orden de limpieza" : "orden de trabajo",
    detailTitle: isServiceOrder ? "Detalle de orden de servicio" : isCleaningOrder ? "Detalle de orden de limpieza" : "Detalle de orden de trabajo",
    defaultDescription: isServiceOrder ? "Orden de servicio" : isCleaningOrder ? "Orden de limpieza" : "Orden de trabajo",
    linkedPrefix: isCleaningOrder ? "Esta OL corrige a:" : "Esta OT corrige a:",
    linkedCorrectionLabel: isCleaningOrder ? "OL de corrección" : "OT de corrección",
    progressLabel: isCleaningOrder ? "Avance de la limpieza" : "Avance de la orden",
    validationTitle: isCleaningOrder ? "Validación de la limpieza" : "Validación del trabajo",
    operatorStep: isCleaningOrder ? "1. Responsable" : "1. Operario",
    doneLabel: isCleaningOrder ? "Limpieza terminada" : "Trabajo terminado",
    runningLabel: isCleaningOrder ? "En limpieza" : "En ejecución",
    adminPendingHelp: isCleaningOrder ? "Aprobar o devolver limpieza" : "Aprobar o devolver ejecución",
    correctionCreated: isCleaningOrder ? "Se creó una nueva OL para corrección." : "Se creó una nueva OT para corrección.",
    correctionHelp: isCleaningOrder ? "Define la reprogramación para la limpieza." : "Define la reprogramación para el operario.",
    correctionNotesLabel: isCleaningOrder ? "Indicaciones para limpieza" : "Indicaciones para el operario",
    correctionPlaceholder: isCleaningOrder ? "Ej. Repetir limpieza del ambiente." : "Ej. Corregir evidencia faltante.",
    adminCommentPlaceholder: isCleaningOrder ? "Observaciones finales de la limpieza." : "Observaciones finales o motivo de devolución.",
    dataTitle: "Datos de la orden",
    operatorLabel: isCleaningOrder ? "Responsable" : "Operario asignado",
    scheduleTitle: "Programación",
    durationTitle: "Tiempos",
    startLabel: "Inicio",
    endLabel: "Finalización",
    effectiveTimeLabel: "Tiempo efectivo",
    locationTitle: "Ubicación",
    executionEmpty: isCleaningOrder ? "Los avances de limpieza aparecerán en esta sección." : "Los avances, materiales y evidencias del operario aparecerán en esta sección.",
    diagnosisButton: isCleaningOrder ? "Observación inicial" : "Diagnóstico técnico",
  };

  const isAdmin = user?.role === "ADMINISTRADOR";
  const needsAdminReview = workOrder.status === "PENDIENTE_DE_VALIDACION";
  const isAssignedTechnician = user?.id === workOrder.operatorId;
  const canRegisterProgress = isAssignedTechnician && !isServiceOrder && !workOrder.correctionWorkOrderId && ![
    "CERRADA",
    "CANCELADA",
    "PENDIENTE_DE_SUPERVISION",
    "PENDIENTE_DE_VALIDACION",
    "PENDIENTE_DE_CONFORMIDAD",
  ].includes(workOrder.status);

  const supervisorComment = getTextValue(workOrder.supervisor_validation, "comment", "Sin comentarios del supervisor");
  const adminRegisteredComment = getTextValue(workOrder.administrator_validation, "comment", "Sin comentarios administrativos");
  const returnInfo = getWorkOrderReturnInfo(workOrder);
  const correctionSchedule = getCorrectionSchedule(workOrder);
  const hasLinkedCorrection = Boolean(workOrder.correctionWorkOrderId);
  const canScheduleCorrection = isAdmin && Boolean(returnInfo) && !correctionSchedule && !hasLinkedCorrection;
  const serviceDetails = getServiceOrderDetails(workOrder.administratorNotes);
  const serviceStatusCopy = getServiceStatusCopy(workOrder);
  const savedServiceAttachments = getStringList(workOrder.administrator_validation, "attachments");
  const serviceCommentSaved = getTextValue(workOrder.administrator_validation, "comment", "Sin comentario administrativo.");

  return (
    <section className="wo-detail-wrapper">
      {/* 1. CABECERA Y BOTÓN VOLVER COMPACTOS */}
      <div className="page-heading wo-detail-page-heading">
        <div>
          <p className="breadcrumb">Mantenimiento / Ordenes operativas / {workOrder.code}</p>
          <h1 className="wo-page-title">{orderCopy.detailTitle}</h1>
          <p className="wo-subtitle wo-section-description">Detalle y seguimiento operativo.</p>
        </div>

        <Link className="button button-secondary wo-back-btn" to="/ordenes-trabajo">
          <ArrowLeft size={16} weight="bold" />
          Volver
        </Link>
      </div>

      {/* 2. HERO CARRIER TARJETA COMPACTA */}
      <div className={`wo-detail-hero-card is-${orderCopy.typeCode.toLowerCase()}`}>
        <div className="wo-hero-left">
          <div className="wo-hero-icon-box">
            {isServiceOrder ? <ShareNetwork size={22} weight="bold" /> : isCleaningOrder ? <Pulse size={22} weight="bold" /> : <Wrench size={22} weight="bold" />}
          </div>
          <div className="wo-hero-info">
            <div className="wo-hero-badges">
              <span className="wo-badge-code">{workOrder.code}</span>
              <span className="wo-badge-type">{orderCopy.typeCode} · {orderCopy.typeName}</span>
              <span className="wo-badge-priority">{adminPriorityLabels[workOrder.adminPriority] || workOrder.adminPriority}</span>
              {workOrder.requestCode && (
                <Link className="wo-badge-origin" to={`/incidencias/${workOrder.requestId}`}>
                  <Tag size={12} weight="bold" /> Origen: {workOrder.requestCode}
                </Link>
              )}
            </div>
            <h2 className="wo-hero-title">{request?.description ?? orderCopy.defaultDescription}</h2>
          </div>
        </div>
        <div className="wo-hero-right">
          <span className={`status ${statusClass[workOrder.status]}`}>
            {getWorkOrderStatusLabel(workOrder)}
          </span>
        </div>
      </div>

      {/* 3. SERVICIO EXTERNO (SI ES OS) */}
      {isServiceOrder && (
        <article className="data-panel detail-card service-order-admin-card wo-compact-card">
          <div className="service-order-admin-heading compact-heading">
            <ShareNetwork size={22} weight="bold" />
            <div>
              <h2 className="wo-section-title">Gestión administrativa de OS</h2>
            </div>
            <span className={`status ${statusClass[workOrder.status]}`}>
              {getWorkOrderStatusLabel(workOrder)}
            </span>
          </div>

          <dl className="service-order-summary wo-compact-dl">
            <div><dt className="wo-field-label">Proveedor</dt><dd className="wo-field-value">{serviceDetails.provider}</dd></div>
            <div><dt className="wo-field-label">Orden de compra/servicio</dt><dd className="wo-field-value">{serviceDetails.documentCode}</dd></div>
            <div><dt className="wo-field-label">Monto</dt><dd className="wo-field-value">{serviceDetails.amount}</dd></div>
            <div><dt className="wo-field-label">Fecha del servicio</dt><dd className="wo-field-value">{formatDate(workOrder.scheduledDate)}</dd></div>
          </dl>

          <div className="service-order-status-panel wo-compact-status-panel">
            <div>
              <strong className="wo-field-value">{serviceStatusCopy.title}</strong>
              <p className="wo-section-description">{serviceStatusCopy.description}</p>
            </div>
            <dl>
              <div><dt className="wo-field-label">Comentario</dt><dd className="wo-field-value">{serviceCommentSaved}</dd></div>
              <div>
                <dt className="wo-field-label">Adjuntos</dt>
                <dd className="wo-field-value">
                  {savedServiceAttachments.length ? (
                    <span className="service-attachment-list">
                      {savedServiceAttachments.map((name) => (
                        <span key={name}><FileText size={14} />{name}</span>
                      ))}
                    </span>
                  ) : "Sin adjuntos."}
                </dd>
              </div>
            </dl>
          </div>

          {isAdmin && !["CERRADA", "CANCELADA"].includes(workOrder.status) && (
            <form className="admin-review-form" onSubmit={(event) => event.preventDefault()}>
              <label className="field field-wide">
                <span className="wo-field-label">Comentario administrativo</span>
                <textarea
                  rows={2}
                  value={serviceComment}
                  onChange={(event) => setServiceComment(event.target.value)}
                  placeholder="Ej. Servicio coordinado con proveedor, pendiente de factura."
                />
              </label>

              <label className="field field-wide">
                <span className="wo-field-label">Adjuntos de la OS</span>
                <input
                  type="file"
                  multiple
                  onChange={(event) => {
                    setServiceAttachments(Array.from(event.target.files ?? []).map((file) => file.name));
                  }}
                />
              </label>

              {serviceAttachments.length > 0 && (
                <div className="service-attachment-preview">
                  {serviceAttachments.map((name) => (
                    <span key={name}><FileText size={14} />{name}</span>
                  ))}
                </div>
              )}

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

      {/* CORRECCIÓN VINCULADA BANNER */}
      {(workOrder.correctionOfId || workOrder.correctionWorkOrderId) && (
        <article className="data-panel linked-work-order-card wo-compact-linked">
          <Briefcase size={22} weight="bold" />
          <div>
            {workOrder.correctionOfId ? (
              <>
                <strong className="wo-field-value">{orderCopy.linkedPrefix}</strong>
                <Link className="detail-link" to={`/ordenes-trabajo/${workOrder.correctionOfId}`}>
                  {workOrder.correctionOfCode}
                </Link>
              </>
            ) : (
              <>
                <strong className="wo-field-value">Tiene corrección vinculada:</strong>
                <Link className="detail-link" to={`/ordenes-trabajo/${workOrder.correctionWorkOrderId}`}>
                  {workOrder.correctionWorkOrderCode}
                </Link>
              </>
            )}
          </div>
        </article>
      )}

      {/* BARRAS DE AVANCE (SI NO ES OS) */}
      {!isServiceOrder && (
        <div className="work-order-progress data-panel wo-compact-progress">
          <div className="work-order-progress-heading">
            <div>
              <span className="wo-field-label">{orderCopy.progressLabel}</span>
              <strong className="wo-field-value">{workOrder.progressPercentage} %</strong>
            </div>
            <small className="wo-secondary-text">Actualizado: {formatDateTime(workOrder.updatedAt)}</small>
          </div>
          <div className="progress-track" aria-label={`Avance ${workOrder.progressPercentage}%`}>
            <div
              className="progress-value"
              style={{ width: `${Math.min(Math.max(workOrder.progressPercentage, 0), 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* 4. VALIDACIÓN Y ESTADO DEL TRABAJO (EJECUCIÓN, SUPERVISIÓN, ADMINISTRACIÓN) */}
      {!isServiceOrder && (
        <article className="data-panel detail-card wo-workflow-section wo-compact-card">
          <div className="detail-card-heading compact-heading">
            <ShieldCheck size={22} weight="bold" />
            <h2 className="wo-section-title">{orderCopy.validationTitle}</h2>
          </div>

          <div className="wo-workflow-grid">
            <div className={`wo-step-card ${workOrder.progressPercentage === 100 ? "is-done" : "is-active"}`}>
              <span className="wo-step-num wo-field-label">{orderCopy.operatorStep}</span>
              <strong className="wo-step-status wo-field-value">{workOrder.progressPercentage === 100 ? orderCopy.doneLabel : orderCopy.runningLabel}</strong>
              <small className="wo-step-time wo-secondary-text">{formatWorkDuration(workOrder.startedAt, workOrder.finishedAt)}</small>
            </div>

            <div className={`wo-step-card ${workOrder.supervisor_validation?.approved ? "is-done" : workOrder.supervisor_validation ? "is-returned" : "is-pending"}`}>
              <span className="wo-step-num wo-field-label">2. Supervisión</span>
              <strong className="wo-step-status wo-field-value">{getValidationLabel(workOrder.supervisor_validation)}</strong>
              <small className="wo-step-comment wo-secondary-text">{supervisorComment}</small>
            </div>

            <div className={`wo-step-card ${needsAdminReview ? "is-active" : workOrder.administrator_validation?.approved ? "is-done" : workOrder.administrator_validation ? "is-returned" : "is-pending"}`}>
              <span className="wo-step-num wo-field-label">3. Administración</span>
              <strong className="wo-step-status wo-field-value">{needsAdminReview ? "Esperando decisión" : getValidationLabel(workOrder.administrator_validation)}</strong>
              <small className="wo-step-comment wo-secondary-text">{needsAdminReview ? orderCopy.adminPendingHelp : adminRegisteredComment}</small>
            </div>

            <div className={`wo-step-card ${workOrder.satisfaction ? "is-done" : "is-pending"}`}>
              <span className="wo-step-num wo-field-label">4. Solicitante</span>
              <strong className="wo-step-status wo-field-value">{workOrder.satisfaction ? "Evaluado" : "Sin evaluación"}</strong>
              <small className="wo-step-comment wo-secondary-text">{getRatingLabel(workOrder.satisfaction)}</small>
            </div>
          </div>

          {returnInfo && (
            <div className="return-observation-card wo-compact-return">
              <strong className="wo-field-value">{returnInfo.title}</strong>
              <p className="wo-normal-text">{returnInfo.comment}</p>
              <small className="wo-secondary-text">{returnInfo.nextStep}</small>
            </div>
          )}

          {isAdmin && returnInfo && correctionSchedule && (
            <div className="correction-scheduled-card wo-compact-card">
              <div>
                <CheckCircle size={22} weight="bold" />
                <div>
                  <strong className="wo-section-title">Corrección programada</strong>
                  <p className="wo-section-description">{orderCopy.correctionCreated}</p>
                </div>
              </div>
              <dl className="wo-compact-dl">
                <div><dt className="wo-field-label">Fecha</dt><dd className="wo-field-value">{formatDate(correctionSchedule.scheduledDate)}</dd></div>
                <div><dt className="wo-field-label">Hora</dt><dd className="wo-field-value">{correctionSchedule.scheduledStartTime}</dd></div>
                <div><dt className="wo-field-label">Duración</dt><dd className="wo-field-value">{correctionSchedule.plannedHours} h</dd></div>
                <div><dt className="wo-field-label">Indicaciones</dt><dd className="wo-field-value">{correctionSchedule.administratorNotes}</dd></div>
              </dl>
            </div>
          )}

          {canScheduleCorrection && (
            <form className="correction-schedule-form wo-compact-form" onSubmit={handleScheduleCorrection}>
              <div>
                <strong className="wo-section-title">Programar corrección</strong>
                <p className="wo-section-description">{orderCopy.correctionHelp}</p>
              </div>
              <div className="form-grid">
                <label className="field">
                  <span className="wo-field-label">Fecha</span>
                  <input
                    type="date"
                    min={todayKey()}
                    value={correctionDate}
                    onChange={(event) => setCorrectionDate(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span className="wo-field-label">Hora</span>
                  <input
                    type="time"
                    value={correctionTime}
                    onChange={(event) => setCorrectionTime(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span className="wo-field-label">Horas est.</span>
                  <input
                    type="number"
                    min={1}
                    max={16}
                    value={correctionHours}
                    onChange={(event) => setCorrectionHours(Number(event.target.value))}
                  />
                </label>
                <label className="field field-wide">
                  <span className="wo-field-label">{orderCopy.correctionNotesLabel}</span>
                  <textarea
                    rows={2}
                    value={correctionNotes}
                    onChange={(event) => setCorrectionNotes(event.target.value)}
                    placeholder={orderCopy.correctionPlaceholder}
                  />
                </label>
                <div className="field field-wide">
                  <OperatorAvailabilityPanel
                    orders={orders}
                    operatorId={workOrder.operatorId}
                    operatorName={workOrder.operatorName}
                    selectedDate={correctionDate}
                    startTime={correctionTime}
                    plannedHours={correctionHours}
                    currentOrderId={workOrder.id}
                    title="Disponibilidad para corrección"
                  />
                </div>
              </div>
              {correctionError && <div className="form-error">{correctionError}</div>}
              {correctionSuccess && <div className="form-success">{correctionSuccess}</div>}
              <div className="admin-evaluation-actions">
                <button className="button button-primary" type="button" disabled={savingCorrection} onClick={() => void handleScheduleCorrection()}>
                  <CalendarBlank size={16} weight="bold" />
                  Guardar programación
                </button>
              </div>
            </form>
          )}

          {isAdmin && needsAdminReview && (
            <form className="admin-review-form wo-compact-form" onSubmit={(event) => { event.preventDefault(); void handleAdminReview(true); }}>
              <label className="field field-wide">
                <span className="wo-field-label">Comentario administrativo</span>
                <textarea
                  rows={2}
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
                  <XCircle size={16} weight="bold" />
                  Devolver a corrección
                </button>
                <button className="button button-primary" disabled={savingAdminReview}>
                  <CheckCircle size={16} weight="bold" />
                  Aprobar ejecución
                </button>
              </div>
            </form>
          )}
        </article>
      )}

      {/* 5. TARJETAS COMPACTAS EN GRID REDUCIDO */}
      <div className="detail-grid work-order-detail-grid wo-compact-grid">
        <article className="data-panel detail-card wo-compact-card">
          <div className="detail-card-heading compact-heading">
            <Briefcase size={22} weight="bold" />
            <h2 className="wo-section-title">{orderCopy.dataTitle}</h2>
          </div>
          <dl className="detail-list wo-compact-list">
            <div><dt className="wo-field-label">Especialidad</dt><dd className="wo-field-value">{specialtyLabels[workOrder.specialty] || workOrder.specialty}</dd></div>
            <div><dt className="wo-field-label">Prioridad</dt><dd className="wo-field-value">{adminPriorityLabels[workOrder.adminPriority] || workOrder.adminPriority}</dd></div>
            <div><dt className="wo-field-label">Estado</dt><dd className="wo-field-value">{getWorkOrderStatusLabel(workOrder)}</dd></div>
            <div><dt className="wo-field-label">Origen</dt><dd className="wo-field-value">{workOrder.requestCode}</dd></div>
            {getWorkOrderAssetDisplayCode(workOrder) && (
              <div><dt className="wo-field-label">Bien asociado</dt><dd className="wo-field-value">{workOrder.assetId ? <Link className="detail-link" to={`/bienes/${workOrder.assetId}`}>{getWorkOrderAssetDisplayCode(workOrder)}</Link> : getWorkOrderAssetDisplayCode(workOrder)}</dd></div>
            )}
          </dl>
        </article>

        {!isServiceOrder && (
          <article className="data-panel detail-card wo-compact-card">
            <div className="detail-card-heading compact-heading">
              <User size={22} weight="bold" />
              <h2 className="wo-section-title">Responsables</h2>
            </div>
            <dl className="detail-list wo-compact-list">
              <div><dt className="wo-field-label">{orderCopy.operatorLabel}</dt><dd className="wo-field-value">{workOrder.operatorName || "No asignado"}</dd></div>
              <div><dt className="wo-field-label">Supervisor</dt><dd className="wo-field-value">{workOrder.supervisorName || "No asignado"}</dd></div>
            </dl>
          </article>
        )}

        <article className="data-panel detail-card wo-compact-card">
          <div className="detail-card-heading compact-heading">
            <CalendarBlank size={22} weight="bold" />
            <h2 className="wo-section-title">{orderCopy.scheduleTitle}</h2>
          </div>
          <dl className="detail-list wo-compact-list">
            <div><dt className="wo-field-label">Programada</dt><dd className="wo-field-value">{formatDate(workOrder.scheduledDate)}</dd></div>
            <div><dt className="wo-field-label">Inicio</dt><dd className="wo-field-value">{formatDateTime(workOrder.startedAt)}</dd></div>
            <div><dt className="wo-field-label">Finalización</dt><dd className="wo-field-value">{formatDateTime(workOrder.finishedAt)}</dd></div>
            <div><dt className="wo-field-label">Cierre</dt><dd className="wo-field-value">{formatDateTime(workOrder.closedAt)}</dd></div>
          </dl>
        </article>

        {!isServiceOrder && (
          <article className="data-panel detail-card wo-compact-card">
            <div className="detail-card-heading compact-heading">
              <ClockCounterClockwise size={22} weight="bold" />
              <h2 className="wo-section-title">{orderCopy.durationTitle}</h2>
            </div>
            <dl className="detail-list wo-compact-list">
              <div><dt className="wo-field-label">Efectivo</dt><dd className="wo-field-value">{formatMinutesDuration(workOrder.effectiveWorkMinutes)}</dd></div>
              <div><dt className="wo-field-label">Calendario</dt><dd className="wo-field-value">{formatWorkDuration(workOrder.startedAt, workOrder.finishedAt)}</dd></div>
            </dl>
          </article>
        )}

        <article className="data-panel detail-card wo-compact-card">
          <div className="detail-card-heading compact-heading">
            <MapPin size={22} weight="bold" />
            <h2 className="wo-section-title">{orderCopy.locationTitle}</h2>
          </div>
          {request ? (
            <dl className="detail-list wo-compact-list">
              <div><dt className="wo-field-label">Zona</dt><dd className="wo-field-value">{request.zone}</dd></div>
              <div><dt className="wo-field-label">Edificio</dt><dd className="wo-field-value">{request.building}</dd></div>
              <div><dt className="wo-field-label">Área</dt><dd className="wo-field-value">{request.area}</dd></div>
              <div><dt className="wo-field-label">Ambiente</dt><dd className="wo-field-value">{request.room}</dd></div>
            </dl>
          ) : (
            <p className="detail-empty wo-secondary-text">Sin ubicación vinculada.</p>
          )}
        </article>
      </div>

      {/* EVIDENCIA FOTOGRÁFICA (ANTES Y DESPUÉS) */}
      {!isServiceOrder && (
        <article className="data-panel detail-card work-order-photo-evidence wo-compact-card">
          <div className="detail-card-heading compact-heading">
            <ClipboardText size={22} weight="bold" />
            <div>
              <h2 className="wo-section-title">Evidencia fotográfica</h2>
              <p className="wo-subtitle-sm wo-section-description">Comparativa visual del trabajo (Antes / Después).</p>
            </div>
          </div>
          <div className="work-order-photo-grid wo-compact-photo-grid">
            {([
              ["Antes", photoUrls.start, "Sin foto de inicio."],
              ["Después", photoUrls.finish, "Sin foto final."],
            ] as const).map(([label, url, help]) => (
              <figure className="work-order-photo-card wo-compact-photo-card" key={label}>
                <figcaption><strong className="wo-field-value">{label}</strong><span className="wo-secondary-text">{url ? "Disponible" : "Sin foto"}</span></figcaption>
                {url ? <img src={url} alt={`Estado del bien ${label.toLowerCase()}`} /> : <div className="work-order-photo-empty wo-secondary-text">{help}</div>}
              </figure>
            ))}
          </div>
        </article>
      )}

      {/* INDICACIONES DEL ADMINISTRADOR */}
      <article className="data-panel detail-card work-order-notes wo-compact-card">
        <div className="detail-card-heading compact-heading">
          <ClipboardText size={22} weight="bold" />
          <h2 className="wo-section-title">Indicaciones del administrador</h2>
        </div>
        <p className="wo-notes-text wo-normal-text">{workOrder.administratorNotes || "Sin indicaciones adicionales."}</p>
      </article>

      {/* SIGUIENTE PASO DE EJECUCIÓN */}
      {!isServiceOrder && (
        <article className="data-panel detail-card work-order-actions-card technician-next-action-card wo-compact-card">
          <div className="detail-card-heading compact-heading">
            <Wrench size={22} weight="bold" />
            <h2 className="wo-section-title">Siguiente paso</h2>
          </div>
          {isAdmin ? (
            <MaterialesOTAdminSection workOrderId={workOrder.id} emptyMessage={orderCopy.executionEmpty} />
          ) : (
            <p className="detail-empty wo-secondary-text">{orderCopy.executionEmpty}</p>
          )}

          {canRegisterProgress ? (
            <>
              <div className="technician-next-action-copy">
                <strong className="wo-field-value">
                  {workOrder.status === "EN_PROCESO"
                    ? isCleaningOrder ? "Continúa la limpieza" : "Continúa el trabajo"
                    : workOrder.progressPercentage > 0
                      ? isCleaningOrder ? "Reanuda la limpieza" : "Reanuda el trabajo"
                      : isCleaningOrder ? "Inicia la limpieza" : "Inicia el trabajo"}
                </strong>
              </div>
              <div className="work-order-detail-actions">
                <Link className="button button-primary" to={`/ordenes-trabajo/${workOrder.id}/ejecutar`}>
                  {workOrder.status === "EN_PROCESO"
                    ? isCleaningOrder ? "Continuar limpieza" : "Continuar trabajo"
                    : workOrder.progressPercentage > 0
                      ? isCleaningOrder ? "Reanudar limpieza" : "Reanudar trabajo"
                      : isCleaningOrder ? "Iniciar limpieza" : "Iniciar trabajo"}
                </Link>
                <Link className="technician-optional-link" to={`/ordenes-trabajo/${workOrder.id}/diagnostico`}>
                  <Stethoscope size={16} />
                  {orderCopy.diagnosisButton}
                </Link>
              </div>
            </>
          ) : (
            <p className="detail-empty wo-secondary-text">
              {workOrder.correctionWorkOrderId
                ? "Esta orden tiene una corrección vinculada. Abre la nueva orden para continuar."
                : "No hay acciones pendientes para el técnico."}
            </p>
          )}
        </article>
      )}
    </section>
  );
}