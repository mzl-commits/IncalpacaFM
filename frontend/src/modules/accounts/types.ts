export const USER_ROLES = [
  "SOLICITANTE",
  "ADMINISTRADOR",
  "OPERARIO",
  "SUPERVISOR",
  "INSPECTOR",
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface SystemUser {
  id: string;
  fullName: string;
  email: string;
  role: UserRole;
  specialtyId?: string;
  active: boolean;
}