import { api } from "@/services/api";
import type {
  ProgramacionInspeccion,
  PlanInspeccionAnual,
} from "./types";

// ─── Programaciones de inspección ─────────────────────────────────────────────

export interface ProgramacionesParams {
  subcategoria?: number;
  categoria?: number;
  desde?: string; // "YYYY-MM-DD"
  hasta?: string; // "YYYY-MM-DD"
  almacen?: number; // requerido en la práctica para Administrador; el backend
                     // lo ignora si el usuario tiene almacén forzado (Almacenero/Inspector)
}

export async function listProgramaciones(
  params: ProgramacionesParams = {},
): Promise<ProgramacionInspeccion[]> {
  const { data } = await api.get<ProgramacionInspeccion[]>("/programaciones-inspeccion/", { params });
  return data;
}

export async function getProgramacion(id: number): Promise<ProgramacionInspeccion> {
  const { data } = await api.get<ProgramacionInspeccion>(`/programaciones-inspeccion/${id}/`);
  return data;
}

// ─── Plan anual ────────────────────────────────────────────────────────────────

export interface PlanesAnualesParams {
  almacen?: number;
}

export async function listPlanesAnuales(
  params: PlanesAnualesParams = {},
): Promise<PlanInspeccionAnual[]> {
  const { data } = await api.get<PlanInspeccionAnual[]>("/plan-anual/", { params });
  return data;
}

export async function getPlanAnual(id: number): Promise<PlanInspeccionAnual> {
  const { data } = await api.get<PlanInspeccionAnual>(`/plan-anual/${id}/`);
  return data;
}

export interface GenerarPlanPayload {
  anio: number;
  forzar?: boolean;
  almacen?: number; // obligatorio si el usuario logueado es Administrador (sin almacén forzado);
                     // el backend lo ignora y usa el propio si el usuario tiene almacén asignado
}

export interface GenerarPlanRespuesta {
  plan: PlanInspeccionAnual;
  programaciones_creadas: number;
}

/** Lanza error de Axios (con response.data.detail) si el año ya tiene programaciones y no se envía forzar:true. */
export async function generarPlanAnual(
  payload: GenerarPlanPayload,
): Promise<GenerarPlanRespuesta> {
  const { data } = await api.post<GenerarPlanRespuesta>("/plan-anual/generar/", payload);
  return data;
}