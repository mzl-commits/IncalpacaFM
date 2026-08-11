import { api } from "@/services/api";
import type {
  PlantillaCriterio,
  Criterio,
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

export async function createPlantillaCriterio(nombre: string): Promise<PlantillaCriterio> {
  const { data } = await api.post<PlantillaCriterio>("/plantillas-criterios/", { nombre });
  return data;
}

export async function updatePlantillaCriterio(id: number, nombre: string): Promise<PlantillaCriterio> {
  const { data } = await api.patch<PlantillaCriterio>(`/plantillas-criterios/${id}/`, { nombre });
  return data;
}

export async function deletePlantillaCriterio(id: number): Promise<void> {
  await api.delete(`/plantillas-criterios/${id}/`);
}

// Usamos Pick<Criterio, ...> para que los tipos de payload no se desincronicen
// del modelo Criterio (DRY), pero manteniendo "orden" opcional tanto en
// creación (puede autoasignarse) como en actualización (PATCH parcial).
export async function createCriterio(
  payload: Pick<Criterio, "plantilla" | "texto"> & Partial<Pick<Criterio, "orden">>,
): Promise<Criterio> {
  const { data } = await api.post<Criterio>("/criterios/", payload);
  return data;
}

export async function updateCriterio(
  id: number,
  payload: Partial<Pick<Criterio, "texto" | "orden">>,
): Promise<Criterio> {
  const { data } = await api.patch<Criterio>(`/criterios/${id}/`, payload);
  return data;
}

export async function deleteCriterio(id: number): Promise<void> {
  await api.delete(`/criterios/${id}/`);
}

export async function reordenarCriterios(items: Array<{ id: number; orden: number }>): Promise<void> {
  await api.post("/criterios/reordenar/", items);
}
// ─── Inspecciones ─────────────────────────────────────────────────────────────

export interface InspeccionesParams {
  q?: string;
  material?: number;
  pieza?: number;
  tipo?: TipoInspeccion;
  resultado?: ResultadoInspeccion;
}

export async function listInspecciones(
  almacenId: number,
  params: InspeccionesParams = {},
): Promise<Inspeccion[]> {
  const { data } = await api.get<Inspeccion[]>("/inspecciones/", {
    params: { ...params, almacen: almacenId },
  });
  return data;
}

export async function getInspeccion(id: number): Promise<Inspeccion> {
  const { data } = await api.get<Inspeccion>(`/inspecciones/${id}/`);
  return data;
}

export async function listVencidas(almacenId: number): Promise<VencidaItem[]> {
  const { data } = await api.get<VencidaItem[]>("/inspecciones/vencidas/", {
    params: { almacen: almacenId },
  });
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