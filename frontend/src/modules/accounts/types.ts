export const USER_ROLES = [
  "SOLICITANTE",
  "ADMINISTRADOR",
  "TECNICO",
  "SUPERVISOR",
  "ALMACENERO",
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
  mustChangePassword?: boolean;
  active: boolean;
}
