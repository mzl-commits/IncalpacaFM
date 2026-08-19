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
  DocumentoInspeccion,
  TipoDocumentoInspeccion,
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

/**
 * Descarga un archivo protegido por auth.
 * window.open() NO sirve aquí: es una navegación del navegador que no lleva
 * el header Authorization que agrega la instancia `api` (interceptor de axios),
 * así que el backend responde 401. En su lugar, pedimos el archivo como blob
 * con `api` (que sí manda el token) y disparamos la descarga nosotros mismos.
 */
async function descargarArchivo(url: string, nombrePorDefecto: string): Promise<void> {
  const response = await api.get(url, { responseType: "blob" });

  // Si el backend manda el nombre de archivo en el header, lo usamos.
  const disposition = response.headers?.["content-disposition"] as string | undefined;
  const match = disposition?.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? nombrePorDefecto;

  const blobUrl = window.URL.createObjectURL(response.data as Blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}

/** Descarga el Excel de la inspección. */
export function exportarExcel(id: number): Promise<void> {
  return descargarArchivo(`/inspecciones/${id}/exportar-excel/`, `inspeccion-${id}.xlsx`);
}

/** Descarga el PDF de la inspección. */
export function exportarPdf(id: number): Promise<void> {
  return descargarArchivo(`/inspecciones/${id}/exportar-pdf/`, `inspeccion-${id}.pdf`);
}

// ─── Documentos adjuntos por inspección ───────────────────────────────────────

function inferirTipoDocumento(archivo: File): TipoDocumentoInspeccion {
  const ext = archivo.name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "pdf";
  if (ext === "xls" || ext === "xlsx") return "excel";
  if (ext === "doc" || ext === "docx") return "word";
  return "otro";
}

/** Lista los documentos adjuntos de una inspección puntual (no del material). */
export async function listDocumentosInspeccion(inspeccionId: number): Promise<DocumentoInspeccion[]> {
  const { data } = await api.get<DocumentoInspeccion[]>(`/inspecciones/${inspeccionId}/documentos/`);
  return data;
}

/**
 * Sube un documento (PDF/Excel/Word/otro) adjunto a una inspección.
 * El tipo se infiere automáticamente de la extensión del archivo.
 */
export async function subirDocumentoInspeccion(
  inspeccionId: number,
  archivo: File,
  nombre?: string,
): Promise<DocumentoInspeccion> {
  const form = new FormData();
  form.append("inspeccion", String(inspeccionId));
  form.append("archivo", archivo);
  form.append("nombre", nombre?.trim() || archivo.name);
  form.append("tipo", inferirTipoDocumento(archivo));

  const { data } = await api.post<DocumentoInspeccion>("/documentos-inspeccion/", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function deleteDocumentoInspeccion(id: number): Promise<void> {
  await api.delete(`/documentos-inspeccion/${id}/`);
}