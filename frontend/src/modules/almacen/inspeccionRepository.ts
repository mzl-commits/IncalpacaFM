import { api } from "@/services/api";
import type {
  PlantillaCriterio,
  Inspeccion,
  VencidaItem,
  TipoInspeccion,
  ResultadoInspeccion,
  ValorRespuesta,
  AccionInspeccion,
  UsuarioLista,
} from "./types";

// ─── Usuarios (para selects de responsable/inspector) ─────────────────────────

export async function listUsuarios(): Promise<UsuarioLista[]> {
  const { data } = await api.get<UsuarioLista[]>("/users/");
  return data;
}

// ─── Plantillas de criterios ──────────────────────────────────────────────────

export async function listPlantillasCriterios(): Promise<PlantillaCriterio[]> {
  const { data } = await api.get<PlantillaCriterio[]>("/plantillas-criterios/");
  return data;
}

export async function getPlantillaCriterio(id: number): Promise<PlantillaCriterio> {
  const { data } = await api.get<PlantillaCriterio>(`/plantillas-criterios/${id}/`);
  return data;
}

// ─── Inspecciones ─────────────────────────────────────────────────────────────

export interface InspeccionesParams {
  material?: number;
  pieza?: number;
  tipo?: TipoInspeccion;
  resultado?: ResultadoInspeccion;
}

export async function listInspecciones(
  params: InspeccionesParams = {},
): Promise<Inspeccion[]> {
  const { data } = await api.get<Inspeccion[]>("/inspecciones/", { params });
  return data;
}

export async function getInspeccion(id: number): Promise<Inspeccion> {
  const { data } = await api.get<Inspeccion>(`/inspecciones/${id}/`);
  return data;
}

export async function listVencidas(): Promise<VencidaItem[]> {
  const { data } = await api.get<VencidaItem[]>("/inspecciones/vencidas/");
  return data;
}

// ─── Payload de creación de inspección ───────────────────────────────────────

export interface RespuestaInput {
  criterio_id: number;
  valor: ValorRespuesta;
  observacion?: string;
}

export interface InspeccionCreatePayload {
  tipo: TipoInspeccion;
  material: number;
  pieza?: number | null;
  piezas_lote?: number[];
  plantilla: number;
  inspector: number;
  proxima_inspeccion?: string | null;
  cantidad_inspeccionada?: number | null;
  cantidad_apta?: number | null;
  cantidad_no_apta?: number | null;
  resultado_general: ResultadoInspeccion;
  accion_tomada: AccionInspeccion;
  observaciones?: string;
  respuestas: RespuestaInput[];
}

export async function createInspeccion(
  payload: InspeccionCreatePayload,
): Promise<Inspeccion> {
  const { data } = await api.post<Inspeccion>("/inspecciones/", payload);
  return data;
}

// ─── Exportación ─────────────────────────────────────────────────────────────

/** Abre el Excel en nueva pestaña. Usa window.open para evitar manejo de blobs. */
export function exportarExcel(id: number): void {
  const base = import.meta.env.VITE_API_URL ?? "/api/v1";
  window.open(`${base}/inspecciones/${id}/exportar-excel/`, "_blank");
}

/** Abre el PDF en nueva pestaña. */
export function exportarPdf(id: number): void {
  const base = import.meta.env.VITE_API_URL ?? "/api/v1";
  window.open(`${base}/inspecciones/${id}/exportar-pdf/`, "_blank");
}
