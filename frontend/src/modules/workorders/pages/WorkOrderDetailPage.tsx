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
  getWorkOrderStatusLabel,
  specialtyLabels,
  workOrderStatusLabels,
  type WorkOrderStatus,
} from "@/modules/workorders/workOrderModel";
import {
  adminReviewWorkOrder,
  getWorkOrderAssetDisplayCode,
  getWorkOrderById,
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
function getTextValue(data: Record<string, unknown> | undefined, key: string, fallback: string) {
  const value = data?.[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function getRatingLabel(data: Record<string, unknown> | undefined) {
  const value = data?.rating;
  if (typeof value === "number") return `${value} de 5`;
  if (typeof value === "string" && value.trim()) return `${value} de 5`;
  return "Sin puntuación";
}

function getConformityLabel(data: Record<string, unknown> | undefined) {
  if (!data || typeof data.accepted !== "boolean") return "Pendiente";
  return data.accepted ? "Conforme" : "Pidió revisión";
}
function getValidationLabel(data: Record<string, unknown> | undefined, returnedLabel = "Devuelta") {
  if (!data || typeof data.approved !== "boolean") return "Sin validar";
  return data.approved ? "Aprobada" : returnedLabel;
}

export function WorkOrderDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [workOrder, setWorkOrder] = useState<WorkOrder>();
  const [request, setRequest] = useState<Awaited<ReturnType<typeof getWorkRequestById>>>();
  const [adminComment, setAdminComment] = useState("");
  const [adminError, setAdminError] = useState("");
  const [savingAdminReview, setSavingAdminReview] = useState(false);

  useEffect(() => {
    if (!id) return;
    void getWorkOrderById(id).then(async (order) => {
      setWorkOrder(order);
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
    workOrder.conformity,
    "comment",
    "Sin comentario del solicitante",
  );
  const returnInfo = getWorkOrderReturnInfo(workOrder);

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
          {getWorkOrderStatusLabel(workOrder)}
        </span>
      </div>

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
            <strong>{getValidationLabel(workOrder.supervisor_validation, "Devuelta por supervisor")}</strong>
            <small>{supervisorComment}</small>
          </div>
          <div>
            <span>3. Administrador</span>
            <strong>{needsAdminReview ? "Pendiente de decisión" : getValidationLabel(workOrder.administrator_validation, "Devuelta por administración")}</strong>
            <small>{needsAdminReview ? "Debe aprobar o devolver la ejecución" : adminRegisteredComment}</small>
          </div>
          <div>
            <span>4. Solicitante</span>
            <strong>{getConformityLabel(workOrder.conformity)}</strong>
            <small>{getRatingLabel(workOrder.conformity)} - {requesterComment}</small>
          </div>
        </div>

        {returnInfo && (
          <div className="return-observation-card">
            <strong>{returnInfo.title}</strong>
            <p>{returnInfo.comment}</p>
            <small>{returnInfo.nextStep}</small>
          </div>
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
            <div><dt>Estado actual</dt><dd>{getWorkOrderStatusLabel(workOrder)}</dd></div>
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
