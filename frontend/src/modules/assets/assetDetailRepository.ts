import { api } from "@/services/api";

export type AssetDetailRecord = {
  id: string; code: string; fm_code: string | null; display_code?: string; public_token: string; public_url: string; entry_type_label: string;
  name: string; description: string; brand: string; model: string; serial_number: string | null; photo_url: string | null;
  condition: string; criticality: string; administrative_status: string; operational_status: string;
  assignment_status: string; registered_by_name: string; created_at: string;
  taxonomy_detail: { id?: string; prefix?: string; name?: string; asset_type: string; category: string; subcategory: string; specialty: string } | null;
  location_detail: { zone: string; building: string; area: string; room: string; specific_location: string } | null;
  responsible_history: Array<{
    id: string; responsible: string; code?: string; type: string; area: string; start_date: string;
    end_date: string | null; status: string; reason: string;
  }>;
  repair_history: Array<{
    id: string; work_order: string; type: string; status: string; reported_at: string;
    completed_at: string | null; issue: string; work_performed: string;
    technician_name: string; provider: string; cost: string; resulting_condition: string;
  }>;
};

const PHOTO_STORAGE_KEY = (id: string) => `asset_photo_${id}`;

export function getLocalPhoto(id: string): string | null {
  try { return localStorage.getItem(PHOTO_STORAGE_KEY(id)); } catch { return null; }
}

export function setLocalPhoto(id: string, url: string | null | undefined) {
  try {
    if (url) localStorage.setItem(PHOTO_STORAGE_KEY(id), url);
    else localStorage.removeItem(PHOTO_STORAGE_KEY(id));
  } catch { /* ignore */ }
}

export async function getAssetDetail(id: string) {
  const { data } = await api.get<AssetDetailRecord>(`/assets/${id}/`);
  // Merge with locally stored photo (local takes precedence when backend hasn't stored it)
  const localPhoto = getLocalPhoto(id);
  return { ...data, photo_url: data.photo_url ?? localPhoto ?? null };
}

export type AssetDetailUpdate = Pick<
  AssetDetailRecord,
  "name" | "description" | "brand" | "model" | "condition" | "criticality"
> & {
  serial_number: string;
  photo_url?: string | null;
};

export async function updateAssetDetail(id: string, input: AssetDetailUpdate) {
  // Always persist photo_url locally so it survives page reloads
  setLocalPhoto(id, input.photo_url);

  try {
    const { data } = await api.patch<AssetDetailRecord>(`/assets/${id}/`, input);
    // Merge backend response with the photo we saved locally
    const localPhoto = getLocalPhoto(id);
    return { ...data, photo_url: data.photo_url ?? localPhoto ?? null };
  } catch {
    const current = await getAssetDetail(id);
    return {
      ...current,
      ...input,
      photo_url: input.photo_url !== undefined ? input.photo_url : current.photo_url,
    };
  }
}

export async function classifyAsset(id: string, taxonomyId: string) {
  const { data } = await api.post<AssetDetailRecord>(`/assets/${id}/classify/`, {
    taxonomy_id: taxonomyId,
  });
  return data;
}

import { generateAssetApaPdf } from "@/modules/assets/utils/assetReportPdf";

export async function printAssetPdf(id: string, action: "print" | "download" = "print", adminName?: string, reportType: string = "completo"): Promise<void> {
  try {
    const response = await api.get(`/assets/${id}/pdf/?type=${reportType}`, { responseType: "blob" });
    const blob = new Blob([response.data], { type: "application/pdf" });
    const blobUrl = URL.createObjectURL(blob);

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.src = blobUrl;

    document.body.appendChild(iframe);

    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      }, 300);
    };
    return;
  } catch {
    // Fallback a generador dinámico de Ficha Técnica Incalpaca FM
  }

  const asset = await getAssetDetail(id);
  await generateAssetApaPdf({ asset, action, adminName });
}
