import type { SystemUser } from "./types";

const fallbackUser: SystemUser = {
  id: "USR-admin",
  userId: 1,
  fullName: "Facility Management",
  email: "facility.management@incalpaca.com",
  role: "ADMINISTRADOR",
  active: true,
};

export function getCurrentUser(): SystemUser {
  const raw = sessionStorage.getItem("sgtb_current_user");
  if (!raw) return fallbackUser;
  try {
    return JSON.parse(raw) as SystemUser;
  } catch {
    return fallbackUser;
  }
}

export const currentUser = new Proxy(fallbackUser, {
  get(_target, property: keyof SystemUser) {
    return getCurrentUser()[property];
  },
});
