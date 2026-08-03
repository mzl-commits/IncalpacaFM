import Dexie, { type EntityTable } from "dexie";

export interface OfflineDraft {
  id: string;
  domain: string;
  payload: unknown;
  updatedAt: string;
  syncStatus: "draft" | "pending" | "conflict";
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
  taxonomyOptions: EntityTable<OfflineTaxonomyOption, "id">;
};

offlineDb.version(1).stores({
  drafts: "id, domain, updatedAt, syncStatus",
});

offlineDb.version(2).stores({
  drafts: "id, domain, updatedAt, syncStatus",
  taxonomyOptions: "id, prefix, active, updatedAt",
});
