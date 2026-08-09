import Dexie, { type EntityTable } from "dexie";

export interface OfflineDraft {
  id: string;
  domain: string;
  payload: unknown;
  updatedAt: string;
  syncStatus: "draft" | "pending" | "conflict";
}

export interface OfflineOperation {
  id: string;
  endpoint: string;
  method: "POST" | "PATCH";
  payload: Record<string, unknown>;
  files: { name: string; type: string; blob: Blob }[];
  idempotencyKey: string;
  baseUpdatedAt?: string;
  status: "pending" | "syncing" | "conflict" | "failed";
  createdAt: string;
  error?: string;
}

export interface OfflineTaxonomyOption {
  id: string;
  prefix: string;
  active: boolean;
  payload: import("@/modules/taxonomy/types").TaxonomyOption;
  updatedAt: string;
}

export const offlineDb = new Dexie("sgtb-offline") as Dexie & {
  drafts: EntityTable<OfflineDraft, "id">;
  operations: EntityTable<OfflineOperation, "id">;
  taxonomyOptions: EntityTable<OfflineTaxonomyOption, "id">;
};

offlineDb.version(1).stores({
  drafts: "id, domain, updatedAt, syncStatus",
});

offlineDb.version(2).stores({
  drafts: "id, domain, updatedAt, syncStatus",
  taxonomyOptions: "id, prefix, active, updatedAt",
});

offlineDb.version(3).stores({
  drafts: "id, domain, updatedAt, syncStatus",
  taxonomyOptions: "id, prefix, updatedAt",
  operations: "id, status, createdAt, endpoint",
});
