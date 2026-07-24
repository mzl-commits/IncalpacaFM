import type {
  AdminPriority,
  Specialty,
  WorkOrderStatus,
} from "./workOrderModel";

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
  observation: string;
  evidence: WorkOrderEvidence[];

  createdAt: string;
}

export interface WorkOrder {
  id: string;
  code: string;

  requestId: string;
  requestCode: string;

  operatorId: string;
  operatorName: string;

  supervisorId: string;
  supervisorName: string;

  specialty: Specialty;
  adminPriority: AdminPriority;
  status: WorkOrderStatus;

  scheduledDate: string;
  startedAt?: string;
  finishedAt?: string;
  closedAt?: string;

  administratorNotes?: string;
  progressPercentage: number;

  advances?: WorkOrderProgress[];

  createdAt: string;
  updatedAt: string;
}