import type {
  AdminPriority,
  Specialty,
  WorkOrderStatus,
} from "./workOrderModel";

export interface WorkOrderSession {
  id: string;
  startAt: string;
  endAt?: string | null;
  operatorName?: string;
}
export interface WorkOrderEvidence {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface WorkOrderProgress {
  id: string;
  workOrderId: string;
  operatorId: string;
  operatorName: string;

  percentage: number;
  workedMinutes?: number;
  observation: string;
  evidence: WorkOrderEvidence[];

  createdAt: string;
}

export interface WorkOrder {
  id: string;
  code: string;

  requestId: string;
  requestCode: string;
  assetCode?: string | null;
  assetDisplayCode?: string | null;

  operatorId: string;
  operatorName: string;

  supervisorId: string;
  supervisorName: string;

  specialty: Specialty;
  adminPriority: AdminPriority;
  status: WorkOrderStatus;

  scheduledDate: string;
  plannedHours: number;
  startedAt?: string;
  finishedAt?: string;
  closedAt?: string;

  administratorNotes?: string;
  progressPercentage: number;

  advances?: WorkOrderProgress[];
  workSessions?: WorkOrderSession[];
  effectiveWorkMinutes?: number;
  activeWorkSession?: WorkOrderSession | null;
  diagnosis?: Record<string, unknown>;
  supervisor_validation?: Record<string, unknown>;
  administrator_validation?: Record<string, unknown>;
  conformity?: Record<string, unknown>;
  recommendation_snapshot?: Record<string, unknown>;

  createdAt: string;
  updatedAt: string;
}
