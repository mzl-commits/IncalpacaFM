import {
  ArrowLeft,
  Archive,
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
import { listTechnicians, type Technician } from "@/modules/accounts/technicianRepository";
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
  deleteWorkOrderPhoto,
  getWorkOrderAssetDisplayCode,
  getWorkOrderById,
  listWorkOrders,
  registerWorkOrderProgress,
  scheduleWorkOrderCorrection,
  startWorkOrder,
  updateServiceOrderStatus,
  updateWorkOrderPlanning,
  updateWorkOrderPhoto,
} from "@/modules/workorders/workOrderRepository";
import type { WorkOrder } from "@/modules/workorders/types";

type PlanningForm = {
  specialty: WorkOrder["specialty"];
  adminPriority: WorkOrder["adminPriority"];
  status: WorkOrder["status"];
  scheduledDate: string;
  scheduledStartTime: string;
  plannedHours: number;
  operatorId: string;
  supervisorId: string;
  administratorNotes: string;
};

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
  if (typeof value === "number") return `${value} / 5 ⭐`;
  if (typeof value === "string" && value.trim()) return `${value} / 5 ⭐`;
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
  const [uploadingPhoto, setUploadingPhoto] = useState<"start" | "finish" | null>(null);
  const [photoMessage, setPhotoMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [editingPlanning, setEditingPlanning] = useState(false);
  const [planningPeople, setPlanningPeople] = useState<Technician[]>([]);
  const [planningError, setPlanningError] = useState("");
  const [savingPlanning, setSavingPlanning] = useState(false);
  const [planning, setPlanning] = useState<PlanningForm>({ specialty: "ELECTRICIDAD", adminPriority: "MEDIA", status: "PROGRAMADA", scheduledDate: "", scheduledStartTime: "08:00", plannedHours: 2, operatorId: "", supervisorId: "", administratorNotes: "" });

  async function handleUploadPhoto(type: "start" | "finish", file: File) {
    if (!workOrder) return;
    setUploadingPhoto(type);
    setPhotoMessage(null);
    try {
      const stage = type === "start" ? "START" : "FINISH";
      const updated = await updateWorkOrderPhoto(workOrder.id, stage, file);
      setWorkOrder(updated);
      setPhotoMessage({
        type: "success",
        text: `✅ Foto de "${type === "start" ? "Antes" : "Después"}" subida correctamente.`,
      });
    } catch (err: any) {
      const detail =
        err?.response?.data?.detail ||
        err?.response?.data?.photo ||
        err?.response?.data?.startPhoto ||
        err?.response?.data?.finishPhoto ||
        err?.response?.data?.action ||
        "No se pudo guardar la fotografía. Intenta nuevamente.";
      setPhotoMessage({
        type: "error",
        text: `❌ ${typeof detail === "string" ? detail : JSON.stringify(detail)}`,
      });
    } finally {
      setUploadingPhoto(null);
    }
  }

  async function handleDeletePhoto(type: "start" | "finish") {
    if (!workOrder) return;
    if (!window.confirm(`¿Seguro que deseas eliminar la foto de "${type === "start" ? "Antes" : "Después"}"?`)) return;
    setUploadingPhoto(type);
    setPhotoMessage(null);
    try {
      const stage = type === "start" ? "START" : "FINISH";
      const updated = await deleteWorkOrderPhoto(workOrder.id, stage);
      setWorkOrder(updated);
      setPhotoMessage({
        type: "success",
        text: `🗑️ Foto de "${type === "start" ? "Antes" : "Después"}" eliminada correctamente.`,
      });
    } catch {
      setPhotoMessage({
        type: "error",
        text: "❌ No se pudo eliminar la fotografía.",
      });
    } finally {
      setUploadingPhoto(null);
    }
  }

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
            <h1>Orden no encontrada</h1>
            <p className="wo-subtitle">La orden indicada no existe o ya no está disponible.</p>
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
  const canEditPlanning = user?.role === "ADMINISTRADOR" || user?.role === "SUPERVISOR";
  const needsAdminReview = workOrder.status === "PENDIENTE_DE_VALIDACION";
  const isAssignedTechnician = user?.id === workOrder.operatorId;
  const canRegisterProgress = isAssignedTechnician && !isServiceOrder && !workOrder.correctionWorkOrderId && ![
    "CERRADA",
    "CANCELADA",
    "PENDIENTE_DE_SUPERVISION",
    "PENDIENTE_DE_VALIDACION",
    "PENDIENTE_DE_CONFORMIDAD",
  ].includes(workOrder.status);
  const canManagePhotos = !isServiceOrder && (canEditPlanning || canRegisterProgress);

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

  async function openPlanningEditor() {
    if (!workOrder) return;
    setPlanning({
      specialty: workOrder.specialty,
      adminPriority: workOrder.adminPriority,
      status: workOrder.status,
      scheduledDate: workOrder.scheduledDate,
      scheduledStartTime: workOrder.scheduledStartTime?.slice(0, 5) || "08:00",
      plannedHours: workOrder.plannedHours || 2,
      operatorId: workOrder.operatorId,
      supervisorId: workOrder.supervisorId,
      administratorNotes: workOrder.administratorNotes || "",
    });
    setPlanningError("");
    setEditingPlanning(true);
    if (!planningPeople.length) {
      try { setPlanningPeople((await listTechnicians()).filter((person) => person.active)); } catch { setPlanningError("No se pudo cargar el equipo para editar responsables."); }
    }
  }

  async function savePlanning(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workOrder) return;
    setSavingPlanning(true);
    setPlanningError("");
    try {
      const updated = await updateWorkOrderPlanning(workOrder.id, planning);
      setWorkOrder(updated);
      setEditingPlanning(false);
    } catch (error: any) {
      const detail = error?.response?.data?.detail ?? "No se pudieron guardar los cambios de la orden.";
      setPlanningError(typeof detail === "string" ? detail : JSON.stringify(detail));
    } finally { setSavingPlanning(false); }
  }

  return (
    <section className="wo-detail-wrapper">
      {/* 1. CABECERA Y BOTÓN VOLVER COMPACTOS */}
      <div className="page-heading wo-detail-page-heading">
        <div>
          <p className="breadcrumb">Mantenimiento / Ordenes operativas / {workOrder.code}</p>
          <h1>{orderCopy.detailTitle}</h1>
          <p className="wo-subtitle">Detalle y seguimiento operativo.</p>
        </div>

        <div className="detail-actions">
          {isAdmin && workOrder.assetId && !isCleaningOrder && (
            <Link
              className="button button-danger"
              to={`/ordenes-trabajo/${workOrder.id}/diagnostico`}
              title="Registra el diagnóstico y sustento antes de solicitar la baja"
            >
              <Archive size={18} />
              Iniciar baja
            </Link>
          )}
          <Link className="button button-secondary wo-back-btn" to="/ordenes-trabajo">
            <ArrowLeft size={16} weight="bold" />
            Volver
          </Link>
        </div>
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
          <div className="service-order-admin-heading">
            <div>
              <span>Servicio externo</span>
              <h2>Gestión administrativa de OS</h2>
            </div>
            <span className={`status ${statusClass[workOrder.status]}`}>
              {getWorkOrderStatusLabel(workOrder)}
            </span>
          </div>

          <dl className="service-order-summary wo-compact-dl">
            <div><dt>Proveedor</dt><dd>{serviceDetails.provider}</dd></div>
            <div><dt>Orden de compra/servicio</dt><dd>{serviceDetails.documentCode}</dd></div>
            <div><dt>Monto</dt><dd>{serviceDetails.amount}</dd></div>
            <div><dt>Fecha del servicio</dt><dd>{formatDate(workOrder.scheduledDate)}</dd></div>
          </dl>

          <div className="service-order-status-panel wo-compact-status-panel">
            <div>
              <strong>{serviceStatusCopy.title}</strong>
              <p>{serviceStatusCopy.description}</p>
            </div>
            <dl>
              <div><dt>Comentario</dt><dd>{serviceCommentSaved}</dd></div>
              <div>
                <dt>Adjuntos</dt>
                <dd>
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
                <span>Comentario administrativo</span>
                <textarea
                  rows={2}
                  value={serviceComment}
                  onChange={(event) => setServiceComment(event.target.value)}
                  placeholder="Ej. Servicio coordinado con proveedor, pendiente de factura."
                />
              </label>

              <label className="field field-wide">
                <span>Adjuntos de la OS</span>
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
          <Briefcase size={20} weight="bold" />
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

      {/* BARRAS DE AVANCE (SI NO ES OS) */}
      {!isServiceOrder && (
        <div className="work-order-progress data-panel wo-compact-progress">
          <div className="work-order-progress-heading">
            <div>
              <span>{orderCopy.progressLabel}</span>
              <strong>{workOrder.progressPercentage} %</strong>
            </div>
            <small>Actualizado: {formatDateTime(workOrder.updatedAt)}</small>
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
            <ShieldCheck size={20} weight="bold" />
            <h2>{orderCopy.validationTitle}</h2>
          </div>

          <div className="wo-workflow-grid">
            <div className={`wo-step-card ${workOrder.progressPercentage === 100 ? "is-done" : "is-active"}`}>
              <span className="wo-step-num">{orderCopy.operatorStep}</span>
              <strong className="wo-step-status">{workOrder.progressPercentage === 100 ? orderCopy.doneLabel : orderCopy.runningLabel}</strong>
              <small className="wo-step-time">{formatWorkDuration(workOrder.startedAt, workOrder.finishedAt)}</small>
            </div>

            <div className={`wo-step-card ${workOrder.supervisor_validation?.approved ? "is-done" : workOrder.supervisor_validation ? "is-returned" : "is-pending"}`}>
              <span className="wo-step-num">2. Supervisión</span>
              <strong className="wo-step-status">{getValidationLabel(workOrder.supervisor_validation)}</strong>
              <small className="wo-step-comment">{supervisorComment}</small>
            </div>

            <div className={`wo-step-card ${needsAdminReview ? "is-active" : workOrder.administrator_validation?.approved ? "is-done" : workOrder.administrator_validation ? "is-returned" : "is-pending"}`}>
              <span className="wo-step-num">3. Administración</span>
              <strong className="wo-step-status">{needsAdminReview ? "Esperando decisión" : getValidationLabel(workOrder.administrator_validation)}</strong>
              <small className="wo-step-comment">{needsAdminReview ? orderCopy.adminPendingHelp : adminRegisteredComment}</small>
            </div>

            <div className={`wo-step-card ${workOrder.satisfaction ? "is-done" : "is-pending"}`}>
              <span className="wo-step-num">4. Solicitante</span>
              <strong className="wo-step-status">{workOrder.satisfaction ? "Evaluado" : "Sin evaluación"}</strong>
              <small className="wo-step-comment">{getRatingLabel(workOrder.satisfaction)}</small>
            </div>
          </div>

          {returnInfo && (
            <div className="return-observation-card wo-compact-return">
              <strong>{returnInfo.title}</strong>
              <p>{returnInfo.comment}</p>
              <small>{returnInfo.nextStep}</small>
            </div>
          )}

          {isAdmin && returnInfo && correctionSchedule && (
            <div className="correction-scheduled-card wo-compact-card">
              <div>
                <CheckCircle size={20} weight="bold" />
                <div>
                  <strong>Corrección programada</strong>
                  <p>{orderCopy.correctionCreated}</p>
                </div>
              </div>
              <dl className="wo-compact-dl">
                <div><dt>Fecha</dt><dd>{formatDate(correctionSchedule.scheduledDate)}</dd></div>
                <div><dt>Hora</dt><dd>{correctionSchedule.scheduledStartTime}</dd></div>
                <div><dt>Duración</dt><dd>{correctionSchedule.plannedHours} h</dd></div>
                <div><dt>Indicaciones</dt><dd>{correctionSchedule.administratorNotes}</dd></div>
              </dl>
            </div>
          )}

          {canScheduleCorrection && (
            <form className="correction-schedule-form wo-compact-form" onSubmit={handleScheduleCorrection}>
              <div>
                <strong>Programar corrección</strong>
                <p>{orderCopy.correctionHelp}</p>
              </div>
              <div className="form-grid">
                <label className="field">
                  <span>Fecha</span>
                  <input
                    type="date"
                    min={todayKey()}
                    value={correctionDate}
                    onChange={(event) => setCorrectionDate(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Hora</span>
                  <input
                    type="time"
                    value={correctionTime}
                    onChange={(event) => setCorrectionTime(event.target.value)}
                  />
                </label>
                <label className="field">
                  <span>Horas est.</span>
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
                <span>Comentario administrativo</span>
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
      {canEditPlanning && (
        <article className="data-panel detail-card work-order-planning-editor">
          <div className="detail-card-heading compact-heading">
            <Briefcase size={18} weight="bold" />
            <div><h2>Edición operativa</h2><p>Administrador y supervisor pueden actualizar planificación, responsables y estado. Los tiempos reales se conservan desde la ejecución.</p></div>
            <button className="button button-secondary button-sm" type="button" onClick={() => void openPlanningEditor()}>{editingPlanning ? "Actualizando…" : "Editar orden"}</button>
          </div>
          {editingPlanning && <form className="work-order-planning-form" onSubmit={savePlanning}>
            <label className="field"><span>Especialidad</span><select value={planning.specialty} onChange={(event) => setPlanning((current) => ({ ...current, specialty: event.target.value as WorkOrder["specialty"] }))}>{Object.entries(specialtyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="field"><span>Prioridad</span><select value={planning.adminPriority} onChange={(event) => setPlanning((current) => ({ ...current, adminPriority: event.target.value as WorkOrder["adminPriority"] }))}>{Object.entries(adminPriorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label className="field"><span>Estado</span><select value={planning.status} onChange={(event) => setPlanning((current) => ({ ...current, status: event.target.value as WorkOrder["status"] }))}>{Object.entries(statusClass).map(([value]) => <option key={value} value={value}>{getWorkOrderStatusLabel({ ...workOrder, status: value as WorkOrderStatus })}</option>)}</select></label>
            <label className="field"><span>Operario</span><select value={planning.operatorId} onChange={(event) => setPlanning((current) => ({ ...current, operatorId: event.target.value }))}>{planningPeople.filter((person) => person.role === "TECNICO").map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></label>
            <label className="field"><span>Supervisor</span><select value={planning.supervisorId} onChange={(event) => setPlanning((current) => ({ ...current, supervisorId: event.target.value }))}>{planningPeople.filter((person) => person.role === "SUPERVISOR").map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select></label>
            <label className="field"><span>Fecha programada</span><input type="date" value={planning.scheduledDate} onChange={(event) => setPlanning((current) => ({ ...current, scheduledDate: event.target.value }))} /></label>
            <label className="field"><span>Hora</span><input type="time" value={planning.scheduledStartTime} onChange={(event) => setPlanning((current) => ({ ...current, scheduledStartTime: event.target.value }))} /></label>
            <label className="field"><span>Horas previstas</span><input min="0.25" step="0.25" type="number" value={planning.plannedHours} onChange={(event) => setPlanning((current) => ({ ...current, plannedHours: Number(event.target.value) }))} /></label>
            <label className="field field-wide"><span>Notas de planificación</span><textarea rows={3} value={planning.administratorNotes} onChange={(event) => setPlanning((current) => ({ ...current, administratorNotes: event.target.value }))} /></label>
            {planningError && <p className="form-error">{planningError}</p>}
            <div className="work-order-planning-actions"><button className="button button-secondary" type="button" onClick={() => setEditingPlanning(false)}>Cancelar</button><button className="button button-primary" disabled={savingPlanning}>Guardar cambios</button></div>
          </form>}
        </article>
      )}
      <div className="detail-grid work-order-detail-grid wo-compact-grid">
        <article className="data-panel detail-card wo-compact-card">
          <div className="detail-card-heading compact-heading">
            <Briefcase size={18} weight="bold" />
            <h2>{orderCopy.dataTitle}</h2>
          </div>
          <dl className="detail-list wo-compact-list">
            <div><dt>Especialidad</dt><dd>{specialtyLabels[workOrder.specialty] || workOrder.specialty}</dd></div>
            <div><dt>Prioridad</dt><dd>{adminPriorityLabels[workOrder.adminPriority] || workOrder.adminPriority}</dd></div>
            <div><dt>Estado</dt><dd>{getWorkOrderStatusLabel(workOrder)}</dd></div>
            <div><dt>Origen</dt><dd>{workOrder.requestCode}</dd></div>
            {getWorkOrderAssetDisplayCode(workOrder) && (
              <div><dt>Bien asociado</dt><dd>{workOrder.assetId ? <Link className="detail-link" to={`/bienes/${workOrder.assetId}`}>{getWorkOrderAssetDisplayCode(workOrder)}</Link> : getWorkOrderAssetDisplayCode(workOrder)}</dd></div>
            )}
          </dl>
        </article>

        {!isServiceOrder && (
          <article className="data-panel detail-card wo-compact-card">
            <div className="detail-card-heading compact-heading">
              <User size={18} weight="bold" />
              <h2>Responsables</h2>
            </div>
            <dl className="detail-list wo-compact-list">
              <div><dt>{orderCopy.operatorLabel}</dt><dd>{workOrder.operatorName || "No asignado"}</dd></div>
              <div><dt>Supervisor</dt><dd>{workOrder.supervisorName || "No asignado"}</dd></div>
            </dl>
          </article>
        )}

        <article className="data-panel detail-card wo-compact-card">
          <div className="detail-card-heading compact-heading">
            <CalendarBlank size={18} weight="bold" />
            <h2>{orderCopy.scheduleTitle}</h2>
          </div>
          <dl className="detail-list wo-compact-list">
            <div><dt>Programada</dt><dd>{formatDate(workOrder.scheduledDate)}</dd></div>
            <div><dt>Inicio</dt><dd>{formatDateTime(workOrder.startedAt)}</dd></div>
            <div><dt>Finalización</dt><dd>{formatDateTime(workOrder.finishedAt)}</dd></div>
            <div><dt>Cierre</dt><dd>{formatDateTime(workOrder.closedAt)}</dd></div>
          </dl>
        </article>

        {!isServiceOrder && (
          <article className="data-panel detail-card wo-compact-card">
            <div className="detail-card-heading compact-heading">
              <ClockCounterClockwise size={18} weight="bold" />
              <h2>{orderCopy.durationTitle}</h2>
            </div>
            <dl className="detail-list wo-compact-list">
              <div><dt>Efectivo</dt><dd>{formatMinutesDuration(workOrder.effectiveWorkMinutes)}</dd></div>
              <div><dt>Calendario</dt><dd>{formatWorkDuration(workOrder.startedAt, workOrder.finishedAt)}</dd></div>
            </dl>
          </article>
        )}

        <article className="data-panel detail-card wo-compact-card">
          <div className="detail-card-heading compact-heading">
            <MapPin size={18} weight="bold" />
            <h2>{orderCopy.locationTitle}</h2>
          </div>
          {request ? (
            <dl className="detail-list wo-compact-list">
              <div><dt>Zona</dt><dd>{request.zone}</dd></div>
              <div><dt>Edificio</dt><dd>{request.building}</dd></div>
              <div><dt>Área</dt><dd>{request.area}</dd></div>
              <div><dt>Ambiente</dt><dd>{request.room}</dd></div>
            </dl>
          ) : (
            <p className="detail-empty">Sin ubicación vinculada.</p>
          )}
        </article>
      </div>

      {/* EVIDENCIA FOTOGRÁFICA (ANTES Y DESPUÉS) */}
      {!isServiceOrder && (
        <article className="data-panel detail-card work-order-photo-evidence wo-compact-card">
          <div className="detail-card-heading compact-heading">
            <ClipboardText size={18} weight="bold" />
            <div>
              <h2>Evidencia fotográfica</h2>
              <p className="wo-subtitle-sm">Comparativa visual del trabajo (Antes / Después).</p>
            </div>
          </div>

          {photoMessage && (
            <div
              style={{
                padding: "10px 14px",
                borderRadius: "8px",
                marginBottom: "14px",
                fontSize: "13px",
                fontWeight: 600,
                background: photoMessage.type === "success" ? "#E8F5E9" : "#FFEBEE",
                color: photoMessage.type === "success" ? "#1B5E20" : "#C62828",
                border: `1px solid ${photoMessage.type === "success" ? "#C8E6C9" : "#FFCDD2"}`,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>{photoMessage.text}</span>
              <button
                type="button"
                style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, color: "inherit" }}
                onClick={() => setPhotoMessage(null)}
              >
                ✕
              </button>
            </div>
          )}

          <div className="work-order-photo-grid wo-compact-photo-grid">
            {([
              ["Antes", photoUrls.start, "Sin foto de inicio.", "start" as const],
              ["Después", photoUrls.finish, "Sin foto final.", "finish" as const],
            ] as const).map(([label, url, help, photoType]) => (
              <figure className="work-order-photo-card wo-compact-photo-card" key={label}>
                <figcaption style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong>{label}</strong>
                  {canManagePhotos && <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                    {url && (
                      <button
                        type="button"
                        style={{
                          cursor: "pointer",
                          fontSize: "12px",
                          color: "#C62828",
                          fontWeight: 600,
                          background: "#FFEBEE",
                          border: "1px solid #FFCDD2",
                          borderRadius: "6px",
                          padding: "4px 10px",
                          transition: "all 0.15s ease",
                        }}
                        disabled={uploadingPhoto !== null}
                        onClick={() => void handleDeletePhoto(photoType)}
                      >
                        🗑️ Borrar
                      </button>
                    )}
                    <label
                      style={{
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "12px",
                        color: "#FFFFFF",
                        fontWeight: 600,
                        background: "#111111",
                        border: "1px solid #111111",
                        borderRadius: "6px",
                        padding: "4px 12px",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {uploadingPhoto === photoType ? "Subiendo..." : url ? "📷 Cambiar foto" : "+ Subir foto"}
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: "none" }}
                        disabled={uploadingPhoto !== null}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            void handleUploadPhoto(photoType, file);
                          }
                        }}
                      />
                    </label>
                  </div>}
                </figcaption>
                {url ? <img src={url} alt={`Estado del bien ${label.toLowerCase()}`} /> : <div className="work-order-photo-empty">{help}</div>}
              </figure>
            ))}
          </div>
        </article>
      )}

      {/* INDICACIONES Y SIGUIENTE PASO SIDE-BY-SIDE */}
      <div className="wo-two-column-row">
        {/* INDICACIONES DEL ADMINISTRADOR */}
        <article className="data-panel detail-card work-order-notes wo-compact-card">
          <div className="detail-card-heading compact-heading">
            <ClipboardText size={18} weight="bold" />
            <h2>Indicaciones del administrador</h2>
          </div>
          <p className="wo-notes-text">{workOrder.administratorNotes || "Sin indicaciones adicionales."}</p>
        </article>

        {/* SIGUIENTE PASO DE EJECUCIÓN */}
        {!isServiceOrder && (
          <article className="data-panel detail-card work-order-actions-card technician-next-action-card wo-compact-card">
            <div className="detail-card-heading compact-heading">
              <Wrench size={18} weight="bold" />
              <h2>Siguiente paso</h2>
            </div>
            {isAdmin ? (
              <MaterialesOTAdminSection workOrderId={workOrder.id} emptyMessage={orderCopy.executionEmpty} />
            ) : (
              <p className="detail-empty">{orderCopy.executionEmpty}</p>
            )}

            {canRegisterProgress ? (
              <>
                <div className="technician-next-action-copy">
                  <strong>
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
              <p className="detail-empty">
                {workOrder.correctionWorkOrderId
                  ? "Esta orden tiene una corrección vinculada. Abre la nueva orden para continuar."
                  : "No hay acciones pendientes para el técnico."}
              </p>
            )}
          </article>
        )}
      </div>
    </section>
  );
}
