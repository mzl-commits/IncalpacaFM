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
  assetId?: string | null;
  assetCode?: string | null;
  assetDisplayCode?: string | null;

  requesterId: string;
  requesterName: string;
  requesterEmail: string;

  locationId: string;
  zone: string;
  building: string;
  area: string;
  room: string;
  locationMapId?: string | null;
  locationMarkerX?: number | null;
  locationMarkerY?: number | null;

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
