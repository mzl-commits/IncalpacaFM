export const SPECIALTIES = [
  "ELECTRICIDAD",
  "CARPINTERIA",
  "SOLDADURA",
  "REDES_Y_ANEXOS",
  "TRASLADOS",
  "GASFITERIA",
  "OBRA_CIVIL",
  "PINTURA",
  "LIMPIEZA",
  "JARDINERIA",
  "SERVICIO_EXTERNO",
] as const;

export type Specialty = (typeof SPECIALTIES)[number];

export const ADMIN_PRIORITIES = [
  "BAJA",
  "MEDIA",
  "ALTA",
] as const;

export type AdminPriority = (typeof ADMIN_PRIORITIES)[number];

export const WORK_ORDER_STATUSES = [
  "PROGRAMADA",
  "ASIGNADA",
  "EN_PROCESO",
  "PENDIENTE_DE_SUPERVISION",
  "PENDIENTE_DE_VALIDACION",
  "PENDIENTE_DE_CONFORMIDAD",
  "DEVUELTA",
  "REPROCESO",
  "APROBADA_POR_SUPERVISOR",
  "CERRADA",
  "CANCELADA",
] as const;

export type WorkOrderStatus = (typeof WORK_ORDER_STATUSES)[number];

export type WorkOrderType = "OT" | "OL" | "OS";

export const workOrderTypeLabels: Record<WorkOrderType, string> = {
  OT: "Orden de trabajo",
  OL: "Orden de limpieza",
  OS: "Orden de servicio",
};

export const specialtyLabels: Record<Specialty, string> = {
  ELECTRICIDAD: "Electricidad",
  CARPINTERIA: "Carpintería",
  SOLDADURA: "Soldadura",
  REDES_Y_ANEXOS: "Redes y anexos",
  TRASLADOS: "Traslados",
  GASFITERIA: "Gasfitería",
  OBRA_CIVIL: "Obra civil",
  PINTURA: "Pintura",
  LIMPIEZA: "Limpieza",
  JARDINERIA: "Jardinería",
  SERVICIO_EXTERNO: "Servicio externo",
};

export const adminPriorityLabels: Record<AdminPriority, string> = {
  BAJA: "Baja",
  MEDIA: "Media",
  ALTA: "Alta",
};

export const workOrderStatusLabels: Record<WorkOrderStatus, string> = {
  PROGRAMADA: "Programada",
  ASIGNADA: "Asignada",
  EN_PROCESO: "En proceso",
  PENDIENTE_DE_SUPERVISION: "Pendiente de supervisión",
  PENDIENTE_DE_VALIDACION: "Pendiente de validación administrativa",
  PENDIENTE_DE_CONFORMIDAD: "Ejecutada, pendiente de conformidad",
  DEVUELTA: "Devuelta",
  REPROCESO: "Reproceso",
  APROBADA_POR_SUPERVISOR: "Aprobada por supervisor",
  CERRADA: "Cerrada",
  CANCELADA: "Cancelada",
};

interface WorkOrderReturnFields {
  status: WorkOrderStatus;
  supervisor_validation?: Record<string, unknown>;
  administrator_validation?: Record<string, unknown>;
}

function getComment(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function getWorkOrderReturnInfo(workOrder: WorkOrderReturnFields) {
  if (workOrder.status !== "DEVUELTA") return null;

  if (workOrder.administrator_validation?.approved === false) {
    return {
      source: "admin" as const,
      statusLabel: "Devuelta por administración",
      title: "Orden devuelta por administración",
      comment: getComment(workOrder.administrator_validation.comment, "Sin motivo administrativo registrado."),
      nextStep: "Programa o abre la OT de corrección vinculada para atender lo observado.",
    };
  }

  if (workOrder.supervisor_validation?.approved === false) {
    return {
      source: "supervisor" as const,
      statusLabel: "Devuelta por supervisión",
      title: "Orden devuelta por supervisión",
      comment: getComment(workOrder.supervisor_validation.comment, "Sin motivo del supervisor registrado."),
      nextStep: "Programa o abre la OT de corrección vinculada para atender lo observado.",
    };
  }

  return {
    source: "unknown" as const,
    statusLabel: "Devuelta para corrección",
    title: "Orden devuelta para corrección",
    comment: "Revisa las observaciones registradas antes de continuar.",
    nextStep: "Programa o abre la OT de corrección vinculada para atender lo observado.",
  };
}

export function getWorkOrderStatusLabel(workOrder: WorkOrderReturnFields) {
  return getWorkOrderReturnInfo(workOrder)?.statusLabel ?? workOrderStatusLabels[workOrder.status];
}

