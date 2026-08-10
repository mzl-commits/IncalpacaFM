import { api } from "@/services/api";

export type AssetDetailRecord = {
  id: string; code: string; fm_code: string | null; display_code?: string; public_token: string; public_url: string; entry_type_label: string;
  name: string; description: string; brand: string; model: string; serial_number: string | null; photo_url: string | null;
  condition: string; criticality: string; administrative_status: string; operational_status: string;
  assignment_status: string; registered_by_name: string; created_at: string;
  taxonomy_detail: { id?: string; prefix?: string; name?: string; asset_type: string; category: string; subcategory: string; specialty: string } | null;
  location_detail: { zone: string; building: string; area: string; room: string; specific_location: string } | null;
  responsible_history: Array<{
    id: string; responsible: string; type: string; area: string; start_date: string;
    end_date: string | null; status: string; reason: string;
  }>;
  repair_history: Array<{
    id: string; work_order: string; type: string; status: string; reported_at: string;
    completed_at: string | null; issue: string; work_performed: string;
    technician_name: string; provider: string; cost: string; resulting_condition: string;
  }>;
};

export async function getAssetDetail(id: string) {
  const { data } = await api.get<AssetDetailRecord>(`/assets/${id}/`);
  return data;
}

export type AssetDetailUpdate = Pick<
  AssetDetailRecord,
  "name" | "description" | "brand" | "model" | "condition" | "criticality"
> & {
  serial_number: string;
};

export async function updateAssetDetail(id: string, input: AssetDetailUpdate) {
  const { data } = await api.patch<AssetDetailRecord>(`/assets/${id}/`, input);
  return data;
}

export async function classifyAsset(id: string, taxonomyId: string) {
  const { data } = await api.post<AssetDetailRecord>(`/assets/${id}/classify/`, {
    taxonomy_id: taxonomyId,
  });
  return data;
}
