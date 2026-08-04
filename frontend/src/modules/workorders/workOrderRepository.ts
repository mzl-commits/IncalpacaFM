import { api } from "@/services/api";
import type { WorkOrder } from "./types";

export const WORK_ORDERS_UPDATED_EVENT = "sgtb:work-orders-updated";

function notifyChanges() {
  window.dispatchEvent(new Event(WORK_ORDERS_UPDATED_EVENT));
}

export function getWorkOrderAssetDisplayCode(workOrder: Pick<WorkOrder, "assetCode" | "assetDisplayCode">) {
  return workOrder.assetDisplayCode || workOrder.assetCode || "";
}

export async function listWorkOrders(): Promise<WorkOrder[]> {
  const { data } = await api.get<WorkOrder[]>("/work-orders/");
  return data;
}

export async function createWorkOrder(
  workOrder: Omit<WorkOrder, "id" | "code" | "createdAt" | "updatedAt"> & { technicianWorkerCode?: string; technicianWorkerCodes?: string[] },
): Promise<WorkOrder> {
  const { data } = await api.post<WorkOrder>("/work-orders/", {
    ...workOrder,
    technicianWorkerCode: workOrder.technicianWorkerCode || "tecnico",
    technicianWorkerCodes: workOrder.technicianWorkerCodes || [],
    supervisorWorkerCode: "supervisor",
  });
  notifyChanges();
  return data;
}

export async function getWorkOrderById(id: string): Promise<WorkOrder> {
  const { data } = await api.get<WorkOrder>(`/work-orders/${id}/`);
  return data;
}

export async function startWorkOrder(id: string): Promise<WorkOrder> {
  const { data } = await api.post<WorkOrder>(`/work-orders/${id}/actions/`, {
    action: "START",
  });
  notifyChanges();
  return data;
}

export interface RegisterProgressInput {
  percentage: number;
  observation: string;
  evidenceNames: string[];
}

export async function registerWorkOrderProgress(
  id: string,
  input: RegisterProgressInput,
): Promise<WorkOrder> {
  const { data } = await api.post<WorkOrder>(`/work-orders/${id}/actions/`, {
    action: "PROGRESS",
    percentage: input.percentage,
    observation: input.observation,
    evidence: input.evidenceNames.map((name) => ({
      id: crypto.randomUUID(),
      name,
      mimeType: "image/*",
      size: 0,
      createdAt: new Date().toISOString(),
    })),
  });
  notifyChanges();
  return data;
}
export async function superviseWorkOrder(
  id: string,
  approved: boolean,
  comment: string,
): Promise<WorkOrder> {
  const { data } = await api.post<WorkOrder>(`/work-orders/${id}/actions/`, {
    action: approved ? "SUPERVISOR_APPROVE" : "SUPERVISOR_RETURN",
    payload: { comment },
  });
  notifyChanges();
  return data;
}
export async function adminReviewWorkOrder(
  id: string,
  approved: boolean,
  comment: string,
): Promise<WorkOrder> {
  const { data } = await api.post<WorkOrder>(`/work-orders/${id}/actions/`, {
    action: approved ? "ADMIN_APPROVE" : "ADMIN_RETURN",
    payload: { comment },
  });
  notifyChanges();
  return data;
}
export async function pauseWorkOrder(id: string): Promise<WorkOrder> {
  const { data } = await api.post<WorkOrder>(`/work-orders/${id}/actions/`, {
    action: "PAUSE",
  });
  notifyChanges();
  return data;
}
