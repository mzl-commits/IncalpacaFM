import { api } from "@/services/api";

export type Technician = {
  id: string;
  full_name: string;
  email: string;
  worker_code: string;
  specialty: string;
  active: boolean;
};

export type TechnicianInput = Omit<Technician, "id"> & { temporary_password?: string };

export async function listTechnicians() {
  const { data } = await api.get<Technician[]>("/technicians/");
  return data;
}

export async function createTechnician(input: TechnicianInput) {
  const { data } = await api.post<Technician>("/technicians/", input);
  return data;
}

export async function updateTechnician(id: string, input: Partial<TechnicianInput>) {
  const { data } = await api.patch<Technician>(`/technicians/${id}/`, input);
  return data;
}

export async function notifyTechnician(id: string, input: { template: "REMINDER" | "TRACEABILITY" | "SCHEDULE" | "CUSTOM"; subject?: string; body?: string }) {
  const { data } = await api.post<{ detail: string }>(`/technicians/${id}/notifications/`, input);
  return data;
}
