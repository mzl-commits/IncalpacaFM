import { api } from "@/services/api";
import type { UserRole } from "@/modules/accounts/types";

export type Technician = {
  id: string;
  full_name: string;
  email: string;
  worker_code: string;
  dni: string;
  specialty: string;
  position: string;
  hourly_rate: number;
  active: boolean;
  role: UserRole;
  almacen?: number | null;
  almacen_nombre?: string | null;
};

export type TechnicianInput = Omit<Technician, "id" | "almacen_nombre"> & { temporary_password?: string };

export async function listTechnicians() {
  const { data } = await api.get<Technician[]>("/technicians/");
  return data;
}

export async function listManagedUsers() {
  const { data } = await api.get<Technician[]>("/users/manage/");
  return data;
}

export async function createTechnician(input: TechnicianInput) {
  const { data } = await api.post<Technician>("/technicians/", input);
  return data;
}

export async function createManagedUser(input: TechnicianInput) {
  const { data } = await api.post<Technician>("/users/manage/", input);
  return data;
}

export async function updateTechnician(id: string, input: Partial<TechnicianInput>) {
  const { data } = await api.patch<Technician>(`/technicians/${id}/`, input);
  return data;
}

export async function updateManagedUser(id: string, input: Partial<TechnicianInput>) {
  const { data } = await api.patch<Technician>(`/users/manage/${id}/`, input);
  return data;
}

export async function notifyTechnician(id: string, input: { template: "REMINDER" | "TRACEABILITY" | "SCHEDULE" | "CUSTOM"; deliveryChannel: "SISTEMA" | "CORREO"; subject?: string; body?: string }) {
  const { data } = await api.post<{ detail: string }>(`/technicians/${id}/notifications/`, input);
  return data;
}

export async function importTechnicians(file: File) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post<{ created: number; updated: number; errors: { fila: number; detalle: string }[] }>("/technicians/import/", form, { headers: { "Content-Type": "multipart/form-data" } });
  return data;
}
