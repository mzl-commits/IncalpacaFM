import { api } from "@/services/api";

export type AssignmentRecord = {
  id: string;
  asset: { id: string; code: string; name: string; brand: string; model: string; condition: string; assignment_status: string };
  responsible: { id: string; reference: string; type: "PERSONA" | "AREA" | "ESPACIO_COMUN"; name: string; area: string };
  location: { id: string; zone: string; building: string; area: string; room: string; specific_location: string } | null;
  start_date: string;
  end_date: string | null;
  status: "ACTIVA" | "FINALIZADA" | "ANULADA";
  change_reason: string;
  delivery_status: "ASIGNADO" | "ENTREGADO" | "EN_TRASLADO" | "DEVUELTO";
  act: { id: string; code: string; status: string; hash_sha256: string; issued_at: string } | null;
};

export type AssignmentCatalog = {
  responsibles: Array<{ id: string; external_reference: string; type: AssignmentRecord["responsible"]["type"]; display_name: string; area_name: string }>;
  locations: Array<{ id: string; zone: string; building: string; area: string; room: string; specific_location: string }>;
  assets: Array<{ id: string; code: string; name: string; brand: string; model: string; condition: string; assignment_status: string }>;
};

export type DeliveryPayload = {
  asset_id: string;
  responsible_id: string;
  location_id: string;
  assignment_reason: string;
  condition: string;
  accessories: string;
  observations: string;
  checklist: Record<string, boolean>;
  privacy_accepted: boolean;
  evidence: Array<{ category: string; name: string; mime_type: string; size: number; description: string; content_data_url: string }>;
  signatures: Array<{ role: "ENTREGA" | "RECIBE"; method: "DIBUJADA" | "CONFIRMACION" | "ACTA_ESCANEADA"; signer_name: string; signer_role: string; consent: boolean; signature_data_url: string }>;
};

export async function listAssignments() {
  const { data } = await api.get<AssignmentRecord[]>("/assignments/");
  return data;
}

export async function getAssignment(id: string) {
  const { data } = await api.get<AssignmentRecord>(`/assignments/${id}/`);
  return data;
}

export async function getAssignmentCatalog() {
  const { data } = await api.get<AssignmentCatalog>("/assignments/catalog/");
  return data;
}

export async function deliverAsset(payload: DeliveryPayload) {
  const { data } = await api.post<AssignmentRecord>("/assignments/deliver/", payload, {
    headers: { "Idempotency-Key": crypto.randomUUID() },
  });
  return data;
}

export async function registerAssignmentOperation(id: string, payload: {
  type: "REASIGNAR" | "TRASLADAR" | "DEVOLVER";
  reason: string;
  responsible_id?: string;
  location_id?: string;
  condition?: string;
  observations?: string;
}) {
  await api.post(`/assignments/${id}/operation/`, payload);
}
