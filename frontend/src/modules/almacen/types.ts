// ─── Constantes de negocio ────────────────────────────────────────────────────

/** Umbral de stock bajo para materiales sin control individual. Cambiar aquí para afectar toda la UI. */
export const STOCK_MINIMO = 5;

// ─── Enums / literales ────────────────────────────────────────────────────────

export type TipoControl = "retornable" | "no_retornable";

export type EstadoPieza = "Disponible" | "Prestado" | "Mantenimiento" | "Baja";

export type TipoMovimiento = "salida" | "entrada" | "baja";

export type TipoInspeccion = "individual" | "grupal";

export type ResultadoInspeccion =
  | "apta"
  | "requiere_reparacion"
  | "fuera_servicio";

export type AccionInspeccion =
  | "continua_servicio"
  | "enviar_reparacion"
  | "retirar_servicio"
  | "dar_baja"
  | "reemplazar";

export type ValorRespuesta = "cumple" | "no_cumple" | "no_aplica";

// ─── Labels legibles ──────────────────────────────────────────────────────────

export const estadoPiezaLabels: Record<EstadoPieza, string> = {
  Disponible: "Disponible",
  Prestado: "Prestado",
  Mantenimiento: "Mantenimiento",
  Baja: "Baja",
};

export const tipoMovimientoLabels: Record<TipoMovimiento, string> = {
  salida: "Salida",
  entrada: "Entrada",
  baja: "Baja",
};

export const resultadoInspeccionLabels: Record<ResultadoInspeccion, string> = {
  apta: "Apta",
  requiere_reparacion: "Requiere reparación",
  fuera_servicio: "Fuera de servicio",
};

export const accionInspeccionLabels: Record<AccionInspeccion, string> = {
  continua_servicio: "Continúa en servicio",
  enviar_reparacion: "Enviar a reparación",
  retirar_servicio: "Retirar del servicio",
  dar_baja: "Dar de baja",
  reemplazar: "Reemplazar",
};

export const valorRespuestaLabels: Record<ValorRespuesta, string> = {
  cumple: "Cumple",
  no_cumple: "No cumple",
  no_aplica: "No aplica",
};

export const tipoControlLabels: Record<TipoControl, string> = {
  retornable: "Retornable",
  no_retornable: "No retornable",
};

// ─── Catálogo ─────────────────────────────────────────────────────────────────

export interface Categoria {
  id: number;
  nombre: string;
  prefijo: string;
  descripcion: string;
  activo: boolean;
}

export interface Subcategoria {
  id: number;
  categoria: number;
  categoria_nombre: string;
  nombre: string;
  plantilla_inspeccion: number | null;
  plantilla_inspeccion_nombre: string | null;
  activo: boolean;
}

export interface PiezaBase {
  id: number;
  material: number;
  material_nombre: string;
  material_medida: string;
  codigo: string | null;
  estado: EstadoPieza;
  foto: string | null;
  padre: number | null;
  creado_en: string;
}

export interface PiezaAnidada {
  id: number;
  codigo: string | null;
  estado: EstadoPieza;
  foto: string | null;
  material_nombre?: string;
  material_medida?: string;
  total_hijas: number;
  hijas_disponibles: number;
  piezas_hijas: PiezaBase[];
}

export interface Material {
  id: number;
  subcategoria: number;
  subcategoria_nombre: string;
  subcategoria_plantilla_inspeccion: number | null; 
  subcategoria_plantilla_inspeccion_nombre: string | null;
  categoria_nombre: string;
  codigo: string;
  nombre: string;
  marca: string;
  modelo: string;
  medida: string;
  foto: string | null;
  grosor_mm: string | null;
  largo_mm: string | null;
  ubicacion_fisica: string;
  tipo_control: TipoControl;
  control_individual: boolean;
  cantidad_total: number;
  activo: boolean;
  creado_en: string;
}

export interface MaterialDetalle extends Material {
  piezas: PiezaAnidada[];
}

// ─── Payloads de creación ────────────────────────────────────────────────────

export interface MaterialCreatePayload {
  subcategoria: number;
  nombre: string;
  marca: string;
  modelo: string;
  medida: string;
  grosor_mm: string;
  largo_mm: string;
  ubicacion_fisica: string;
  tipo_control: TipoControl;
  control_individual: boolean;
  // foto se envía aparte como FormData si existe
}

export interface AltaPiezasSueltasPayload {
  material_id: number;
  cantidad: number;
}

export interface PiezaHijaSpec {
  material_id: number;
  cantidad: number;
}

export interface AltaEstuchePayload {
  material_contenedor_id: number;
  piezas_hijas: PiezaHijaSpec[];
  num_estuches: number;
}

// ─── Inventario / Movimientos ─────────────────────────────────────────────────

export interface Movimiento {
  id: number;
  material: number;
  material_codigo: string;
  material_nombre: string;
  pieza: number | null;
  pieza_codigo: string | null;
  tipo: TipoMovimiento;
  tipo_display: string;
  cantidad: number;
  fecha: string;
  responsable: number;
  responsable_nombre: string;
  referencia_externa: string;
  lote_id: string;
  observaciones: string;
}

export interface PiezaPrestada {
  id: number;
  codigo: string | null;
  estado: EstadoPieza;
  material: number;
  material_codigo: string;
  material_nombre: string;
  padre: number | null;
  padre_codigo: string | null;
  ultimo_movimiento: {
    fecha: string;
    responsable: string;
    referencia_externa: string;
    lote_id: string;
  } | null;
}

export interface SalidaEstucheRespuesta {
  movimientos: Movimiento[];
  hijas_excluidas?: number[];
  aviso?: string;
}

// ─── Inspección ───────────────────────────────────────────────────────────────

export interface Criterio {
  id: number;
  plantilla: number;
  texto: string;
  orden: number;
}

export interface PlantillaCriterio {
  id: number;
  nombre: string;
  criterios: Criterio[];
}

export interface RespuestaCriterio {
  id: number;
  criterio: number;
  criterio_texto: string;
  valor: ValorRespuesta;
  observacion: string;
}

export interface Inspeccion {
  id: number;
  tipo: TipoInspeccion;
  material: number;
  material_codigo: string;
  material_nombre: string;
  pieza: number | null;
  pieza_codigo: string | null;
  piezas_lote: number[];
  plantilla: number;
  plantilla_nombre: string;
  fecha: string;
  proxima_inspeccion: string | null;
  inspector: number | null;
  inspector_nombre: string;
  cantidad_inspeccionada: number | null;
  cantidad_apta: number | null;
  cantidad_no_apta: number | null;
  resultado_general: ResultadoInspeccion;
  accion_tomada: AccionInspeccion;
  observaciones: string;
  respuestas: RespuestaCriterio[];
}

export interface VencidaItem {
  material_id: number;
  material_codigo: string;
  material_nombre: string;
  plantilla: string;
  cantidad_pendiente: number | null;
  piezas_pendientes: { pieza_id: number; pieza_codigo: string }[];
}

// ─── Usuarios ─────────────────────────────────────────────────────────────────

export interface UsuarioLista {
  id: number;
  worker_code: string;
  full_name: string;
  role: string;
  role_display: string;
}
