export interface LocationMapSummary {
  id: string;
  version: number;
  originalFilename: string;
  imageSha256: string;
  width: number;
  height: number;
  description: string;
  active: boolean;
  createdAt: string;
  imageUrl: string;
}

export interface LocationOption {
  id: string;
  locationCode: string;
  sourceCompany: string;
  sourceVersion: string;
  site?: string;
  level?: string;
  requiresReview: boolean;
  reviewNotes: string;
  zone: string;
  building: string;
  area: string;
  room: string;
  specificLocation: string;
  headcount: number | null;
  squareMeters: number | null;
  buildingSquareMeters: number | null;
  commonSpace: boolean;
  active: boolean;
  displayName: string;
  activeMap: LocationMapSummary | null;
  assignedUsers: { id: string; name: string; area: string }[];
}
