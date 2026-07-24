import { mockWorkOrders } from "./data/mockWorkOrders";
import type {
  WorkOrder,
  WorkOrderProgress,
} from "./types";

const STORAGE_KEY = "sgtb_work_orders";

export const WORK_ORDERS_UPDATED_EVENT =
  "sgtb:work-orders-updated";

function notifyChanges() {
  window.dispatchEvent(
    new Event(WORK_ORDERS_UPDATED_EVENT),
  );
}

function saveWorkOrders(workOrders: WorkOrder[]) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(workOrders),
  );

  notifyChanges();
}

export function listWorkOrders(): WorkOrder[] {
  const stored = localStorage.getItem(STORAGE_KEY);

  if (!stored) {
    saveWorkOrders(mockWorkOrders);
    return mockWorkOrders;
  }

  try {
    return JSON.parse(stored) as WorkOrder[];
  } catch {
    saveWorkOrders(mockWorkOrders);
    return mockWorkOrders;
  }
}

function generateWorkOrderCode(
  workOrders: WorkOrder[],
) {
  const year = new Date().getFullYear();

  const lastNumber = workOrders.reduce(
    (maximum, workOrder) => {
      const match = workOrder.code.match(
        /OT-\d{4}-(\d+)/,
      );

      if (!match) {
        return maximum;
      }

      return Math.max(
        maximum,
        Number(match[1]),
      );
    },
    0,
  );

  return `OT-${year}-${String(lastNumber + 1).padStart(
    4,
    "0",
  )}`;
}

export function createWorkOrder(
  workOrder: Omit<
    WorkOrder,
    "id" | "code" | "createdAt" | "updatedAt"
  >,
): WorkOrder {
  const workOrders = listWorkOrders();
  const now = new Date().toISOString();

  const newWorkOrder: WorkOrder = {
    ...workOrder,
    id: crypto.randomUUID(),
    code: generateWorkOrderCode(workOrders),
    advances: workOrder.advances ?? [],
    createdAt: now,
    updatedAt: now,
  };

  saveWorkOrders([
    newWorkOrder,
    ...workOrders,
  ]);

  return newWorkOrder;
}

export function getWorkOrderById(
  id: string,
): WorkOrder | undefined {
  return listWorkOrders().find(
    (workOrder) => workOrder.id === id,
  );
}

export function updateWorkOrder(
  id: string,
  changes: Partial<WorkOrder>,
): WorkOrder | undefined {
  const workOrders = listWorkOrders();

  const index = workOrders.findIndex(
    (workOrder) => workOrder.id === id,
  );

  if (index === -1) {
    return undefined;
  }

  const updatedWorkOrder: WorkOrder = {
    ...workOrders[index],
    ...changes,
    updatedAt: new Date().toISOString(),
  };

  const updatedWorkOrders = [...workOrders];
  updatedWorkOrders[index] = updatedWorkOrder;

  saveWorkOrders(updatedWorkOrders);

  return updatedWorkOrder;
}

export function startWorkOrder(
  id: string,
): WorkOrder | undefined {
  const workOrder = getWorkOrderById(id);

  if (!workOrder) {
    return undefined;
  }

  if (workOrder.status === "EN_PROCESO") {
    return workOrder;
  }

  return updateWorkOrder(id, {
    status: "EN_PROCESO",
    startedAt:
      workOrder.startedAt ??
      new Date().toISOString(),
  });
}

export interface RegisterProgressInput {
  operatorId: string;
  operatorName: string;
  percentage: number;
  observation: string;
  evidenceNames: string[];
}

export function registerWorkOrderProgress(
  id: string,
  input: RegisterProgressInput,
): WorkOrder | undefined {
  const workOrder = getWorkOrderById(id);

  if (!workOrder) {
    return undefined;
  }

  const now = new Date().toISOString();

  const progress: WorkOrderProgress = {
    id: crypto.randomUUID(),
    workOrderId: workOrder.id,
    operatorId: input.operatorId,
    operatorName: input.operatorName,
    percentage: input.percentage,
    observation: input.observation.trim(),

    evidence: input.evidenceNames.map(
      (name) => ({
        id: crypto.randomUUID(),
        name,
        mimeType: "image/*",
        size: 0,
        createdAt: now,
      }),
    ),

    createdAt: now,
  };

  const advances = [
    ...(workOrder.advances ?? []),
    progress,
  ];

  const finished =
    input.percentage === 100;

  return updateWorkOrder(id, {
    advances,
    progressPercentage: input.percentage,
    status: finished
      ? "PENDIENTE_DE_SUPERVISION"
      : "EN_PROCESO",
    startedAt:
      workOrder.startedAt ?? now,
    finishedAt: finished ? now : undefined,
  });
}