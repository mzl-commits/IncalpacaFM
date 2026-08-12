import { api } from "@/services/api";
import type { WorkOrder } from "./types";
import { createClientId } from "@/utils/uuid";

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

export type WorkOrderCreatePayload = Partial<Omit<WorkOrder, "id" | "code" | "createdAt" | "updatedAt">> & {
  technicianWorkerCode?: string;
  technicianWorkerCodes?: string[];
  directRequestDescription?: string;
  directRequestType?: string;
  directAssetId?: string | null;
  directLocationId?: string | null;
  orderType?: "OT" | "OL" | "OS";
};

export async function createWorkOrder(
  workOrder: WorkOrderCreatePayload,
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

export async function quickAssignWorkOrder(id: string, technicianId: string): Promise<WorkOrder> {
  const { data } = await api.post<WorkOrder>(`/work-orders/${id}/quick-assign/`, { technicianId });
  notifyChanges();
  return data;
}

export async function startWorkOrder(id: string, startPhoto?: File | null): Promise<WorkOrder> {
  const payload = new FormData();
  payload.append("action", "START");
  if (startPhoto) payload.append("startPhoto", startPhoto);
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
    id: createClientId("evidence"),
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

export async function updateWorkOrderPhoto(
  id: string,
  stage: "START" | "FINISH",
  photoFile: File,
): Promise<WorkOrder> {
  const payload = new FormData();
  payload.append("action", "UPDATE_PHOTO");
  payload.append("observation", stage);
  if (stage === "START") {
    payload.append("startPhoto", photoFile);
  } else {
    payload.append("finishPhoto", photoFile);
  }
  const { data } = await api.post<WorkOrder>(`/work-orders/${id}/actions/`, payload, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  notifyChanges();
  return data;
}

export async function deleteWorkOrderPhoto(
  id: string,
  stage: "START" | "FINISH",
): Promise<WorkOrder> {
  const { data } = await api.post<WorkOrder>(`/work-orders/${id}/actions/`, {
    action: "DELETE_PHOTO",
    observation: stage,
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

export async function updateServiceOrderStatus(
  id: string,
  action: "SERVICE_START" | "SERVICE_CLOSE" | "SERVICE_CANCEL",
  comment: string,
  attachments: string[] = [],
): Promise<WorkOrder> {
  const { data } = await api.post<WorkOrder>(`/work-orders/${id}/actions/`, {
    action,
    payload: { comment, attachments },
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

export async function scheduleWorkOrderCorrection(
  id: string,
  input: {
    scheduledDate: string;
    scheduledStartTime: string;
    plannedHours: number;
    administratorNotes: string;
  },
): Promise<WorkOrder> {
  const { data } = await api.post<WorkOrder>(`/work-orders/${id}/actions/`, {
    action: "RESCHEDULE_CORRECTION",
    payload: input,
  });
  notifyChanges();
  return data;
}

// ─── Almaceneros autorizados (visibilidad de la OT en Almacén) ────────────────
// Nota: este endpoint vive en el módulo de inventario (backend/apps/inventario)
// porque es quien lo consume para poblar el selector de OTs en movimientos,
// pero su gestión (solo ADMINISTRADOR) se expone aquí junto al resto de
// acciones administrativas sobre la OT.

export interface AlmaceneroAutorizadoUsuario {
  id: number;
  worker_code: string;
  full_name: string;
  role: string;
  role_display: string;
}

export interface AlmacenerosAutorizadosResponse {
  work_order_id: string;
  work_order_code: string;
  autorizados: AlmaceneroAutorizadoUsuario[];
  disponibles: AlmaceneroAutorizadoUsuario[];
}

export async function getAlmacenerosAutorizados(workOrderId: string): Promise<AlmacenerosAutorizadosResponse> {
  const { data } = await api.get<AlmacenerosAutorizadosResponse>(
    `/ots/${workOrderId}/almaceneros-autorizados/`,
  );
  return data;
}

export async function setAlmacenerosAutorizados(
  workOrderId: string,
  almaceneroIds: number[],
): Promise<Pick<AlmacenerosAutorizadosResponse, "work_order_id" | "work_order_code" | "autorizados">> {
  const { data } = await api.put<Pick<AlmacenerosAutorizadosResponse, "work_order_id" | "work_order_code" | "autorizados">>(
    `/ots/${workOrderId}/almaceneros-autorizados/`,
    { almacenero_ids: almaceneroIds },
  );
  return data;
}