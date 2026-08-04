import axios from "axios";
import { api } from "@/services/api";
import { offlineDb } from "@/offline/db";
import type {
  TaxonomyFilters,
  TaxonomyInput,
  TaxonomyOption,
  TaxonomyOptionsResult,
  TaxonomyRecord,
  TaxonomyReviewStatus,
} from "./types";

type TaxonomyApiRecord = {
  id: string;
  prefix: string;
  name: string;
  asset_type: string;
  category: string;
  subcategory: string;
  specialty: string;
  sequence_digits: number;
  default_criticality: TaxonomyOption["defaultCriticality"];
  useful_life_years: number | null;
  preventive_frequency_months: number | null;
  requires_maintenance: boolean;
  requires_certification: boolean;
  issuance_enabled: boolean;
  review_status: TaxonomyReviewStatus;
  aliases: string[];
  canonical_prefix: string;
  source_version: string;
  notes: string;
  active: boolean;
  asset_count?: number;
  last_sequence?: number;
  next_code_preview?: string | null;
  updated_at?: string;
};

type PaginatedResponse<T> = {
  results: T[];
};

const prefixCollator = new Intl.Collator("es-PE", {
  numeric: true,
  sensitivity: "base",
});

function sortByPrefix<T extends Pick<TaxonomyOption, "prefix" | "name">>(items: T[]) {
  return [...items].sort(
    (left, right) =>
      prefixCollator.compare(left.prefix, right.prefix) ||
      left.name.localeCompare(right.name, "es-PE"),
  );
}

function mapTaxonomy(item: TaxonomyApiRecord): TaxonomyRecord {
  return {
    id: item.id,
    prefix: item.prefix,
    name: item.name || item.subcategory,
    assetType: item.asset_type,
    category: item.category,
    subcategory: item.subcategory,
    specialty: item.specialty,
    sequenceDigits: item.sequence_digits,
    defaultCriticality: item.default_criticality,
    usefulLifeYears: item.useful_life_years,
    preventiveFrequencyMonths: item.preventive_frequency_months,
    requiresMaintenance: item.requires_maintenance,
    requiresCertification: item.requires_certification,
    issuanceEnabled: item.issuance_enabled,
    reviewStatus: item.review_status,
    aliases: item.aliases ?? [],
    canonicalPrefix: item.canonical_prefix ?? "",
    sourceVersion: item.source_version ?? "",
    notes: item.notes ?? "",
    active: item.active,
    assetCount: item.asset_count ?? 0,
    lastSequence: item.last_sequence ?? 0,
    nextCodePreview: item.next_code_preview ?? null,
    updatedAt: item.updated_at ?? "",
  };
}

function asList<T>(data: T[] | PaginatedResponse<T>) {
  return Array.isArray(data) ? data : data.results;
}

function toApiPayload(input: TaxonomyInput) {
  return {
    prefix: input.prefix.trim().toUpperCase(),
    name: input.name.trim(),
    asset_type: input.assetType.trim(),
    category: input.category.trim(),
    subcategory: input.subcategory.trim(),
    specialty: input.specialty.trim(),
    sequence_digits: input.sequenceDigits,
    default_criticality: input.defaultCriticality,
    useful_life_years: input.usefulLifeYears,
    preventive_frequency_months: input.preventiveFrequencyMonths,
    requires_maintenance: input.requiresMaintenance,
    requires_certification: input.requiresCertification,
    issuance_enabled: input.issuanceEnabled,
    review_status: input.reviewStatus,
    aliases: input.aliases,
    notes: input.notes.trim(),
    active: input.active,
  };
}

export async function listTaxonomies(filters: TaxonomyFilters = {}): Promise<TaxonomyRecord[]> {
  const { data } = await api.get<TaxonomyApiRecord[] | PaginatedResponse<TaxonomyApiRecord>>(
    "/taxonomies/",
    {
      params: {
        search: filters.q || undefined,
        active: filters.active || undefined,
        review_status: filters.reviewStatus || undefined,
        asset_type: filters.assetType || undefined,
        category: filters.category || undefined,
        specialty: filters.specialty || undefined,
        requires_maintenance: filters.requiresMaintenance || undefined,
        issuance_enabled: filters.issuanceEnabled || undefined,
        ordering: "prefix",
      },
    },
  );
  return sortByPrefix(asList(data).map(mapTaxonomy));
}

export async function getTaxonomy(id: string): Promise<TaxonomyRecord> {
  const { data } = await api.get<TaxonomyApiRecord>(`/taxonomies/${id}/`);
  return mapTaxonomy(data);
}

export async function createTaxonomy(input: TaxonomyInput): Promise<TaxonomyRecord> {
  const { data } = await api.post<TaxonomyApiRecord>("/taxonomies/", toApiPayload(input));
  return mapTaxonomy(data);
}

export async function updateTaxonomy(id: string, input: TaxonomyInput): Promise<TaxonomyRecord> {
  const { data } = await api.patch<TaxonomyApiRecord>(`/taxonomies/${id}/`, toApiPayload(input));
  return mapTaxonomy(data);
}

export async function activateTaxonomy(id: string): Promise<TaxonomyRecord> {
  const { data } = await api.post<TaxonomyApiRecord>(`/taxonomies/${id}/activate/`);
  return mapTaxonomy(data);
}

export async function deactivateTaxonomy(id: string): Promise<TaxonomyRecord> {
  const { data } = await api.post<TaxonomyApiRecord>(`/taxonomies/${id}/deactivate/`);
  return mapTaxonomy(data);
}

async function cacheTaxonomyOptions(items: TaxonomyOption[]) {
  const cachedAt = new Date().toISOString();
  await offlineDb.transaction("rw", offlineDb.taxonomyOptions, async () => {
    await offlineDb.taxonomyOptions.clear();
    await offlineDb.taxonomyOptions.bulkPut(
      items.map((item) => ({
        id: item.id,
        prefix: item.prefix,
        active: item.active,
        payload: item,
        updatedAt: cachedAt,
      })),
    );
  });
}

async function readCachedTaxonomyOptions(): Promise<TaxonomyOptionsResult | null> {
  const cached = await offlineDb.taxonomyOptions.toArray();
  const eligible = cached.filter(
    (item) =>
      item.payload.active &&
      item.payload.issuanceEnabled &&
      item.payload.reviewStatus === "VALIDATED",
  );
  if (!eligible.length) return null;
  return {
    items: sortByPrefix(eligible.map((item) => item.payload)),
    source: "cache",
    cachedAt: eligible.reduce(
      (latest, item) => (item.updatedAt > latest ? item.updatedAt : latest),
      eligible[0].updatedAt,
    ),
  };
}

export async function loadActiveTaxonomyOptions(): Promise<TaxonomyOptionsResult> {
  try {
    const items = await listTaxonomies({
      active: "true",
      issuanceEnabled: "true",
      reviewStatus: "VALIDATED",
    });
    const eligible = items.filter(
      (item) => item.issuanceEnabled && item.reviewStatus === "VALIDATED",
    );
    await cacheTaxonomyOptions(eligible);
    return { items: eligible, source: "server" };
  } catch (error) {
    if (axios.isAxiosError(error) && error.response && error.response.status < 500) {
      throw error;
    }
    const cached = await readCachedTaxonomyOptions();
    if (cached) return cached;
    throw error;
  }
}
