import { api } from "@/services/api";
import type { WorkRequest } from "./types";

export const WORK_REQUESTS_UPDATED_EVENT = "sgtb:work-requests-updated";

function notifyChanges() {
  window.dispatchEvent(new Event(WORK_REQUESTS_UPDATED_EVENT));
}

export async function listWorkRequests(): Promise<WorkRequest[]> {
  const { data } = await api.get<WorkRequest[]>("/incidents/");
  return data;
}

export async function createWorkRequest(
  request: Omit<WorkRequest, "id" | "code" | "reportedAt" | "updatedAt">,
): Promise<WorkRequest> {
  const { data } = await api.post<WorkRequest>("/incidents/", request);
  notifyChanges();
  return data;
}

export async function getWorkRequestById(id: string): Promise<WorkRequest> {
  const { data } = await api.get<WorkRequest>(`/incidents/${id}/`);
  return data;
}

export async function updateWorkRequest(
  id: string,
  changes: Partial<WorkRequest>,
): Promise<WorkRequest> {
  const { data } = await api.patch<WorkRequest>(`/incidents/${id}/`, changes);
  notifyChanges();
  return data;
}
