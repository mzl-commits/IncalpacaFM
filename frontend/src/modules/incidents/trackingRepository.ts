import { api } from "@/services/api";
import type { RequestTracking } from "./trackingModel";

export async function getTrackingByIncidentId(token: string): Promise<RequestTracking> {
  const cleanToken = token.trim();
  const { data } = await api.get<RequestTracking>(
    `/incidents/public/tracking/${encodeURIComponent(cleanToken)}/`,
  );
  return data;
}