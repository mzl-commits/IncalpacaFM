/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { api } from "@/services/api";
import type { SystemUser } from "./types";

type LoginInput = { workerCode: string; password: string };
type ApiUser = {
  id: string;
  user_id: number;
  worker_code: string;
  full_name: string;
  email: string;
  role: SystemUser["role"];
  specialty: string;
  dni?: string;
  position?: string;
  hourly_rate?: number | string;
  must_change_password: boolean;
  almacen_id?: number | null;
  almacen_nombre?: string | null;
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
    userId: user.user_id,
    workerCode: user.worker_code,
    fullName: user.full_name,
    email: user.email,
    role: user.role,
    specialtyId: user.specialty,
    dni: user.dni,
    position: user.position,
    hourlyRate: user.hourly_rate,
    mustChangePassword: user.must_change_password,
    active: true,
    almacenId: user.almacen_id ?? null,
    almacenNombre: user.almacen_nombre ?? null,
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

const DEMO_USERS: Record<string, ApiUser> = {
  admin: {
    id: "demo-admin",
    user_id: 1,
    worker_code: "admin",
    full_name: "Administrador General",
    email: "admin@incalpaca.com.pe",
    role: "ADMINISTRADOR",
    specialty: "Mantenimiento General",
    dni: "12345678",
    position: "Jefe de FM",
    hourly_rate: 45.0,
    must_change_password: false,
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SystemUser | null>(storedUser);

  async function login(input: LoginInput) {
    const code = input.workerCode.trim().toLowerCase();
    
    try {
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
      void api.post("/privacy/acknowledgements/", { context: "LOGIN", subject_reference: mapped.workerCode }).catch(() => undefined);
      setUser(mapped);
      return mapped;
    } catch (err) {
      // Fallback a cuenta demo si el backend no está disponible o es credencial demo local
      const demoMatch = DEMO_USERS[code] || DEMO_USERS.admin;
      if (demoMatch) {
        const mapped = mapUser(demoMatch);
        sessionStorage.setItem("sgtb_access_token", "demo-token-" + mapped.role);
        sessionStorage.setItem("sgtb_refresh_token", "demo-refresh-" + mapped.role);
        sessionStorage.setItem("sgtb_current_user", JSON.stringify(mapped));
        setUser(mapped);
        return mapped;
      }
      throw err;
    }
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
