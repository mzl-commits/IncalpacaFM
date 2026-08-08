import { api } from "@/services/api";
import type {
  Categoria,
  Subcategoria,
  Material,
  MaterialDetalle,
  MaterialCreatePayload,
  PiezaBase,
  AltaPiezasSueltasPayload,
  AltaEstuchePayload,
} from "./types";

// ─── Categorías ───────────────────────────────────────────────────────────────

export async function listCategorias(): Promise<Categoria[]> {
  const { data } = await api.get<Categoria[]>("/categorias/");
  return data;
}

export async function createCategoria(
  payload: Omit<Categoria, "id">,
): Promise<Categoria> {
  const { data } = await api.post<Categoria>("/categorias/", payload);
  return data;
}

export async function updateCategoria(
  id: number,
  payload: Partial<Omit<Categoria, "id">>,
): Promise<Categoria> {
  const { data } = await api.patch<Categoria>(`/categorias/${id}/`, payload);
  return data;
}

export async function deleteCategoria(id: number): Promise<void> {
  await api.delete(`/categorias/${id}/`);
}

// ─── Subcategorías ────────────────────────────────────────────────────────────

export async function listSubcategorias(categoriaId?: number): Promise<Subcategoria[]> {
  const params = categoriaId ? { categoria: categoriaId } : {};
  const { data } = await api.get<Subcategoria[]>("/subcategorias/", { params });
  return data;
}

export async function createSubcategoria(
  payload: Omit<Subcategoria, "id" | "categoria_nombre" | "plantilla_inspeccion_nombre">,
): Promise<Subcategoria> {
  const { data } = await api.post<Subcategoria>("/subcategorias/", payload);
  return data;
}

export async function updateSubcategoria(
  id: number,
  payload: Partial<Omit<Subcategoria, "id" | "categoria_nombre" | "plantilla_inspeccion_nombre">>,
): Promise<Subcategoria> {
  const { data } = await api.patch<Subcategoria>(`/subcategorias/${id}/`, payload);
  return data;
}

export async function deleteSubcategoria(id: number): Promise<void> {
  await api.delete(`/subcategorias/${id}/`);
}

// ─── Materiales ───────────────────────────────────────────────────────────────

export interface MaterialesParams {
  categoria?: number;
  subcategoria?: number;
  control_individual?: boolean;
  inspeccionable?: boolean;
  q?: string;
}

export async function listMateriales(params: MaterialesParams = {}): Promise<Material[]> {
  const query: Record<string, string | number | boolean> = {};
  if (params.categoria) query.categoria = params.categoria;
  if (params.subcategoria) query.subcategoria = params.subcategoria;
  if (params.control_individual !== undefined)
    query.control_individual = params.control_individual;
  if (params.inspeccionable !== undefined) query.inspeccionable = params.inspeccionable;
  if (params.q) query.q = params.q;

  const { data } = await api.get<Material[]>("/materiales/", { params: query });
  return data;
}

export async function getMaterialDetalle(id: number): Promise<MaterialDetalle> {
  const { data } = await api.get<MaterialDetalle>(`/materiales/${id}/`);
  return data;
}

