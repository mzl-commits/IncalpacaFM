// ─── Constantes de negocio ────────────────────────────────────────────────────

/** Umbral de stock bajo para materiales sin control individual. Cambiar aquí para afectar toda la UI. */
export const STOCK_MINIMO = 5;

// ─── Enums / literales ────────────────────────────────────────────────────────

export type TipoControl = "retornable" | "no_retornable";

export type EstadoPieza = "Disponible" | "Prestado" | "Mantenimiento" | "Baja";
export type TipoMovimiento = "salida" | "entrada" | "baja";
export type TipoInspeccion = "individual" | "grupal";
export type TipoInspeccionNaturaleza = "planificada" | "no_planificada";

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

export type UnidadMedida = string;
export type UnidadManejo = string;

export const unidadManejoLabels: Record<string, string> = {
  unidad: "Por unidad suelta",
  Paquete: "Por Paquete",
  Bolsa: "Por Bolsa",
  Blister: "Por Blíster",
  Kit: "Por Kit / Juego",
  Rollo: "Por Rollo",
  Docena: "Por Docena",
  Millar: "Por Millar",
  Litro: "Por Litro",
  Mililitro: "Por Mililitro",
  Galon: "Por Galón",
  Bidon: "Por Bidón",
  Kilogramo: "Por Kilogramo",
  Gramo: "Por Gramo",
  Libra: "Por Libra",
  Metro: "Por Metro",
  Centimetro: "Por Centímetro",
  Milimetro: "Por Milímetro",
  MetroCuadrado: "Por Metro Cuadrado",
  MetroCubico: "Por Metro Cúbico",
};


// ─── Catálogo ─────────────────────────────────────────────────────────────────

export interface Categoria {
  id: number;
  almacen: number;
  nombre: string;
  prefijo: string;
  descripcion: string;
  activo: boolean;
  requiere_inspeccion: boolean;
}

export interface Almacen {
  id: number;
  nombre: string;
  codigo: string;
  ubicacion: string;
  activo: boolean;
  croquis?:string|null;
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
  tiene_hijas: boolean;
  detalle?:string;
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
  detalle?:string;
}

export type Moneda = "PEN" | "USD";

export interface Material {
  id: number;
  subcategoria: number;
  subcategoria_nombre: string;
  subcategoria_plantilla_inspeccion: number | null; 
  subcategoria_plantilla_inspeccion_nombre: string | null;
  categoria_nombre: string;
  codigo_quipu: string;
  codigo: string;
  nombre: string;
  marca: string;
  modelo: string;
  medida: string;
  foto: string | null;
  medidas: MaterialMedida[];
  ubicacion_fisica: string;
  precio: string | number | null;
  moneda: Moneda;
  tipo_control: TipoControl;
  control_individual: boolean;
  cantidad_total: number;
  stock_minimo: number;
  periodicidad_valor: number;
  periodicidad_unidad: "dias" | "meses";
  periodicidad_inspeccion_dias: number;
  es_inspeccionable: boolean;
  unidad_manejo: number | string;
  unidad_manejo_nombre?: string | null;
  /** Si es true, el material se maneja por empaque (caja/bolsa/kit/etc.) y requiere unidades_por_caja. */
  unidad_manejo_requiere_multiplicador?: boolean;
  /** Si es true (ej. Rollo), en cada movimiento se puede elegir otra unidad (cm/m) y se convierte a unidad_movimiento_base. */
  unidad_manejo_permite_conversion_unidad?: boolean;
  unidades_por_caja: number | null;
  unidad_movimiento_base?: number | string | null;
  unidad_movimiento_base_nombre?: string | null;
  unidad_movimiento_base_abreviatura?: string | null;
  activo: boolean;
  creado_en: string;

  almacen: number;
  almacen_nombre: string;
}

export interface MaterialDetalle extends Material {
  piezas: PiezaAnidada[];
}

// ─── Payloads de creación ────────────────────────────────────────────────────

export interface MaterialCreatePayload {
  subcategoria: number;
  nombre: string;
  codigo_quipu?: string;
  marca: string;
  modelo: string;
  medida: string;
  medidas: MaterialMedida[];
  ubicacion_fisica: string;
  precio?: string | number | null;
  moneda?: Moneda;
  tipo_control: TipoControl;
  control_individual: boolean;
  periodicidad_valor: number;
  periodicidad_unidad: "dias" | "meses";
  unidad_manejo?: number | string;
  unidades_por_caja?: number | string | null;
  unidad_movimiento_base?: number | string | null;
  cantidad_total?: number;
  almacen?: number;
  stock_minimo?: number;
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
  cantidad_cajas: number | null;
  unidad_movimiento: number | null;
  unidad_movimiento_nombre: string | null;
  unidad_movimiento_abreviatura: string | null;
  cantidad_en_unidad_movimiento: string | number | null;
  fecha: string;
  responsable: number;
  responsable_nombre: string;
  referencia_externa: string;
  lote_id: string;
  observaciones: string;
}

