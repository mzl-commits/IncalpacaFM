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

export async function startWorkOrder(id: string, startPhoto: File): Promise<WorkOrder> {
  const payload = new FormData();
  payload.append("action", "START");
  payload.append("startPhoto", startPhoto);
  const { data } = await api.post<WorkOrder>(`/work-orders/${id}/actions/`, payload, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  notifyChanges();
  return data;
}

export interface RegisterProgressInput {
  percentage: number;
  observation: string;
  evidenceNames: string[];
  finishPhoto?: File | null;
}

export async function registerWorkOrderProgress(
  id: string,
  input: RegisterProgressInput,
): Promise<WorkOrder> {
  const evidence = input.evidenceNames.map((name) => ({
    id: crypto.randomUUID(),
    name,
    mimeType: "image/*",
    size: 0,
    createdAt: new Date().toISOString(),
  }));
  const payload = input.finishPhoto
    ? (() => {
        const form = new FormData();
        form.append("action", "PROGRESS");
        form.append("percentage", String(input.percentage));
        form.append("observation", input.observation);
        form.append("finishPhoto", input.finishPhoto);
        return form;
      })()
    : { action: "PROGRESS", percentage: input.percentage, observation: input.observation, evidence };
  const { data } = await api.post<WorkOrder>(`/work-orders/${id}/actions/`, payload, input.finishPhoto
    ? { headers: { "Content-Type": "multipart/form-data" } }
    : undefined,
  );
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

export type WorkOrderCost = { id: string; category: string; categoryLabel: string; description: string; amount: string; createdAt: string };
export async function listWorkOrderCosts(id: string): Promise<WorkOrderCost[]> {
  const { data } = await api.get<WorkOrderCost[]>(`/work-orders/${id}/costs/`);
  return data;
}
export async function addWorkOrderCost(id: string, input: { category: string; description: string; amount: number }): Promise<WorkOrderCost> {
  const { data } = await api.post<WorkOrderCost>(`/work-orders/${id}/costs/`, input);
  return data;
}
export async function generateWorkOrderReport(id: string): Promise<{ id: string; downloadPath: string }> {
  const { data } = await api.post<{ id: string; downloadPath: string }>(`/work-orders/${id}/reports/`);
  return data;
}