export async function createMaterial(
  payload: MaterialCreatePayload,
  foto?: File | null,
): Promise<Material> {
  if (foto) {
    // multipart/form-data cuando hay foto
    const form = new FormData();
    Object.entries(payload).forEach(([k, v]) => {
      if (v !== null && v !== undefined) form.append(k, String(v));
    });
    form.append("foto", foto);
    const { data } = await api.post<Material>("/materiales/", form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  }
  const { data } = await api.post<Material>("/materiales/", payload);
  return data;
}

export async function updateMaterial(
  id: number,
  payload: Partial<MaterialCreatePayload>,
  foto?: File | null,
): Promise<Material> {
  if (foto) {
    const form = new FormData();
    Object.entries(payload).forEach(([k, v]) => {
      if (v !== null && v !== undefined) form.append(k, String(v));
    });
    form.append("foto", foto);
    const { data } = await api.patch<Material>(`/materiales/${id}/`, form, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return data;
  }
  const { data } = await api.patch<Material>(`/materiales/${id}/`, payload);
  return data;
}

// ─── Alta de piezas ───────────────────────────────────────────────────────────

export async function altaPiezasSueltas(payload: AltaPiezasSueltasPayload): Promise<PiezaBase[]> {
  const { data } = await api.post<PiezaBase[]>("/materiales/alta-piezas-sueltas/", payload);
  return data;
}

export async function altaEstuche(payload: AltaEstuchePayload): Promise<PiezaBase[]> {
  const { data } = await api.post<PiezaBase[]>("/materiales/alta-estuche/", payload);
  return data;
}

// ─── Piezas ───────────────────────────────────────────────────────────────────

export interface PiezasParams {
  material?: number;
  estado?: string;
  sin_padre?: boolean;
  /** Filtrar hijas de un estuche específico (ID de la pieza padre) */
  padre?: number;
  /** Búsqueda por código de pieza o nombre/código de material */
  q?: string;
}

export async function listPiezas(params: PiezasParams = {}): Promise<PiezaBase[]> {
  const query: Record<string, string | number | boolean> = {};
  if (params.material) query.material = params.material;
  if (params.estado) query.estado = params.estado;
  if (params.sin_padre !== undefined) query.sin_padre = params.sin_padre;
  if (params.padre !== undefined) query.padre = params.padre;
  if (params.q) query.q = params.q;   // <-- nuevo
  const { data } = await api.get<PiezaBase[]>("/piezas/", { params: query });
  return data;
}

// ─── Ajuste de stock (materiales sin control individual) ──────────────────────

export interface AjustarStockPayload {
  material_id: number;
  cantidad: number;
}

export async function ajustarStock(payload: AjustarStockPayload): Promise<Material> {
  const { data } = await api.post<Material>("/materiales/ajustar-stock/", payload);
  return data;
}

// ─── Reemplazar pieza hija rota con una suelta disponible ─────────────────────

export interface ReemplazarHijaPayload {
  pieza_suelta_id: number;
}

/**
 * Reemplaza una pieza hija rota/en mantenimiento dentro de un estuche
 * con una pieza suelta disponible del mismo material.
 * @param hijaId  ID de la pieza hija a reemplazar (debe tener padre y estado Baja/Mantenimiento)
 * @param payload { pieza_suelta_id } ID de la pieza suelta que tomará su lugar
 */
export async function reemplazarHija(
  hijaId: number,
  payload: ReemplazarHijaPayload,
): Promise<import("./types").PiezaBase> {
  const { data } = await api.post<import("./types").PiezaBase>(
    `/piezas/${hijaId}/reemplazar-hija/`,
    payload,
  );
  return data;
}

// ─── Eliminar material ────────────────────────────────────────────────────────

/** Elimina un material del catálogo. El backend protege si tiene piezas activas. */
export async function deleteMaterial(id: number): Promise<void> {
  await api.delete(`/materiales/${id}/`);
}

/**
 * Eliminación forzada: borra el material junto con TODAS sus piezas,
 * movimientos e inspecciones. Irreversible.
 */
export async function deleteMaterialForzado(id: number): Promise<void> {
  await api.delete(`/materiales/${id}/eliminar-forzado/`, {
    data: { confirmar: true },
  });
}


// ─── Alta estuche inline (piezas definidas por nombre+medida, sin catálogo) ───

export interface PiezaHijaInlineSpec {
  nombre: string;
  medida?: string;
  cantidad: number;
}

export interface AltaEstucheInlinePayload {
  material_contenedor_id: number;
  piezas_hijas: PiezaHijaInlineSpec[];
  num_estuches: number;
}

export async function altaEstucheInline(
  payload: AltaEstucheInlinePayload,
): Promise<PiezaBase[]> {
  const { data } = await api.post<PiezaBase[]>(
    "/materiales/alta-estuche-inline/",
    payload,
  );
  return data;
}

// ─── Desvincular pieza hija de su estuche ─────────────────────────────────────

/** Quita una pieza hija de su estuche (padre → null). Pasa a ser pieza suelta. */
export async function desvinculaPieza(piezaId: number): Promise<PiezaBase> {
  const { data } = await api.post<PiezaBase>(`/piezas/${piezaId}/desvincular/`);
  return data;
}

/**
 * Elimina una pieza física.
 * Si es un estuche, el backend elimina también todas sus piezas hijas y sus movimientos.
 */
export async function deletePieza(piezaId: number): Promise<void> {
  await api.delete(`/piezas/${piezaId}/`);
}

// ─── Agregar pieza hija a estuche existente ──────────────────────────────────────────

export interface AgregarHijaInlineInput {
  nombre: string;
  medida?: string;
  cantidad: number;
}

/**
 * Agrega una o más piezas hijas a un estuche ya existente.
 * Si el material hijo no existe en la subcategoría, el backend lo crea automáticamente.
 * @param contenedorId  ID de la pieza contenedora (estuche)
 * @param payload       { nombre, medida?, cantidad }
 */
export async function agregarHijaInline(
  contenedorId: number,
  payload: AgregarHijaInlineInput,
): Promise<PiezaBase[]> {
  const { data } = await api.post<PiezaBase[]>(
    `/piezas/${contenedorId}/agregar-hija-inline/`,
    payload,
  );
  return data;
}