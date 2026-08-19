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
  almacenId?: number | null;
}

/** Resolves the operation associated with an in-app notification. */
export function notificationActionPath(item: EmailNotification): string | null {
  // Rutas agregadas de inspecciones
  if (item.event === "INSPECTION_OVERDUE") {
    return item.almacenId ? `/almacen/${item.almacenId}/inspecciones/vencidas` : null;
  }
  if (item.event === "INSPECTION_DUE_SOON") {
    return item.almacenId ? `/almacen/${item.almacenId}/inspecciones` : null;
  }

  if (item.entityType === "WorkOrder") {
    if (!item.entityId) return null;
    if (["WORK_ORDER_ASSIGNED", "WORK_ORDER_TIME_EXCEEDED", "WORK_ORDER_TRACEABILITY_PENDING"].includes(item.event)) {
      return `/ordenes-trabajo/${item.entityId}/ejecutar`;
    }
    if (item.event === "REPAIR_FINISHED") return `/supervision?workOrder=${item.entityId}`;
    return `/ordenes-trabajo/${item.entityId}`;
  }
  if (item.entityType === "Incident") return item.entityId ? `/incidencias/${item.entityId}` : null;
  if (item.entityType === "Asset") return item.entityId ? `/bienes/${item.entityId}` : null;
  if (item.entityType === "Assignment") return item.entityId ? `/asignaciones/${item.entityId}` : null;
  if (item.entityType === "GrupoSolicitud" || item.entityType === "SolicitudMovimiento") {
    return item.almacenId && item.entityId ? `/almacen/${item.almacenId}/movimientos/solicitudes/${item.entityId}` : null;
  }
  if (item.entityType === "RetirementRequest") return item.entityId ? `/bienes/ciclo-vida/bajas/${item.entityId}` : null;
  if (item.entityType === "Material" || item.event === "STOCK_BAJO" || item.event === "STOCK_AGOTADO" || item.event === "NEW_INSPECTABLE_MATERIAL") {
    return item.almacenId && item.entityId ? `/almacen/${item.almacenId}/catalogo/${item.entityId}` : null;
  }
  if (item.entityType === "Inspeccion" || item.event === "INSPECTION_NON_CONFORMING") {
    return item.almacenId && item.entityId ? `/almacen/${item.almacenId}/inspecciones/${item.entityId}` : null;
  }
  if (item.entityType === "PlanInspeccionAnual" || item.event === "INSPECTION_PLAN_SAVED") {
    return item.almacenId ? `/almacen/${item.almacenId}/plan-anual` : null;
  }
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