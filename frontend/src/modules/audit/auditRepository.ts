import { api } from "@/services/api";

export type AuditEvent = {
  id: string;
  actor: string | null;
  actor_name: string;
  action: string;
  entity: string;
  entity_id: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip_address: string | null;
  correlation_id: string;
  created_at: string;
};

export async function fetchAuditEvents(filters?: Record<string, string>) {
  const params = new URLSearchParams(filters);
  const { data } = await api.get<AuditEvent[]>(`/audit/events/?${params.toString()}`);
  return data;
}