/** Campos comunes a los tres payloads de movimiento (salida/entrada/baja). Se
 * puede indicar la cantidad de 3 formas mutuamente excluyentes: directa
 * (cantidad), por empaque (cantidad_cajas, si el material lo requiere) o por
 * unidad elegida (unidad_movimiento_id + cantidad_en_unidad_movimiento, solo
 * para materiales tipo Rollo que permiten conversión). */
export interface MovimientoConversionFields {
  cantidad?: number;
  cantidad_cajas?: number | null;
  unidad_movimiento_id?: number | null;
  cantidad_en_unidad_movimiento?: number | string | null;
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
  hijas_excluidas?: { id: number; codigo: string; estado: EstadoPieza }[];
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

export interface ObservacionInspeccion {
  id?: number;
  codigo: string;
  nombre: string;
  observacion_encontrada: string;
  accion_recomendada?: string;
  estado?: string;
}

export interface Inspeccion {
  id: number;
  codigo_inspeccion: string;
  tipo: TipoInspeccion;
  tipo_inspeccion?: "planificada" | "no_planificada";
  area?: string;
  frecuencia?: string;
  material: number;
  material_codigo: string;
  material_nombre: string;
  pieza: number | null;
  pieza_codigo: string | null;
  piezas_lote: number[];
  piezas_lote_codigos?: string[];
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
  /** Periodicidad del material dueño (o del contenedor, si es pieza), en días. Requerido por TrimestreBadge. */
  material_periodicidad_inspeccion_dias: number | null;
  respuestas: RespuestaCriterio[];
  items_con_observacion?: ObservacionInspeccion[];
}

// ─── Planificación (Plan Anual / Programación de inspecciones) ───────────────

export type EstadoPlanAnual = "borrador" | "aprobado" | "cerrado";
export type EstadoProgramacion = "pendiente" | "realizada";
export type EstadoCalculado = "vencida" | "proxima" | "pendiente" | "realizada";

export const estadoPlanAnualLabels: Record<EstadoPlanAnual, string> = {
  borrador: "Borrador",
  aprobado: "Aprobado",
  cerrado: "Cerrado",
};

export const estadoCalculadoLabels: Record<EstadoCalculado, string> = {
  vencida: "Vencida",
  proxima: "Próxima",
  pendiente: "Pendiente",
  realizada: "Realizada",
};

export interface PlanInspeccionAnual {
  id: number;
  anio: number;
  fecha_inicio: string;
  fecha_fin: string;
  estado: EstadoPlanAnual;
}

export interface ProgramacionInspeccion {
  id: number;
  plan: number;
  material: number | null;
  material_codigo: string | null;
  pieza: number | null;
  pieza_codigo: string | null;
  subcategoria_nombre: string | null;
  objeto_nombre: string | null;
  periodicidad_dias: number;
  fecha_programada: string;
  estado: EstadoProgramacion;
  estado_calculado: EstadoCalculado;
  inspeccion: number | null;
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

// unidad_medida (grosor/largo) también viene ahora del catálogo editable
// UnidadMedidaCatalogo — su label es unidad_medida_nombre/abreviatura desde
// el backend, no un mapa fijo aquí.
export interface UnidadMedidaCatalogo {
  id: number;
  codigo: string;
  nombre: string;
  abreviatura: string;
  familia: "longitud" | "peso" | "volumen" | "otro";
  factor_a_base: string | number;
  activo: boolean;
  orden: number;
}

export interface TipoManejoStockCatalogo {
  id: number;
  codigo: string;
  nombre: string;
  requiere_multiplicador: boolean;
  permite_conversion_unidad: boolean;
  activo: boolean;
  orden: number;
}
export interface TipoMedidaCatalogo {
  id: number;
  codigo: string;
  nombre: string;
  activo: boolean;
  orden: number;
}

export interface MaterialMedida {
  id?: number;           // ausente al crear, presente al editar
  tipo: number;           // FK a TipoMedidaCatalogo
  tipo_nombre?: string;   // read-only, viene del backend
  valor: string | number;
  unidad_medida: number;  // FK a UnidadMedidaCatalogo
  unidad_medida_nombre?: string;
  unidad_medida_abreviatura?: string;
}

// ─── Documentos adjuntos de inspección ─────────────────────────────────────

export type TipoDocumentoInspeccion = "pdf" | "excel" | "word" | "otro";

export interface DocumentoInspeccion {
  id: number;
  inspeccion: number;
  /** URL del archivo servido por el backend */
  archivo: string;
  /** Nombre amigable mostrado en la UI (por defecto, el nombre del archivo) */
  nombre: string;
  tipo: TipoDocumentoInspeccion;
  subido_por: number;
  subido_por_nombre?: string;
  fecha_subida: string;
}

export const tipoDocumentoLabels: Record<TipoDocumentoInspeccion, string> = {
  pdf: "PDF",
  excel: "Excel",
  word: "Word",
  otro: "Otro",
};
