import { mockWorkOrders } from "./data/mockWorkOrders";
import type { WorkOrder } from "./types";

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

function generateWorkOrderCode(workOrders: WorkOrder[]) {
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