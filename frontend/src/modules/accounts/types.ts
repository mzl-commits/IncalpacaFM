export const USER_ROLES = [
  "SOLICITANTE",
  "ADMINISTRADOR",
  "TECNICO",
  "SUPERVISOR",
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
}
