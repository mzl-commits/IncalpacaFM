import { api } from "@/services/api";
import type { Movimiento, PiezaPrestada, SalidaEstucheRespuesta } from "./types";

// ─── Consulta ─────────────────────────────────────────────────────────────────

export interface MovimientosParams {
  material?: number;
  pieza?: number;
  tipo?: string;
  lote_id?: string;
  responsable?: number;
}

export async function listMovimientos(params: MovimientosParams = {}): Promise<Movimiento[]> {
  const { data } = await api.get<Movimiento[]>("/movimientos/", { params });
  return data;
}

export async function listChecklistPrestados(opts: {
  salio_hoy?: boolean;
  fecha?: string;
} = {}): Promise<PiezaPrestada[]> {
  const { data } = await api.get<PiezaPrestada[]>("/movimientos/checklist-prestados/", {
    params: opts,
  });
  return data;
}

// ─── Salidas ──────────────────────────────────────────────────────────────────

export interface SalidaMaterialInput {
  material_id: number;
  cantidad: number;
  responsable_id: number;
  referencia_externa?: string;
  observaciones?: string;
}

export async function registrarSalidaMaterial(input: SalidaMaterialInput): Promise<Movimiento> {
  const { data } = await api.post<Movimiento>("/movimientos/salida-material/", input);
  return data;
}

export interface SalidaPiezaInput {
  pieza_id: number;
  responsable_id: number;
  referencia_externa?: string;
  observaciones?: string;
  /** Opcional: IDs de las piezas hijas a incluir en la salida.
   *  Si se omite → todas las hijas disponibles (comportamiento por defecto).
   *  Si se envía [] → solo sale el contenedor, sin hijas.
   *  Si se envía [id1, id2, …] → solo esas hijas específicas. */
  piezas_hijas_ids?: number[];
}

export async function registrarSalidaPieza(
  input: SalidaPiezaInput,
): Promise<SalidaEstucheRespuesta> {
  const { data } = await api.post<SalidaEstucheRespuesta>(
    "/movimientos/salida-pieza/",
    input,
  );
  return data;
}

// ─── Entradas ─────────────────────────────────────────────────────────────────

export interface EntradaMaterialInput {
  material_id: number;
  cantidad: number;
  responsable_id: number;
  observaciones?: string;
}

export async function registrarEntradaMaterial(input: EntradaMaterialInput): Promise<Movimiento> {
  const { data } = await api.post<Movimiento>("/movimientos/entrada-material/", input);
  return data;
}

export interface EntradaPiezaInput {
  pieza_id: number;
  responsable_id: number;
  observaciones?: string;
}

export async function registrarEntradaPieza(input: EntradaPiezaInput): Promise<Movimiento> {
  const { data } = await api.post<Movimiento>("/movimientos/entrada-pieza/", input);
  return data;
}

// ─── Bajas ────────────────────────────────────────────────────────────────────

export interface BajaMaterialInput {
  material_id: number;
  cantidad: number;
  responsable_id: number;
  observaciones?: string;
}

export async function registrarBajaMaterial(input: BajaMaterialInput): Promise<Movimiento> {
  const { data } = await api.post<Movimiento>("/movimientos/baja-material/", input);
  return data;
}

export interface BajaPiezaInput {
  pieza_id: number;
  responsable_id: number;
  observaciones?: string;
}

export async function registrarBajaPieza(input: BajaPiezaInput): Promise<Movimiento> {
  const { data } = await api.post<Movimiento>("/movimientos/baja-pieza/", input);
  return data;
}
