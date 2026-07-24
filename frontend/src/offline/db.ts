import Dexie, { type EntityTable } from "dexie";

export interface OfflineDraft {
  id: string;
  domain: string;
  payload: unknown;
  updatedAt: string;
  syncStatus: "draft" | "pending" | "conflict";
}

export const offlineDb = new Dexie("sgtb-offline") as Dexie & {
  drafts: EntityTable<OfflineDraft, "id">;
};

offlineDb.version(1).stores({
  drafts: "id, domain, updatedAt, syncStatus",
});
