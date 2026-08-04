import { api } from "@/services/api";
import type {
  FacilityPlan,
  FacilityPlanAsset,
  FacilityPlanMarker,
  FacilityPlanMarkerStatus,
  FacilityPlanSummary,
  FacilityPlanTaxonomy,
} from "./facilityPlanTypes";

type ApiTaxonomy = {
  id: string;
  prefix: string;
  name: string;
  asset_type?: string;
  category?: string;
  subcategory?: string;
};

type ApiAsset = {
  id: string;
  code?: string;
  technical_code?: string;
  fm_code?: string | null;
  display_code?: string;
  name: string;
};

type ApiMarker = {
  id: string;
  source_index: number;
  raw_code: string;
  label?: string;
  layer: string;
  source_x?: string | number;
  source_y?: string | number;
  normalized_x?: string | number;
  normalized_y?: string | number;
  source?: { x?: string | number; y?: string | number };
  normalized?: { x?: string | number; y?: string | number };
  status: FacilityPlanMarkerStatus;
  taxonomy?: ApiTaxonomy | null;
  taxonomy_detail?: ApiTaxonomy | null;
  asset?: ApiAsset | null;
  asset_detail?: ApiAsset | null;
};

type ApiSummary = Partial<{
  total: number;
  total_count: number;
  matched: number;
  matched_count: number;
  taxonomy_only: number;
  taxonomy_only_count: number;
  placeholders: number;
  placeholder: number;
  placeholder_count: number;
  unknown: number;
  unknown_count: number;
}>;

type ApiPlan = {
  id: string;
  code: string;
  name: string;
  version: string;
  level_name?: string;
  source_filename?: string;
  source_sha256?: string;
  image_url?: string;
  image?: string;
  active: boolean;
  min_x?: string | number;
  min_y?: string | number;
  max_x?: string | number;
  max_y?: string | number;
  bounds?: Partial<Record<"min_x" | "min_y" | "max_x" | "max_y", string | number>>;
  summary?: ApiSummary;
  marker_count?: number;
  matched_count?: number;
  taxonomy_only_count?: number;
  placeholder_count?: number;
  unknown_count?: number;
  markers?: ApiMarker[];
  updated_at?: string;
};

type PaginatedResponse<T> = { results: T[] };

function number(value: string | number | undefined, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function mapTaxonomy(item: ApiTaxonomy | null | undefined): FacilityPlanTaxonomy | null {
  if (!item) return null;
  return {
    id: item.id,
    prefix: item.prefix,
    name: item.name,
    assetType: item.asset_type ?? "",
    category: item.category ?? "",
    subcategory: item.subcategory ?? "",
  };
}

function mapAsset(item: ApiAsset | null | undefined): FacilityPlanAsset | null {
  if (!item) return null;
  const technicalCode = item.technical_code ?? item.code ?? "";
  return {
    id: item.id,
    technicalCode,
    fmCode: item.fm_code ?? null,
    displayCode: item.display_code ?? item.fm_code ?? technicalCode,
    name: item.name,
  };
}

function mapMarker(item: ApiMarker): FacilityPlanMarker {
  return {
    id: item.id,
    sourceIndex: item.source_index,
    rawCode: item.raw_code,
    label: item.label ?? item.raw_code,
    layer: item.layer,
    sourceX: number(item.source_x ?? item.source?.x),
    sourceY: number(item.source_y ?? item.source?.y),
    normalizedX: number(item.normalized_x ?? item.normalized?.x),
    normalizedY: number(item.normalized_y ?? item.normalized?.y),
    status: item.status,
    taxonomy: mapTaxonomy(item.taxonomy ?? item.taxonomy_detail),
    asset: mapAsset(item.asset ?? item.asset_detail),
  };
}

function mapSummary(item: ApiPlan, markers: FacilityPlanMarker[]): FacilityPlanSummary {
  const summary = item.summary ?? {};
  const count = (status: FacilityPlanMarkerStatus) =>
    markers.filter((marker) => marker.status === status).length;
  return {
    total: summary.total ?? summary.total_count ?? item.marker_count ?? markers.length,
    matched: summary.matched ?? summary.matched_count ?? item.matched_count ?? count("MATCHED"),
    taxonomyOnly:
      summary.taxonomy_only ??
      summary.taxonomy_only_count ??
      item.taxonomy_only_count ??
      count("TAXONOMY_ONLY"),
    placeholders:
      summary.placeholders ??
      summary.placeholder ??
      summary.placeholder_count ??
      item.placeholder_count ??
      count("PLACEHOLDER"),
    unknown: summary.unknown ?? summary.unknown_count ?? item.unknown_count ?? count("UNKNOWN"),
  };
}

function mapPlan(item: ApiPlan): FacilityPlan {
  const markers = (item.markers ?? []).map(mapMarker);
  const bounds = item.bounds ?? {};
  return {
    id: item.id,
    code: item.code,
    name: item.name,
    version: item.version,
    levelName: item.level_name ?? "",
    sourceFilename: item.source_filename ?? "",
    sourceSha256: item.source_sha256 ?? "",
    imageUrl: item.image_url ?? item.image ?? "",
    active: item.active,
    bounds: {
      minX: number(bounds.min_x ?? item.min_x),
      minY: number(bounds.min_y ?? item.min_y),
      maxX: number(bounds.max_x ?? item.max_x),
      maxY: number(bounds.max_y ?? item.max_y),
    },
    summary: mapSummary(item, markers),
    markers,
    updatedAt: item.updated_at ?? "",
  };
}

export async function listFacilityPlans(): Promise<FacilityPlan[]> {
  const { data } = await api.get<ApiPlan[] | PaginatedResponse<ApiPlan>>("/facility-plans/");
  return (Array.isArray(data) ? data : data.results).map(mapPlan);
}

export async function getFacilityPlan(id: string): Promise<FacilityPlan> {
  const { data } = await api.get<ApiPlan>(`/facility-plans/${id}/`);
  return mapPlan(data);
}

export async function getFacilityPlanImage(id: string): Promise<string> {
  const { data } = await api.get<Blob>(`/facility-plans/${id}/image/`, {
    responseType: "blob",
  });
  return URL.createObjectURL(data);
}

export async function reconcileFacilityPlan(id: string): Promise<FacilityPlan> {
  await api.post(`/facility-plans/${id}/reconcile/`);
  return getFacilityPlan(id);
}
