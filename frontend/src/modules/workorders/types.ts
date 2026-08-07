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
  assetId?: string | null;
  assetCode?: string | null;
  assetDisplayCode?: string | null;
  correctionOfId?: string | null;
  correctionOfCode?: string | null;
  correctionWorkOrderId?: string | null;
  correctionWorkOrderCode?: string | null;

  operatorId: string;
  operatorName: string;

  supervisorId: string;
  supervisorName: string;

  specialty: Specialty;
  adminPriority: AdminPriority;
  status: WorkOrderStatus;

  scheduledDate: string;
  scheduledStartTime?: string;
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
  startPhoto?: string | null;
  finishPhoto?: string | null;
  satisfaction?: {
    accepted: boolean;
    rating: number | null;
    comment: string;
    submittedAt: string;
  } | null;
  diagnosis?: Record<string, unknown>;
  supervisor_validation?: Record<string, unknown>;
  administrator_validation?: Record<string, unknown>;
  conformity?: Record<string, unknown>;
  recommendation_snapshot?: Record<string, unknown>;

  createdAt: string;
  updatedAt: string;
}
