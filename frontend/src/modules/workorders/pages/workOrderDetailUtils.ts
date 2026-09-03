import type { WorkOrder } from '@/modules/workorders/types';
import { type WorkOrderStatus } from '@/modules/workorders/workOrderModel';

import {
  adminReviewWorkOrder,
  getWorkOrderAssetDisplayCode,
  getWorkOrderById,
  listWorkOrders,
  registerWorkOrderProgress,
  scheduleWorkOrderCorrection,
  startWorkOrder,
  superviseWorkOrder,
  updateServiceOrderStatus,
  updateWorkOrderPlanning,
} from "@/modules/workorders/workOrderRepository";
import type { WorkOrder } from "@/modules/workorders/types";

type PlanningForm = {
  specialty: WorkOrder["specialty"];
  adminPriority: WorkOrder["adminPriority"];
  status: WorkOrder["status"];
  scheduledDate: string;
  scheduledStartTime: string;
  plannedHours: number;
  operatorId: string;
  supervisorId: string;
  administratorNotes: string;
};

const statusClass: Record<WorkOrderStatus, string> = {
  PROGRAMADA: "status-neutral",
  PENDIENTE_REPROGRAMACION: "status-error",
  ASIGNADA: "status-warning",
  EN_PROCESO: "status-warning",
  PENDIENTE_DE_SUPERVISION: "status-neutral",
  PENDIENTE_DE_VALIDACION: "status-warning",
  PENDIENTE_DE_CONFORMIDAD: "status-warning",
  DEVUELTA: "status-error",
  REPROCESO: "status-error",
  APROBADA_POR_SUPERVISOR: "status-success",
  CERRADA: "status-success",
  CANCELADA: "status-error",
};

function formatDate(value: string) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(`${value}T00:00:00`));
  } catch {
    return value;
  }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function formatDateTime(value?: string) {
  if (!value) return "No registrado";
  try {
    return new Intl.DateTimeFormat("es-PE", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatWorkDuration(start?: string, end?: string) {
  if (!start) return "AÃºn no inicia";
  if (!end) return "En curso";

  const diffMs = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return "No disponible";

  const totalMinutes = Math.round(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

function formatMinutesDuration(minutes?: number) {
  if (minutes === undefined || minutes === null) return "No registrado";
  if (minutes <= 0) return "0 min";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
}

function getTextValue(data: Record<string, unknown> | { comment?: unknown } | null | undefined, key: string, fallback: string) {
  const value = data && key === "comment" ? data.comment : (data as Record<string, unknown> | undefined)?.[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function getRatingLabel(data: Record<string, unknown> | { rating?: unknown } | null | undefined) {
  const value = data && "rating" in data ? data.rating : undefined;
  if (typeof value === "number") return `${value} / 5 â­`;
  if (typeof value === "string" && value.trim()) return `${value} / 5 â­`;
  return "Sin puntuaciÃ³n";
}

type CorrectionSchedule = {
  scheduledDate: string;
  scheduledStartTime: string;
  plannedHours: string;
  administratorNotes: string;
};

function getCorrectionSchedule(workOrder: WorkOrder): CorrectionSchedule | undefined {
  const raw = workOrder.recommendation_snapshot?.correctionSchedule;
  if (!raw || typeof raw !== "object") return undefined;
  const value = raw as Record<string, unknown>;
  const scheduledDate = typeof value.scheduledDate === "string" ? value.scheduledDate : "";
  if (!scheduledDate) return undefined;
  return {
    scheduledDate,
    scheduledStartTime: typeof value.scheduledStartTime === "string" ? value.scheduledStartTime : "08:00",
    plannedHours: typeof value.plannedHours === "number" || typeof value.plannedHours === "string" ? String(value.plannedHours) : "-",
    administratorNotes: typeof value.administratorNotes === "string" && value.administratorNotes.trim() ? value.administratorNotes : "Sin indicaciones.",
  };
}

function getValidationLabel(data: Record<string, unknown> | undefined) {
  if (!data || typeof data.approved !== "boolean") return "Pendiente";
  return data.approved ? "Aprobada" : "Devuelta";
}

function getServiceOrderDetails(notes?: string) {
  const details = {
    provider: "No registrado",
    documentCode: "No registrado",
    amount: "No registrado",
    observations: "",
  };

  (notes || "").split("\n").forEach((line) => {
    const [rawLabel, ...rawValue] = line.split(":");
    const label = rawLabel.trim().toLowerCase();
    const value = rawValue.join(":").trim();
    if (!value) return;
    if (label === "proveedor") details.provider = value;
    if (label === "orden de compra o servicio") details.documentCode = value;
    if (label === "monto") details.amount = value;
    if (label === "observaciones") details.observations = value;
  });

  return details;
}

function getStringList(data: Record<string, unknown> | undefined, key: string) {
  const value = data?.[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : [];
}

function getServiceStatusCopy(workOrder: WorkOrder) {
  const serviceStatus = typeof workOrder.administrator_validation?.serviceStatus === "string"
    ? workOrder.administrator_validation.serviceStatus
    : "";
  if (workOrder.status === "CERRADA" || serviceStatus === "CERRADA") {
    return {
      title: "Servicio externo cerrado",
      description: "El proveedor terminÃ³ el servicio y administraciÃ³n cerrÃ³ la OS.",
    };
  }
  if (workOrder.status === "CANCELADA" || serviceStatus === "CANCELADA") {
    return {
      title: "OS cancelada",
      description: "La orden quedÃ³ cancelada por decisiÃ³n administrativa.",
    };
  }
  if (workOrder.status === "EN_PROCESO" || serviceStatus === "EN_COORDINACION") {
    return {
      title: "OS en coordinaciÃ³n",
      description: "AdministraciÃ³n estÃ¡ coordinando el servicio con el proveedor.",
    };
  }
  return {
    title: "OS programada",
    description: "La orden estÃ¡ registrada y pendiente de coordinaciÃ³n.",
  };
}

