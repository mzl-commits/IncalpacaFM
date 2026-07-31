export type FacilityPlanMarkerStatus =
  | "MATCHED"
  | "TAXONOMY_ONLY"
  | "PLACEHOLDER"
  | "UNKNOWN";

export interface FacilityPlanTaxonomy {
  id: string;
  prefix: string;
  name: string;
  assetType: string;
  category: string;
  subcategory: string;
}

export interface FacilityPlanAsset {
  id: string;
  technicalCode: string;
  fmCode: string | null;
  displayCode: string;
  name: string;
}

export interface FacilityPlanMarker {
  id: string;
  sourceIndex: number;
  rawCode: string;
  label: string;
  layer: string;
  sourceX: number;
  sourceY: number;
  normalizedX: number;
  normalizedY: number;
  status: FacilityPlanMarkerStatus;
  taxonomy: FacilityPlanTaxonomy | null;
  asset: FacilityPlanAsset | null;
}

export interface FacilityPlanSummary {
  total: number;
  matched: number;
  taxonomyOnly: number;
  placeholders: number;
  unknown: number;
}

export interface FacilityPlan {
  id: string;
  code: string;
  name: string;
  version: string;
  levelName: string;
  sourceFilename: string;
  sourceSha256: string;
  imageUrl: string;
  active: boolean;
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  summary: FacilityPlanSummary;
  markers: FacilityPlanMarker[];
  updatedAt: string;
}

export const facilityPlanStatusLabels: Record<FacilityPlanMarkerStatus, string> = {
  MATCHED: "Vinculado al inventario",
  TAXONOMY_ONLY: "Taxonomía reconocida",
  PLACEHOLDER: "Código pendiente",
  UNKNOWN: "Sin resolver",
};
