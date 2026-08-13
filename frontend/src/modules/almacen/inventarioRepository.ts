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

export async function listMovimientos(
  almacenId: number,
  params: MovimientosParams = {},
): Promise<Movimiento[]> {
  const { data } = await api.get<Movimiento[]>("/movimientos/", {
    params: { ...params, almacen: almacenId },
  });
  return data;
}

export async function listChecklistPrestados(
  almacenId: number,
  opts: { salio_hoy?: boolean; fecha?: string } = {},
): Promise<PiezaPrestada[]> {
  const { data } = await api.get<PiezaPrestada[]>("/movimientos/checklist-prestados/", {
    params: { ...opts, almacen: almacenId },
  });
  return data;
}

// ─── Salidas ──────────────────────────────────────────────────────────────────

export interface SalidaMaterialInput {
  material_id: number;
  /** En unidades. Opcional si se envía cantidad_cajas o unidad_movimiento_id (el backend la recalcula). */
  cantidad?: number;
  /** Si el material se maneja por caja: número de cajas. El backend calcula el total en unidades. */
  cantidad_cajas?: number;
  /** Si el material es tipo Rollo (permite_conversion_unidad): unidad elegida (id de UnidadMedidaCatalogo). */
  unidad_movimiento_id?: number;
  /** Cantidad en la unidad elegida (ej. metros); el backend la convierte a la unidad base del material. */
  cantidad_en_unidad_movimiento?: number;
  responsable_id: number;
  referencia_externa?: string;
  observaciones?: string;
  lote_id?: string;
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
  /** En unidades. Opcional si se envía cantidad_cajas o unidad_movimiento_id (el backend la recalcula). */
  cantidad?: number;
  /** Si el material se maneja por caja: número de cajas. El backend calcula el total en unidades. */
  cantidad_cajas?: number;
  /** Si el material es tipo Rollo (permite_conversion_unidad): unidad elegida (id de UnidadMedidaCatalogo). */
  unidad_movimiento_id?: number;
  /** Cantidad en la unidad elegida (ej. metros); el backend la convierte a la unidad base del material. */
  cantidad_en_unidad_movimiento?: number;
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
  /** En unidades. Opcional si se envía cantidad_cajas o unidad_movimiento_id (el backend la recalcula). */
  cantidad?: number;
  /** Si el material se maneja por caja: número de cajas. El backend calcula el total en unidades. */
  cantidad_cajas?: number;
  /** Si el material es tipo Rollo (permite_conversion_unidad): unidad elegida (id de UnidadMedidaCatalogo). */
  unidad_movimiento_id?: number;
  /** Cantidad en la unidad elegida (ej. metros); el backend la convierte a la unidad base del material. */
  cantidad_en_unidad_movimiento?: number;
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

// ─── Solicitudes de movimiento (flujo de aprobación ALMACENERO) ───────────────

export type TipoSolicitud = "salida_material" | "salida_pieza" | "baja_material" | "baja_pieza";
export type EstadoSolicitud = "pendiente" | "aprobada" | "rechazada";

export interface SolicitudMovimiento {
  id: number;
  tipo: TipoSolicitud;
  tipo_display: string;
  estado: EstadoSolicitud;
  estado_display: string;
  material: number | null;
  material_nombre: string | null;
  material_codigo: string | null;
  pieza: number | null;
  pieza_codigo: string | null;
  pieza_nombre: string | null;
  pieza_detalle: string | null;
  piezas_hijas_ids: number[];
  cantidad: number;
  cantidad_cajas: number | null;
  referencia_externa: string;
  observaciones: string;
  solicitado_por: number;
  solicitado_por_nombre: string | null;
  creado_en: string;
  resuelto_en: string | null;
  resuelto_por: number | null;
  resuelto_por_nombre: string | null;
  motivo_rechazo: string;
  motivo_no_entrega: string;
  movimiento: number | null;
}

export interface RespuestaSolicitudPendiente {
  solicitud_id: number;
  estado: EstadoSolicitud;
  tipo: TipoSolicitud;
  mensaje: string;
}

export interface CrearSolicitudInput {
  tipo: TipoSolicitud;
  material?: number;
  pieza?: number;
  piezas_hijas_ids?: number[];
  cantidad?: number;
  cantidad_cajas?: number;
  referencia_externa?: string;
  observaciones?: string;
}

export async function listSolicitudes(params: {
  estado?: EstadoSolicitud;
  tipo?: TipoSolicitud;
} = {}): Promise<SolicitudMovimiento[]> {
  const { data } = await api.get<SolicitudMovimiento[]>("/solicitudes/", { params });
  return data;
}

export async function crearSolicitudMovimiento(
  input: CrearSolicitudInput,
): Promise<RespuestaSolicitudPendiente> {
  const { data } = await api.post<RespuestaSolicitudPendiente>("/solicitudes/", input);
  return data;
}

export async function aprobarSolicitud(id: number): Promise<{ mensaje: string }> {
  const { data } = await api.post<{ mensaje: string }>(`/solicitudes/${id}/aprobar/`);
  return data;
}

export async function rechazarSolicitud(
  id: number,
  motivo_rechazo?: string,
): Promise<{ mensaje: string }> {
  const { data } = await api.post<{ mensaje: string }>(`/solicitudes/${id}/rechazar/`, {
    motivo_rechazo: motivo_rechazo ?? "",
  });
  return data;
}

// ─── Exportación Excel ────────────────────────────────────────────────────────

export async function descargarExcelMovimientos(materialId?: number): Promise<void> {
  const params = materialId ? { material: materialId } : {};
  const { data, headers } = await api.get("/movimientos/exportar-excel/", {
    params,
    responseType: "blob",
  });
  const contentDisposition: string = headers["content-disposition"] ?? "";
  const match = contentDisposition.match(/filename="?([^"]+)"?/);
  const filename = match?.[1] ?? "movimientos.xlsx";
  const url = URL.createObjectURL(new Blob([data]));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Grupos de Solicitudes y OTs Activas (Objetivo 1) ───────────────────────

export interface RenglonSalida {
  id: string;
  materialId: number;
  cantidad: number;
  cantidadCajas: number;
}

export interface WorkOrderActiva {
  id: string;
  code: string;
  status: string;
  status_display: string;
  technician_name: string;
}

export async function listOrdenesTrabajoActivas(): Promise<WorkOrderActiva[]> {
  const { data } = await api.get<WorkOrderActiva[]>("/ots-activas/");
  return data;
}

export interface GrupoSolicitudItemInput {
  tipo: TipoSolicitud;
  material: number;
  cantidad?: number;
  cantidad_cajas?: number;
  observaciones?: string;
}

export interface CrearGrupoSolicitudInput {
  work_order?: string | null;
  observaciones?: string;
  items: GrupoSolicitudItemInput[];
}

export interface WorkOrderDetailInGrupo {
  id: string;
  code: string;
  status: string;
  status_display: string;
  technician_name: string;
  supporting_technicians: string[];
}

export interface GrupoSolicitud {
  id: number;
  solicitado_por: number;
  solicitado_por_nombre: string;
  work_order: string | null;
  work_order_code: string | null;
  work_order_detail?: WorkOrderDetailInGrupo | null;
  observaciones: string;
  creado_en: string;
  estado: EstadoSolicitud;
  items: SolicitudMovimiento[];
}

export async function crearGrupoSolicitud(
  input: CrearGrupoSolicitudInput
): Promise<GrupoSolicitud> {
  const { data } = await api.post<GrupoSolicitud>("/grupos-solicitud/", input);
  return data;
}

export async function listGruposSolicitud(params: { estado?: string } = {}): Promise<GrupoSolicitud[]> {
  const { data } = await api.get<GrupoSolicitud[]>("/grupos-solicitud/", { params });
  return data;
}

export async function getGrupoSolicitud(id: number | string): Promise<GrupoSolicitud> {
  const { data } = await api.get<GrupoSolicitud>(`/grupos-solicitud/${id}/`);
  return data;
}

export async function aprobarTodosGrupoSolicitud(id: number | string): Promise<{ mensaje: string; grupo: GrupoSolicitud }> {
  const { data } = await api.post<{ mensaje: string; grupo: GrupoSolicitud }>(`/grupos-solicitud/${id}/aprobar-todos/`);
  return data;
}

export interface ItemDecisionInput {
  solicitud_id: number;
  aprobado: boolean;
  motivo_no_entrega?: string;
}

export async function resolverParcialGrupoSolicitud(
  id: number | string,
  items: ItemDecisionInput[]
): Promise<{ mensaje: string; grupo: GrupoSolicitud }> {
  const { data } = await api.post<{ mensaje: string; grupo: GrupoSolicitud }>(
    `/grupos-solicitud/${id}/resolver-parcial/`,
    { items }
  );
  return data;
}