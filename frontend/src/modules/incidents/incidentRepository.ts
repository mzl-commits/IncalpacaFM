import { mockWorkRequests } from "./data/mockIncidents";
import type { WorkRequest } from "./types";

const STORAGE_KEY = "sgtb_work_requests";
export const WORK_REQUESTS_UPDATED_EVENT = "sgtb:work-requests-updated";

function notifyChanges() {
  window.dispatchEvent(new Event(WORK_REQUESTS_UPDATED_EVENT));
}

function saveWorkRequests(requests: WorkRequest[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(requests));
  notifyChanges();
}

export function listWorkRequests(): WorkRequest[] {
  const stored = localStorage.getItem(STORAGE_KEY);

  if (!stored) {
    saveWorkRequests(mockWorkRequests);
    return mockWorkRequests;
  }

  try {
    return JSON.parse(stored) as WorkRequest[];
  } catch {
    saveWorkRequests(mockWorkRequests);
    return mockWorkRequests;
  }
}

function generateRequestCode(requests: WorkRequest[]) {
  const year = new Date().getFullYear();

  const lastNumber = requests.reduce((maximum, request) => {
    const match = request.code.match(/SOL-\d{4}-(\d+)/);

    if (!match) {
      return maximum;
    }

    return Math.max(maximum, Number(match[1]));
  }, 0);

  return `SOL-${year}-${String(lastNumber + 1).padStart(4, "0")}`;
}

export function createWorkRequest(
  request: Omit<WorkRequest, "id" | "code" | "reportedAt" | "updatedAt">,
): WorkRequest {
  const requests = listWorkRequests();
  const now = new Date().toISOString();
  const code = generateRequestCode(requests);

  const newRequest: WorkRequest = {
    ...request,
    id: crypto.randomUUID(),
    code,
    reportedAt: now,
    updatedAt: now,
  };

  saveWorkRequests([newRequest, ...requests]);

  return newRequest;
}

export function getWorkRequestById(id: string): WorkRequest | undefined {
  return listWorkRequests().find((request) => request.id === id);
}