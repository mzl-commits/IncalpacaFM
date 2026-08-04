/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { api } from "@/services/api";
import type { SystemUser } from "./types";

type LoginInput = { workerCode: string; password: string };
type ApiUser = {
  id: string;
  worker_code: string;
  full_name: string;
  email: string;
  role: SystemUser["role"];
  specialty: string;
  must_change_password: boolean;
};

type AuthContextValue = {
  user: SystemUser | null;
  login: (input: LoginInput) => Promise<SystemUser>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function mapUser(user: ApiUser): SystemUser {
  return {
    id: user.id,
    workerCode: user.worker_code,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    specialtyId: user.specialty,
    mustChangePassword: user.must_change_password,
    active: true,
  };
}

function storedUser() {
  const raw = sessionStorage.getItem("sgtb_current_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SystemUser;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SystemUser | null>(storedUser);

  async function login(input: LoginInput) {
    const { data } = await api.post<{
      access: string;
      refresh: string;
      user: ApiUser;
    }>("/auth/login/", {
      worker_code: input.workerCode,
      password: input.password,
    });
    const mapped = mapUser(data.user);
    sessionStorage.setItem("sgtb_access_token", data.access);
    sessionStorage.setItem("sgtb_refresh_token", data.refresh);
    sessionStorage.setItem("sgtb_current_user", JSON.stringify(mapped));
    // La autenticación no se bloquea si la telemetría de privacidad falla.
    void api.post("/privacy/acknowledgements/", { context: "LOGIN", subject_reference: mapped.workerCode }).catch(() => undefined);
    setUser(mapped);
    return mapped;
  }

  function logout() {
    sessionStorage.removeItem("sgtb_access_token");
    sessionStorage.removeItem("sgtb_refresh_token");
    sessionStorage.removeItem("sgtb_current_user");
    setUser(null);
  }

  const value = useMemo(() => ({ user, login, logout }), [user]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth debe utilizarse dentro de AuthProvider.");
  return value;
}
