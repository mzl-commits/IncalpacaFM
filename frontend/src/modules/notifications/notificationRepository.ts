import { api } from "@/services/api";

export type DeliveryStatus = "PENDIENTE" | "ENVIADA" | "ERROR" | "CANCELADA";

export interface EmailNotification {
  id: string;
  event: string;
  subject: string;
  body: string;
  recipientName: string;
  recipientEmail: string;
  entityType: string;
  entityId: string;
  deliveryChannel: "SISTEMA" | "CORREO" | "AMBOS";
  status: DeliveryStatus;
  attempts: number;
  max_attempts: number;
  availableAt: string;
  sentAt: string | null;
  readAt: string | null;
  last_error: string;
  createdAt: string;
}

/** Resolves the operation associated with an in-app notification. */
export function notificationActionPath(item: EmailNotification): string | null {
  // Los resúmenes de inspección son agregados (no apuntan a un material puntual),
  // así que no llevan entityId: se resuelven por evento, no por entidad.
  if (item.event === "INSPECTION_OVERDUE") return "/almacen/inspecciones/vencidas";
  if (item.event === "INSPECTION_DUE_SOON") return "/almacen/inspecciones";

  if (!item.entityId) return null;

  if (item.entityType === "WorkOrder") {
    if (["WORK_ORDER_ASSIGNED", "WORK_ORDER_TIME_EXCEEDED", "WORK_ORDER_TRACEABILITY_PENDING"].includes(item.event)) {
      return `/ordenes-trabajo/${item.entityId}/ejecutar`;
    }
    if (item.event === "REPAIR_FINISHED") return `/supervision?workOrder=${item.entityId}`;
    return `/ordenes-trabajo/${item.entityId}`;
  }
  if (item.entityType === "Incident") return `/incidencias/${item.entityId}`;
  if (item.entityType === "Asset") return `/bienes/${item.entityId}`;
  if (item.entityType === "Assignment") return `/asignaciones/${item.entityId}`;
  if (item.entityType === "GrupoSolicitud") return `/almacen/movimientos/solicitudes/${item.entityId}`;
  if (item.entityType === "SolicitudMovimiento") return `/almacen/movimientos/solicitudes/${item.entityId}`;
  if (item.entityType === "RetirementRequest") return `/bienes/ciclo-vida/bajas/${item.entityId}`;
  return null;
}

export async function listNotifications(options?: { includeAll?: boolean }): Promise<EmailNotification[]> {
  const { data } = await api.get<EmailNotification[]>("/notifications/", { params: options?.includeAll ? { all: 1 } : undefined });
  return data;
}

export async function markNotificationRead(id: string): Promise<EmailNotification> {
  const { data } = await api.post<EmailNotification>(`/notifications/${id}/read/`);
  return data;
}

export async function retryNotification(id: string): Promise<EmailNotification> {
  const { data } = await api.post<EmailNotification>(`/notifications/${id}/retry/`);
  return data;
}