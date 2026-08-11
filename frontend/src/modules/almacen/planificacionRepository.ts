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

export async function listPlanesAnuales(): Promise<PlanInspeccionAnual[]> {
  const { data } = await api.get<PlanInspeccionAnual[]>("/plan-anual/");
  return data;
}

export async function getPlanAnual(id: number): Promise<PlanInspeccionAnual> {
  const { data } = await api.get<PlanInspeccionAnual>(`/plan-anual/${id}/`);
  return data;
}

export interface GenerarPlanPayload {
  anio: number;
  forzar?: boolean;
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