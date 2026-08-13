/**
 * Spatial master data is intentionally independent from asset taxonomy.
 *
 * A FacilitySite is the root of a physical location. Every SpaceNode belongs
 * to one site and is ordered below it by `parentId`. The API exposes a virtual
 * site root in the tree endpoint, but sites are never written through the
 * node endpoint.
 */
export const SPACE_NODE_TYPES = [
  "MACRO_AREA",
  "SECTOR",
  "BUILDING",
  "LEVEL",
  "AREA",
  "MODULE",
  "ENVIRONMENT",
  "POINT",
] as const;

export type SpaceNodeType = (typeof SPACE_NODE_TYPES)[number];
export type SpaceKind = "SITE" | SpaceNodeType;
export type SpaceEntityType = "site" | "node";

export type SpaceAddress = {
  addressLine: string;
  district: string;
  province: string;
  department: string;
  country: string;
};

export type LegacyLocation = {
  id: string;
  code: string;
  displayName: string;
  active: boolean;
};

export type SpaceUsage = {
  childCount: number;
  assetCount: number;
  activeAssignments: number;
  activePeople: number;
};

export type SpaceSite = {
  id: string;
  code: string;
  name: string;
  address: SpaceAddress;
  active: boolean;
  createdAt: string;
  updatedAt: string;
};

export type SpaceNode = {
  id: string;
  siteId: string;
  parentId: string | null;
  nodeType: SpaceNodeType;
  /** Alias supplied by the API for generic tree consumers. */
  kind: SpaceNodeType;
  codeSegment: string;
  /** Human-readable alias supplied by the API. */
  code: string;
  pathCode: string;
  name: string;
  active: boolean;
  squareMeters: number | null;
  headcount: number | null;
  commonSpace: boolean;
  legacyLocation: LegacyLocation | null;
  usage: SpaceUsage;
  createdAt: string;
  updatedAt: string;
};

export type SpaceTreeNode = {
  id: string;
  entityType: SpaceEntityType;
  siteId: string;
  parentId: string | null;
  kind: SpaceKind;
  code: string;
  name: string;
  active: boolean;
  pathCode: string;
  squareMeters: number | null;
  headcount: number | null;
  commonSpace: boolean;
  legacyLocation: LegacyLocation | null;
  usage: SpaceUsage;
  children: SpaceTreeNode[];
};

export type SpaceSiteInput = {
  code: string;
  name: string;
  address: SpaceAddress;
};

export type SpaceNodeInput = {
  siteId: string;
  parentId: string | null;
  nodeType: SpaceNodeType;
  codeSegment: string;
  name: string;
  squareMeters: number | null;
  headcount: number | null;
  commonSpace: boolean;
};

export type SpaceFilters = {
  q?: string;
  kind?: SpaceKind | "";
  siteId?: string;
  active?: "true" | "false" | "";
};

export type SpaceImpact = {
  childCount: number;
  assetCount: number;
  assignmentCount: number;
  mapCount: number;
  canArchive: boolean;
  reason: string;
};

export type SpaceOption = Pick<
  SpaceNode,
  "id" | "siteId" | "parentId" | "kind" | "nodeType" | "code" | "name" | "pathCode" | "active"
>;

export type SpaceNodeTypeOption = {
  value: SpaceNodeType;
  label: string;
};

export type SpaceOptions = {
  sites: SpaceSite[];
  parent: SpaceNode | null;
  allowedNodeTypes: SpaceNodeTypeOption[];
  nodes: SpaceOption[];
};

export const spaceKindLabels: Record<SpaceKind, string> = {
  SITE: "Sede",
  MACRO_AREA: "Área macro",
  SECTOR: "Sector",
  BUILDING: "Edificio",
  LEVEL: "Nivel",
  AREA: "Área",
  MODULE: "Módulo",
  ENVIRONMENT: "Ambiente",
  POINT: "Punto específico",
};

export const spaceKindCodeHints: Record<SpaceKind, string> = {
  SITE: "Ej. INC1",
  MACRO_AREA: "Ej. AD",
  SECTOR: "Ej. MKT",
  BUILDING: "Ej. CAS",
  LEVEL: "Ej. N02",
  AREA: "Ej. FM",
  MODULE: "Ej. M04",
  ENVIRONMENT: "Ej. OF204",
  POINT: "Ej. ESTB",
};

export const spaceKindDescriptions: Record<SpaceKind, string> = {
  SITE: "Sede o complejo principal con su ubicación geográfica oficial.",
  MACRO_AREA: "Bloque operativo, administrativo, comercial, retail o de almacenamiento.",
  SECTOR: "Unidad organizativa dentro de una macroárea.",
  BUILDING: "Edificio físico perteneciente a una sede.",
  LEVEL: "Piso, nivel o planta dentro de un edificio.",
  AREA: "Área funcional dentro de un nivel, sector o macroárea.",
  MODULE: "Módulo, estación o unidad funcional identificable.",
  ENVIRONMENT: "Oficina, almacén, taller o ambiente al que se asignan bienes.",
  POINT: "Ubicación puntual como un estante, bahía o posición operativa.",
};

export function isSpaceNodeType(value: string): value is SpaceNodeType {
  return (SPACE_NODE_TYPES as readonly string[]).includes(value);
}

export function isSpaceKind(value: string): value is SpaceKind {
  return value === "SITE" || isSpaceNodeType(value);
}
