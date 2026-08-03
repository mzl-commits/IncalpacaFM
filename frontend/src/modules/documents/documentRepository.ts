import { api } from "@/services/api";

export type DocumentRecord = {
  id: string;
  source: string;
  sourceLabel: string;
  entityId: string;
  entityCode: string;
  assetCode: string;
  name: string;
  category: string;
  mimeType: string;
  size: number;
  createdAt: string;
  hasContent: boolean;
  integrityHash: string;
  downloadPath: string | null;
};

type DocumentRegistryResponse = {
  count: number;
  results: DocumentRecord[];
  sources: Record<string, string>;
};

export async function fetchDocuments() {
  const { data } = await api.get<DocumentRegistryResponse>("/documents/");
  return data;
}

export async function openDocument(record: DocumentRecord) {
  if (!record.downloadPath) throw new Error("El contenido digital no está disponible.");
  const { data } = await api.get<Blob>(record.downloadPath, { responseType: "blob" });
  const objectUrl = URL.createObjectURL(data);
  window.open(objectUrl, "_blank", "noopener,noreferrer");
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}
