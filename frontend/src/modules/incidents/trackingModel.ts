export type TrackingStatus =
  | "REPORTADO"
  | "ASIGNADO"
  | "EN_PROCESO"
  | "FINALIZADO";

export interface TrackingEvent {
  id: string;
  status: TrackingStatus;
  description: string;
  date: string;
}

export interface RequestTracking {
  incidentId: string;
  currentStatus: TrackingStatus;
  workerName: string;
  workerSpecialty: string;
  events: TrackingEvent[];
}