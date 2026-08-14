import { api } from "@/services/api";

export interface DashboardAsset {
  id: string;
  code: string;
  fm_code: string | null;
  name: string;
  taxonomy: string | null;
  condition: string;
  operational_status: string;
  repair_status: string | null;
  location: string;
  location_id: string | null;
  photo_url: string | null;
}

export interface UserDashboardData {
  profile: {
    display_name: string;
    area_name: string;
    worker_code: string;
  };
  assigned_assets: DashboardAsset[];
}

export async function fetchUserDashboard(): Promise<UserDashboardData> {
  const { data } = await api.get<UserDashboardData>("/user-dashboard/");
  return data;
}

export async function fetchUserProfile(id: string): Promise<UserDashboardData> {
  // Profile details and its assigned assets are exposed by the assets API;
  // the URL intentionally has no `/assets` prefix because all app routers
  // are mounted directly below `/api/v1/`.
  const { data } = await api.get<UserDashboardData>(`/users/${id}/`);
  return data;
}
