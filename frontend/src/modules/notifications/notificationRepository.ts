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
  status: DeliveryStatus;
  attempts: number;
  max_attempts: number;
  availableAt: string;
  sentAt: string | null;
  readAt: string | null;
  last_error: string;
  createdAt: string;
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
