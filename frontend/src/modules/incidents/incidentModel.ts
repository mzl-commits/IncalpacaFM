export const REQUEST_TYPES = [
  "MANTENIMIENTO_CORRECTIVO",
  "MANTENIMIENTO_PREVENTIVO",
  "INSTALACION",
  "TRASLADO",
  "INSPECCION",
  "OTRO",
] as const;

export type RequestType = (typeof REQUEST_TYPES)[number];

export const REQUEST_PRIORITIES = [
  "NORMAL",
  "URGENTE",
  "EMERGENCIA",
] as const;

export type RequestPriority = (typeof REQUEST_PRIORITIES)[number];

export const REQUEST_STATUSES = [
  "PENDIENTE",
  "EN_EVALUACION",
  "APROBADA",
  "RECHAZADA",
  "CONVERTIDA_EN_OT",
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export const requestTypeLabels: Record<RequestType, string> = {
  MANTENIMIENTO_CORRECTIVO: "Mantenimiento correctivo",
  MANTENIMIENTO_PREVENTIVO: "Mantenimiento preventivo",
  INSTALACION: "Instalación",
  TRASLADO: "Traslado",
  INSPECCION: "Inspección",
  OTRO: "Otro",
};

export const requestPriorityLabels: Record<RequestPriority, string> = {
  NORMAL: "Normal",
  URGENTE: "Urgente",
  EMERGENCIA: "Emergencia",
};

export const requestStatusLabels: Record<RequestStatus, string> = {
  PENDIENTE: "Pendiente",
  EN_EVALUACION: "En evaluación",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
  CONVERTIDA_EN_OT: "Convertida en OT",
};