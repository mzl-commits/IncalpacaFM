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
    issueCategory?: string;
    otherRequestDetail?: string;
    otherIssueCategoryDetail?: string;
    assetCondition?: string;
    startedWhen?: string;
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
  assetId?: string | null;
  assetCode?: string | null;
  assetName?: string | null;
  assetDisplayCode?: string | null;
  observations?: string | null;
  photoUrl?: string | null;

  requesterId: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone?: string;
  requesterContact?: {
    name?: string;
    email?: string;
    phone?: string;
    workerCode?: string;
  };

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
  impactAssessment?: WorkRequestImpactAssessment;

  status: RequestStatus;
  rejectionReason?: string;
  workOrderId?: string;

  reportedAt: string;
  updatedAt: string;
}
