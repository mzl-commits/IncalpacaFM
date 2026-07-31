import { mockTracking } from "./data/mockTracking";

export async function getTrackingByIncidentId(id:string) {
  return mockTracking.find(
    (tracking) => tracking.incidentId === id
  );
}