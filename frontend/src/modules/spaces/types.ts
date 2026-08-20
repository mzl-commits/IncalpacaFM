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
  "AREA",
  "MODULE",
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
  photoUrl?: string | null;
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
  userCount: number;
  mapCount: number;
  canArchive: boolean;
  reason: string;
};

export type SpaceOption = Pick<
  SpaceNode,
  "id" | "siteId" | "parentId" | "kind" | "nodeType" | "codeSegment" | "code" | "name" | "pathCode" | "active"
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

export const spaceKindLevels: Record<SpaceKind, number> = {
  SITE: 1,
  MACRO_AREA: 2,
  AREA: 3,
  MODULE: 4,
};

export const spaceKindLabels: Record<SpaceKind, string> = {
  SITE: "Sede (Nivel 1)",
  MACRO_AREA: "Área macro (Nivel 2)",
  AREA: "Área (Nivel 3)",
  MODULE: "Módulo (Nivel 4)",
};

export const spaceKindCodeHints: Record<SpaceKind, string> = {
  SITE: "Ej. INC1",
  MACRO_AREA: "Ej. PP, AD, CO, RE, AL",
  AREA: "Ej. MKT",
  MODULE: "Ej. MT01",
};

export const spaceKindDescriptions: Record<SpaceKind, string> = {
  SITE: "Sede o complejo principal (Nivel 1 raíz de la infraestructura).",
  MACRO_AREA: "Área macro (Nivel 2) dentro de una sede. Inicia con PP, AD, CO, RE o AL.",
  AREA: "Área funcional (Nivel 3) dentro de un área macro.",
  MODULE: "Módulo de trabajo (Nivel 4) dentro de un área.",
};

export function isSpaceNodeType(value: string): value is SpaceNodeType {
  return (SPACE_NODE_TYPES as readonly string[]).includes(value);
}

export function isSpaceKind(value: string): value is SpaceKind {
  return value === "SITE" || isSpaceNodeType(value);
}
