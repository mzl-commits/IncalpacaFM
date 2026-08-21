export const USER_ROLES = [
  "USUARIO",
  "ADMINISTRADOR",
  "TECNICO",
  "SUPERVISOR",
  "ALMACENERO",
  "INSPECTOR",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface SystemUser {
  id: string;
  userId: number;
  fullName: string;
  email: string;
  role: UserRole;
  workerCode?: string;
  specialtyId?: string;
  dni?: string;
  position?: string;
  hourlyRate?: number | string;
  mustChangePassword?: boolean;
  active: boolean;
  almacenId?: number | null;
  almacenNombre?: string | null;
}