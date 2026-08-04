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
