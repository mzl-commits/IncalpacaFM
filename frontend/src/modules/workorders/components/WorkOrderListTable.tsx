import { CaretRight } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import type { listWorkOrders } from "@/modules/workorders/workOrderRepository";
import {
  adminPriorityLabels,
  getWorkOrderStatusLabel,
  specialtyLabels,
  type WorkOrderStatus,
  type WorkOrderType,
} from "@/modules/workorders/workOrderModel";
import { getWorkOrderAssetDisplayCode } from "@/modules/workorders/workOrderRepository";
import type { SystemUser } from "@/modules/accounts/types";

export type WorkOrder = Awaited<ReturnType<typeof listWorkOrders>>[number];

export const terminalStatuses = new Set<WorkOrderStatus>([
  "APROBADA_POR_SUPERVISOR",
  "CERRADA",
  "CANCELADA",
]);

export const technicianExecutableStatuses = new Set<WorkOrderStatus>([
  "PROGRAMADA",
  "ASIGNADA",
  "EN_PROCESO",
  "REPROCESO",
]);

export const statusClass: Record<WorkOrderStatus, string> = {
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

export function formatDate(value: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export function isOverdue(scheduledDate: string, status: WorkOrderStatus) {
  if (!scheduledDate) return false;
  const today = new Date().toISOString().slice(0, 10);
  return scheduledDate < today && !terminalStatuses.has(status);
}

export function canTechnicianExecuteOrder(workOrder: WorkOrder, user: SystemUser | null | undefined) {
  if (user?.role !== "TECNICO") return false;
  if ((workOrder.orderType ?? "OT") === "OS") return false;
  if (!technicianExecutableStatuses.has(workOrder.status)) return false;
  if (workOrder.progressPercentage >= 100) return false;

  return workOrder.operatorId === user.id || workOrder.operatorName === user.fullName;
}

export function getTechnicianExecutionLabel(workOrder: WorkOrder) {
  const isCleaning = (workOrder.orderType ?? "OT") === "OL";
  const hasStarted = workOrder.status === "EN_PROCESO" || workOrder.progressPercentage > 0;
  if (hasStarted) return isCleaning ? "Continuar limpieza" : "Continuar trabajo";
  return isCleaning ? "Iniciar limpieza" : "Iniciar trabajo";
}

export const typeShortLabels: Record<WorkOrderType, string> = {
  OT: "OT",
  OL: "OL",
  OS: "OS",
};

export const typeDescriptions: Record<WorkOrderType, string> = {
  OT: "Mantenimiento",
  OL: "Limpieza",
  OS: "Servicio externo",
};

export function getOrderType(workOrder: WorkOrder): WorkOrderType {
  return workOrder.orderType ?? "OT";
}

interface WorkOrderListTableProps {
  workOrders: WorkOrder[];
  user: SystemUser | null | undefined;
}

export function WorkOrderListTable({ workOrders, user }: WorkOrderListTableProps) {
  return (
    <>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Orden</th>
              <th>Solicitud</th>
              <th>Tipo</th>
              <th>Especialidad</th>
              <th>Operario</th>
              <th>Supervisor</th>
              <th>Prioridad</th>
              <th>Programación</th>
              <th>Avance</th>
              <th>Estado</th>
              <th>
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>

          <tbody>
            {workOrders.map((workOrder) => {
              const orderType = getOrderType(workOrder);
              const isServiceOrder = orderType === "OS";
              const canExecute = canTechnicianExecuteOrder(workOrder, user);
              return (
                <tr key={workOrder.id} className={`work-order-row is-${orderType.toLowerCase()}`}>
                  <td>
                    <strong>{workOrder.code}</strong>
                  </td>
                  <td>
                    {workOrder.requestCode}
                    {getWorkOrderAssetDisplayCode(workOrder) && (
                      <>
                        <br />
                        <small>Bien: {getWorkOrderAssetDisplayCode(workOrder)}</small>
                      </>
                    )}
                  </td>
                  <td>
                    <span className={`work-order-type-badge is-${orderType.toLowerCase()}`}>
                      <strong>{typeShortLabels[orderType]}</strong>
                      <small>{typeDescriptions[orderType]}</small>
                    </span>
                  </td>
                  <td>{specialtyLabels[workOrder.specialty]}</td>
                  <td>{isServiceOrder ? "Administración" : workOrder.operatorName}</td>
                  <td>{isServiceOrder ? "No aplica" : workOrder.supervisorName}</td>
                  <td>{adminPriorityLabels[workOrder.adminPriority]}</td>
                  <td>{formatDate(workOrder.scheduledDate)}</td>
                  <td>
                    <strong>{isServiceOrder ? "Gestion admin." : `${workOrder.progressPercentage} %`}</strong>
                  </td>
                  <td>
                    <span className={`status ${statusClass[workOrder.status]}`}>
                      {getWorkOrderStatusLabel(workOrder)}
                    </span>
                  </td>
                  <td>
                    <div className="work-order-row-actions">
                      {canExecute && (
                        <Link
                          className="table-action is-primary-action"
                          to={`/ordenes-trabajo/${workOrder.id}/ejecutar`}
                        >
                          {getTechnicianExecutionLabel(workOrder)}
                        </Link>
                      )}
                      <Link className="table-action" to={`/ordenes-trabajo/${workOrder.id}`}>
                        Ver detalle
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}

            {!workOrders.length && (
              <tr>
                <td colSpan={11} className="empty-row">
                  No hay órdenes con esos filtros. Prueba quitando algún filtro o revisa otro estado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div
        className="operational-mobile-list hidden max-[720px]:grid gap-2 p-3"
        aria-label="Órdenes de trabajo"
      >
        {workOrders.map((workOrder) => {
          const orderType = getOrderType(workOrder);
          const isServiceOrder = orderType === "OS";
          return (
            <Link
              key={workOrder.id}
              to={`/ordenes-trabajo/${workOrder.id}`}
              className={`operational-mobile-card is-${orderType.toLowerCase()} grid min-h-11 gap-3 rounded border border-slate-300 bg-white p-4 text-slate-900 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600`}
            >
              <span className="flex items-start justify-between gap-3">
                <strong className="text-sm">{workOrder.code}</strong>
                <span className={`status ${statusClass[workOrder.status]}`}>
                  {getWorkOrderStatusLabel(workOrder)}
                </span>
              </span>
              <span className="grid gap-1 text-xs text-slate-600">
                <strong className="text-sm text-slate-900">
                  {specialtyLabels[workOrder.specialty]}
                </strong>
                <span className={`work-order-type-badge is-${orderType.toLowerCase()}`}>
                  <strong>{typeShortLabels[orderType]}</strong>
                  <small>{typeDescriptions[orderType]}</small>
                </span>
                <span>Solicitud {workOrder.requestCode}</span>
                {getWorkOrderAssetDisplayCode(workOrder) && (
                  <span>Bien {getWorkOrderAssetDisplayCode(workOrder)}</span>
                )}
              </span>
              <span className="grid grid-cols-2 gap-3 text-xs text-slate-600">
                <span>
                  <strong className="block text-slate-800">
                    {isServiceOrder ? "Responsable" : "Operario"}
                  </strong>
                  {isServiceOrder ? "Administración" : workOrder.operatorName}
                </span>
                <span>
                  <strong className="block text-slate-800">Programación</strong>
                  {formatDate(workOrder.scheduledDate)}
                </span>
                <span>
                  <strong className="block text-slate-800">Prioridad</strong>
                  {adminPriorityLabels[workOrder.adminPriority]}
                </span>
                <span>
                  <strong className="block text-slate-800">
                    {isServiceOrder ? "Control" : "Avance"}
                  </strong>
                  {isServiceOrder ? "Administrativo" : `${workOrder.progressPercentage} %`}
                </span>
              </span>
              <span className="flex min-h-11 items-center justify-end gap-1 text-sm font-semibold text-zinc-800">
                Ver detalle
                <CaretRight size={18} aria-hidden="true" />
              </span>
            </Link>
          );
        })}

        {!workOrders.length && (
          <p className="empty-row rounded border border-slate-300 bg-white">
            No hay órdenes con esos filtros. Prueba quitando algún filtro o revisa otro estado.
          </p>
        )}
      </div>
    </>
  );
}
