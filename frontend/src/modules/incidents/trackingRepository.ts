import { api } from "@/services/api";
import type { RequestTracking } from "./trackingModel";

export async function getTrackingByIncidentId(token: string): Promise<RequestTracking> {
  const cleanToken = token.trim();
  const { data } = await api.get<RequestTracking>(
    `/incidents/public/tracking/${encodeURIComponent(cleanToken)}/`,
  );
  return data;
}
export async function submitPublicConformity(
  token: string,
  input: { accepted: boolean; rating?: number; comment: string },
): Promise<RequestTracking> {
  const cleanToken = token.trim();
  const { data } = await api.post<RequestTracking>(
    `/incidents/public/tracking/${encodeURIComponent(cleanToken)}/conformity/`,
    input,
  );
  return data;
}
