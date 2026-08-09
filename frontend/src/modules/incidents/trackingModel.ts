export type TrackingStatus =
  | "REPORTADO"
  | "EN_REVISION"
  | "RECHAZADO"
  | "ASIGNADO"
  | "EN_PROCESO"
  | "FINALIZADO"
  | "PENDIENTE_CONFORMIDAD";

export interface TrackingEvent {
  id: string;
  status: TrackingStatus;
  description: string;
  date: string;
}

export interface WorkEvidence {
  id: string;
  name: string;
  mimeType: string;
  createdAt: string;
  progressPercentage?: number;
}

export interface RequestTracking {
  incidentId: string;
  code: string;
  description: string;
  currentStatus: TrackingStatus;
  workerName: string;
  workerSpecialty: string;
  workOrderCode: string;
  workOrderStatus: string;
  workEvidence: WorkEvidence[];
  canSubmitConformity: boolean;
  conformity?: {
    accepted?: boolean;
    rating?: number;
    comment?: string;
    at?: string;
  };
  progressPercentage: number;
  location: string;
  reportedAt: string;
  updatedAt?: string;
  events: TrackingEvent[];
}
