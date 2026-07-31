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

export interface WorkRequestImpactAssessment {
  suggestedPriority?: RequestPriority;
  priorityReasons?: string[];
  answers?: {
    stopsWork?: "SI" | "NO";
    safetyRisk?: "SI" | "NO";
    essentialService?: "SI" | "NO";
    biggerDamageRisk?: "SI" | "NO";
    affectedPeople?: "SOLO_YO" | "VARIAS_PERSONAS" | "TODA_EL_AREA";
  };
  noPhotoReason?: string;
}

export interface WorkRequest {
  id: string;
  code: string;

  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone?: string;

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
  impactAssessment?: WorkRequestImpactAssessment;

  status: RequestStatus;
  rejectionReason?: string;
  workOrderId?: string;

  reportedAt: string;
  updatedAt: string;
}
