import { api } from "@/services/api";
import type { FmCodeAsset, FmCodeFilters, FmCodePage, FmCodeSummary } from "./types";

type AssetApiRecord = {
  id: string;
  code: string;
  fm_code: string | null;
  name: string;
  brand: string;
  model: string;
  administrative_status: string;
  operational_status: string;
  assignment_status: string;
  created_at: string;
  taxonomy_detail?: {
    id?: string;
    prefix?: string;
    name?: string;
    category?: string;
    subcategory?: string;
  } | null;
};

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type FmCodeSummaryApi = {
  issued_count: number;
  pending_count: number;
  taxonomy_count: number;
  unassigned_count: number;
  taxonomies: Array<{ value: string; label: string; prefix?: string; count: number }>;
  operational_statuses: Array<{ value: string; label: string; count: number }>;
  assignment_statuses: Array<{ value: string; label: string; count: number }>;
};

function mapAsset(item: AssetApiRecord): FmCodeAsset {
  return {
    id: item.id,
    fmCode: item.fm_code,
    technicalCode: item.code,
    name: item.name,
    brand: item.brand,
    model: item.model,
    taxonomyId: item.taxonomy_detail?.id ?? null,
    taxonomyPrefix: item.taxonomy_detail?.prefix ?? "",
    taxonomyName: item.taxonomy_detail?.name ?? "",
    taxonomyCategory: item.taxonomy_detail?.category ?? "",
    taxonomySubcategory: item.taxonomy_detail?.subcategory ?? "",
    administrativeStatus: item.administrative_status,
    operationalStatus: item.operational_status,
    assignmentStatus: item.assignment_status,
    createdAt: item.created_at,
  };
}

export async function listFmCodeAssets(filters: FmCodeFilters): Promise<FmCodePage> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const { data } = await api.get<PaginatedResponse<AssetApiRecord>>("/fm-codes/", {
    params: {
      state: filters.state,
      search: filters.search || undefined,
      taxonomy_id: filters.taxonomyId || undefined,
      operational_status: filters.operationalStatus || undefined,
      assignment_status: filters.assignmentStatus || undefined,
      ordering: filters.ordering || (filters.state === "issued" ? "fm_code" : "code"),
      page,
      page_size: pageSize,
    },
  });
  return {
    items: data.results.map(mapAsset),
    count: data.count,
    page,
    pageSize,
    next: data.next,
    previous: data.previous,
  };
}

export async function getFmCodeSummary(): Promise<FmCodeSummary> {
  const { data } = await api.get<FmCodeSummaryApi>("/fm-codes/summary/");
  return {
    issuedCount: data.issued_count,
    pendingCount: data.pending_count,
    taxonomyCount: data.taxonomy_count,
    unassignedCount: data.unassigned_count,
    taxonomies: data.taxonomies,
    operationalStatuses: data.operational_statuses,
    assignmentStatuses: data.assignment_statuses,
  };
}

export async function issueFmCode(assetId: string, taxonomyId: string): Promise<FmCodeAsset> {
  const { data } = await api.post<AssetApiRecord>(`/assets/${assetId}/classify/`, {
    taxonomy_id: taxonomyId,
  });
  return mapAsset(data);
}
