export const TAXONOMY_REVIEW_STATUSES = ["VALIDATED", "REVIEW"] as const;
export type TaxonomyReviewStatus = (typeof TAXONOMY_REVIEW_STATUSES)[number];

export type TaxonomyCriticality = "Baja" | "Media" | "Alta" | "Crítica";

export interface TaxonomyOption {
  id: string;
  prefix: string;
  name: string;
  assetType: string;
  category: string;
  subcategory: string;
  specialty: string;
  sequenceDigits: number;
  defaultCriticality: TaxonomyCriticality;
  usefulLifeYears: number | null;
  preventiveFrequencyMonths: number | null;
  requiresMaintenance: boolean;
  requiresCertification: boolean;
  issuanceEnabled: boolean;
  reviewStatus: TaxonomyReviewStatus;
  aliases: string[];
  canonicalPrefix: string;
  sourceVersion: string;
  notes: string;
  active: boolean;
}

export interface TaxonomyRecord extends TaxonomyOption {
  assetCount: number;
  lastSequence: number;
  nextCodePreview: string | null;
  updatedAt: string;
}

export interface TaxonomyInput {
  prefix: string;
  name: string;
  assetType: string;
  category: string;
  subcategory: string;
  specialty: string;
  sequenceDigits: number;
  defaultCriticality: TaxonomyCriticality;
  usefulLifeYears: number | null;
  preventiveFrequencyMonths: number | null;
  requiresMaintenance: boolean;
  requiresCertification: boolean;
  issuanceEnabled: boolean;
  reviewStatus: TaxonomyReviewStatus;
  aliases: string[];
  notes: string;
  active: boolean;
}

export interface TaxonomyFilters {
  q?: string;
  active?: "true" | "false" | "";
  reviewStatus?: TaxonomyReviewStatus | "";
  assetType?: string;
  category?: string;
  specialty?: string;
  requiresMaintenance?: "true" | "false" | "";
  issuanceEnabled?: "true" | "false" | "";
}

export type TaxonomyOptionsResult = {
  items: TaxonomyOption[];
  source: "server" | "cache";
  cachedAt?: string;
};

export interface FmCodeAsset {
  id: string;
  fmCode: string | null;
  technicalCode: string;
  name: string;
  brand: string;
  model: string;
  taxonomyId: string | null;
  taxonomyPrefix: string;
  taxonomyName: string;
  taxonomyCategory: string;
  taxonomySubcategory: string;
  administrativeStatus: string;
  operationalStatus: string;
  assignmentStatus: string;
  createdAt: string;
}

export type FmCodeState = "issued" | "pending";

export interface FmCodeFilters {
  state: FmCodeState;
  search?: string;
  taxonomyId?: string;
  operationalStatus?: string;
  assignmentStatus?: string;
  ordering?:
    "fm_code" | "-fm_code" | "code" | "-code" | "name" | "-name" | "created_at" | "-created_at";
  page?: number;
  pageSize?: number;
}

export interface FmCodePage {
  items: FmCodeAsset[];
  count: number;
  page: number;
  pageSize: number;
  next: string | null;
  previous: string | null;
}

export interface FmCodeSummaryOption {
  value: string;
  label: string;
  count: number;
  prefix?: string;
}

export interface FmCodeSummary {
  issuedCount: number;
  pendingCount: number;
  taxonomyCount: number;
  unassignedCount: number;
  taxonomies: FmCodeSummaryOption[];
  operationalStatuses: FmCodeSummaryOption[];
  assignmentStatuses: FmCodeSummaryOption[];
}

export const taxonomyReviewLabels: Record<TaxonomyReviewStatus, string> = {
  VALIDATED: "Validada",
  REVIEW: "Requiere revisión",
};
