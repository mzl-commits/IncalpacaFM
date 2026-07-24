import type {
  AdminPriority,
  Specialty,
  WorkOrderStatus,
} from "./workOrderModel";

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

  createdAt: string;
  updatedAt: string;
}