import {
  ArrowLeft,
  Briefcase,
  CalendarBlank,
  ClipboardText,
  MapPin,
  User,
  Wrench,
} from "@phosphor-icons/react";
import { Link, useParams } from "react-router-dom";

import { getWorkRequestById } from "@/modules/incidents/incidentRepository";
import {
  adminPriorityLabels,
  specialtyLabels,
  workOrderStatusLabels,
  type WorkOrderStatus,
} from "@/modules/workorders/workOrderModel";
import { getWorkOrderById } from "@/modules/workorders/workOrderRepository";

const statusClass: Record<WorkOrderStatus, string> = {
  PROGRAMADA: "status-neutral",
  ASIGNADA: "status-warning",
  EN_PROCESO: "status-warning",
  PENDIENTE_DE_SUPERVISION: "status-neutral",
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
  if (!value) {
    return "No registrado";
  }

  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function WorkOrderDetailPage() {
  const { id } = useParams();

  const workOrder = id ? getWorkOrderById(id) : undefined;

  const request = workOrder
    ? getWorkRequestById(workOrder.requestId)
    : undefined;

  if (!workOrder) {
    return (
      <section>
        <div className="page-heading">
          <div>
            <p className="breadcrumb">
              Mantenimiento / Órdenes de trabajo / Detalle
            </p>

            <h1>Orden de trabajo no encontrada</h1>

            <p>
              La orden indicada no existe o ya no está disponible.
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

  return (
    <section>
      <div className="page-heading">
        <div>
          <p className="breadcrumb">
            Mantenimiento / Órdenes de trabajo / {workOrder.code}
          </p>

          <h1>Detalle de orden de trabajo</h1>

          <p>
            Consulta la programación, responsables y avance de la orden.
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

      <div className="detail-header data-panel">
        <div>
          <span className="detail-code">
            {workOrder.code}
          </span>

          <h2>
            {request?.description ?? "Orden de trabajo"}
          </h2>

          <p>
            Solicitud de origen:{" "}
            <Link
              className="detail-link"
              to={`/incidencias/${workOrder.requestId}`}
            >
              {workOrder.requestCode}
            </Link>
          </p>
        </div>

        <span
          className={`status ${statusClass[workOrder.status]}`}
        >
          {workOrderStatusLabels[workOrder.status]}
        </span>
      </div>

      <div className="work-order-progress data-panel">
        <div className="work-order-progress-heading">
          <div>
            <span>Avance de la orden</span>
            <strong>{workOrder.progressPercentage} %</strong>
          </div>

          <small>
            Última actualización:{" "}
            {formatDateTime(workOrder.updatedAt)}
          </small>
        </div>

        <div
          className="progress-track"
          aria-label={`Avance ${workOrder.progressPercentage} por ciento`}
        >
          <div
            className="progress-value"
            style={{
              width: `${Math.min(
                Math.max(workOrder.progressPercentage, 0),
                100,
              )}%`,
            }}
          />
        </div>
      </div>

      <div className="detail-grid">
        <article className="data-panel detail-card">
          <div className="detail-card-heading">
            <Briefcase size={22} />
            <h2>Datos de la orden</h2>
          </div>

          <dl className="detail-list">
            <div>
              <dt>Especialidad</dt>
              <dd>
                {specialtyLabels[workOrder.specialty]}
              </dd>
            </div>

            <div>
              <dt>Prioridad administrativa</dt>
              <dd>
                {adminPriorityLabels[workOrder.adminPriority]}
              </dd>
            </div>

            <div>
              <dt>Estado actual</dt>
              <dd>
                {workOrderStatusLabels[workOrder.status]}
              </dd>
            </div>

            <div>
              <dt>Solicitud de origen</dt>
              <dd>{workOrder.requestCode}</dd>
            </div>
          </dl>
        </article>

        <article className="data-panel detail-card">
          <div className="detail-card-heading">
            <User size={22} />
            <h2>Responsables</h2>
          </div>

          <dl className="detail-list">
            <div>
              <dt>Operario asignado</dt>
              <dd>{workOrder.operatorName}</dd>
            </div>

            <div>
              <dt>Supervisor asignado</dt>
              <dd>{workOrder.supervisorName}</dd>
            </div>
          </dl>
        </article>

        <article className="data-panel detail-card">
          <div className="detail-card-heading">
            <CalendarBlank size={22} />
            <h2>Programación</h2>
          </div>

          <dl className="detail-list">
            <div>
              <dt>Fecha programada</dt>
              <dd>{formatDate(workOrder.scheduledDate)}</dd>
            </div>

            <div>
              <dt>Fecha de inicio</dt>
              <dd>{formatDateTime(workOrder.startedAt)}</dd>
            </div>

            <div>
              <dt>Fecha de finalización</dt>
              <dd>{formatDateTime(workOrder.finishedAt)}</dd>
            </div>

            <div>
              <dt>Fecha de cierre</dt>
              <dd>{formatDateTime(workOrder.closedAt)}</dd>
            </div>
          </dl>
        </article>

        <article className="data-panel detail-card">
          <div className="detail-card-heading">
            <MapPin size={22} />
            <h2>Ubicación del trabajo</h2>
          </div>

          {request ? (
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
          ) : (
            <p className="detail-empty">
              No se encontró la solicitud relacionada.
            </p>
          )}
        </article>
      </div>

      <article className="data-panel detail-card work-order-notes">
        <div className="detail-card-heading">
          <ClipboardText size={22} />
          <h2>Indicaciones del administrador</h2>
        </div>

        <p>
          {workOrder.administratorNotes ||
            "No se registraron indicaciones adicionales."}
        </p>
      </article>

      <article className="data-panel detail-card work-order-actions-card">
        <div className="detail-card-heading">
          <Wrench size={22} />
          <h2>Ejecución de la orden</h2>
        </div>

        <p className="detail-empty">
          Los avances, materiales, herramientas y evidencias del operario
          aparecerán en esta sección.
        </p>
      </article>
    </section>
  );
}