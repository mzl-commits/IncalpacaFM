import type {
  RequestPriority,
  RequestStatus,
  RequestType,
} from "./incidentModel";

export interface WorkRequestEvidence {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  dataUrl?: string;
}

export interface WorkRequest {
  id: string;
  code: string;

  requesterId: string;
  requesterName: string;
  requesterEmail: string;

  locationId: string;
  zone: string;
  building: string;
  area: string;
  room: string;

  requestType: RequestType;
  description: string;
  requesterPriority: RequestPriority;
  project: boolean;

  evidence: WorkRequestEvidence[];

  status: RequestStatus;
  rejectionReason?: string;
  workOrderId?: string;

  reportedAt: string;
  updatedAt: string;
}