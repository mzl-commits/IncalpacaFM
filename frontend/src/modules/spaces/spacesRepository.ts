import { api } from "@/services/api";
import type {
  LegacyLocation,
  SpaceAddress,
  SpaceFilters,
  SpaceImpact,
  SpaceKind,
  SpaceNode,
  SpaceNodeInput,
  SpaceOptions,
  SpaceSite,
  SpaceSiteInput,
  SpaceTreeNode,
  SpaceUsage,
} from "./types";
import { isSpaceNodeType } from "./types";

type ApiRecord = Record<string, unknown>;

function isRecord(value: unknown): value is ApiRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : value == null ? fallback : String(value);
}

function asNullableString(value: unknown): string | null {
  const normalized = asString(value).trim();
  return normalized || null;
}

function asNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asNullableNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function asList(value: unknown): ApiRecord[] {
  if (Array.isArray(value)) return value.filter(isRecord);
  if (!isRecord(value)) return [];
  for (const key of ["results", "items", "nodes", "sites", "tree", "children"]) {
    const candidate = value[key];
    if (Array.isArray(candidate)) return candidate.filter(isRecord);
  }
  return [];
}

function mapAddress(record: ApiRecord): SpaceAddress {
  return {
    addressLine: asString(record.address_line ?? record.addressLine),
    district: asString(record.district),
    province: asString(record.province),
    department: asString(record.department),
    country: asString(record.country, "Perú"),
  };
}

function mapLegacyLocation(value: unknown): LegacyLocation | null {
  if (!isRecord(value)) return null;
  return {
    id: asString(value.id),
    code: asString(value.location_code ?? value.code),
    displayName: asString(value.display_name ?? value.displayName ?? value.name),
    active: asBoolean(value.active, true),
  };
}

function mapUsage(record: ApiRecord): SpaceUsage {
  const usage = isRecord(record.usage) ? record.usage : {};
  return {
    childCount: asNumber(usage.child_count ?? usage.childCount ?? record.child_count),
    assetCount: asNumber(usage.asset_count ?? usage.assetCount ?? record.asset_count),
    activeAssignments: asNumber(
      usage.active_assignments ?? usage.activeAssignments ?? record.active_assignments,
    ),
    activePeople: asNumber(usage.active_people ?? usage.activePeople ?? record.active_people),
  };
}

export function mapSite(record: ApiRecord): SpaceSite {
  return {
    id: asString(record.id),
    code: asString(record.code),
    name: asString(record.name),
    address: mapAddress(record),
    active: asBoolean(record.active, true),
    createdAt: asString(record.created_at ?? record.createdAt),
    updatedAt: asString(record.updated_at ?? record.updatedAt),
  };
}

export function mapNode(record: ApiRecord, inheritedSiteId = "", inheritedParentId: string | null = null): SpaceNode {
  const rawType = asString(record.node_type ?? record.kind ?? record.type).toUpperCase();
  const nodeType = isSpaceNodeType(rawType) ? rawType : "AREA";
  const parent = isRecord(record.parent) ? record.parent : null;
  const site = isRecord(record.site) ? record.site : null;
  const siteId = asString(record.site_id ?? record.siteId ?? site?.id, inheritedSiteId);
  const parentId = asNullableString(record.parent_id ?? record.parentId ?? parent?.id) ?? inheritedParentId;
  const codeSegment = asString(record.code_segment ?? record.codeSegment ?? record.code);
  const pathCode = asString(record.path_code ?? record.pathCode, codeSegment);

  return {
    id: asString(record.id),
    siteId,
    parentId,
    nodeType,
    kind: nodeType,
    codeSegment,
    code: asString(record.code, codeSegment),
    pathCode,
    name: asString(record.name),
    active: asBoolean(record.active ?? record.is_active, true),
    squareMeters: asNullableNumber(record.square_meters ?? record.squareMeters),
    headcount: asNullableNumber(record.headcount),
    commonSpace: asBoolean(record.common_space ?? record.commonSpace),
    legacyLocation: mapLegacyLocation(record.legacy_location ?? record.legacyLocation),
    usage: mapUsage(record),
    createdAt: asString(record.created_at ?? record.createdAt),
    updatedAt: asString(record.updated_at ?? record.updatedAt),
  };
}

function mapTreeNode(
  record: ApiRecord,
  inheritedSiteId: string,
  inheritedParentId: string | null,
): SpaceTreeNode {
  const node = mapNode(record, inheritedSiteId, inheritedParentId);
  const childRecords = asList(record.children ?? record.nodes);
  const children = childRecords.map((child) => mapTreeNode(child, node.siteId, node.id));
  return {
    id: node.id,
    entityType: "node",
    siteId: node.siteId,
    parentId: node.parentId,
    kind: node.kind,
    code: node.code,
    name: node.name,
    active: node.active,
    pathCode: node.pathCode,
    squareMeters: node.squareMeters,
    headcount: node.headcount,
    commonSpace: node.commonSpace,
    legacyLocation: node.legacyLocation,
    usage: { ...node.usage, childCount: node.usage.childCount || children.length },
    children,
  };
}

function mapTreeSite(record: ApiRecord): SpaceTreeNode {
  const site = mapSite(record);
  const children = asList(record.nodes ?? record.children).map((node) => mapTreeNode(node, site.id, null));
  return {
    id: site.id,
    entityType: "site",
    siteId: site.id,
    parentId: null,
    kind: "SITE",
    code: site.code,
    name: site.name,
    active: site.active,
    pathCode: site.code,
    squareMeters: null,
    headcount: null,
    commonSpace: false,
    legacyLocation: null,
    usage: { childCount: children.length, assetCount: 0, activeAssignments: 0, activePeople: 0 },
    children,
  };
}

function nodePayload(input: SpaceNodeInput) {
  return {
    site_id: input.siteId,
    parent_id: input.parentId,
    node_type: input.nodeType,
    code_segment: input.codeSegment.trim().toUpperCase(),
    name: input.name.trim(),
    square_meters: input.squareMeters,
    headcount: input.headcount,
    common_space: input.commonSpace,
  };
}

function sitePayload(input: SpaceSiteInput) {
  return {
    code: input.code.trim().toUpperCase(),
    name: input.name.trim(),
    address_line: input.address.addressLine.trim(),
    district: input.address.district.trim(),
    province: input.address.province.trim(),
    department: input.address.department.trim(),
    country: input.address.country.trim() || "Perú",
  };
}

export async function listSpaceNodes(filters: SpaceFilters = {}): Promise<SpaceNode[]> {
  const { data } = await api.get<unknown>("/spaces/nodes/", {
    params: {
      q: filters.q || undefined,
      node_type: filters.kind && filters.kind !== "SITE" ? filters.kind : undefined,
      site_id: filters.siteId || undefined,
      active: filters.active || undefined,
    },
  });
  return asList(data).map((item) => mapNode(item));
}

export async function listSites(active: "true" | "false" | "" = ""): Promise<SpaceSite[]> {
  const { data } = await api.get<unknown>("/spaces/sites/", {
    params: { active: active || "all" },
  });
  return asList(data).map(mapSite);
}

export async function getSpaceTree(active: "true" | "false" | "" = ""): Promise<SpaceTreeNode[]> {
  const { data } = await api.get<unknown>("/spaces/tree/", {
    params: { active: active || "all" },
  });
  return asList(data).map((item) => {
    const kind = asString(item.kind).toUpperCase();
    return kind === "SITE" || "nodes" in item ? mapTreeSite(item) : mapTreeNode(item, "", null);
  });
}

export async function getSpaceNode(id: string): Promise<SpaceNode> {
  const { data } = await api.get<ApiRecord>(`/spaces/nodes/${id}/`);
  return mapNode(data);
}

export async function getSite(id: string): Promise<SpaceSite> {
  const { data } = await api.get<ApiRecord>(`/spaces/sites/${id}/`);
  return mapSite(data);
}

export async function createSite(input: SpaceSiteInput): Promise<SpaceSite> {
  const { data } = await api.post<ApiRecord>("/spaces/sites/", sitePayload(input));
  return mapSite(data);
}

export async function updateSite(id: string, input: SpaceSiteInput): Promise<SpaceSite> {
  const { data } = await api.patch<ApiRecord>(`/spaces/sites/${id}/`, sitePayload(input));
  return mapSite(data);
}

export async function createSpaceNode(input: SpaceNodeInput): Promise<SpaceNode> {
  const { data } = await api.post<ApiRecord>("/spaces/nodes/", nodePayload(input));
  return mapNode(data);
}

export async function updateSpaceNode(id: string, input: SpaceNodeInput): Promise<SpaceNode> {
  const { data } = await api.patch<ApiRecord>(`/spaces/nodes/${id}/`, nodePayload(input));
  return mapNode(data);
}

/** The API keeps `active` read-only and applies these audit-friendly actions. */
async function setEntityActive(entity: "sites" | "nodes", id: string, active: boolean) {
  const action = active ? "restore" : "archive";
  const { data } = await api.post<ApiRecord>(`/spaces/${entity}/${id}/${action}/`);
  return entity === "sites" ? mapSite(data) : mapNode(data);
}

export async function setSpaceNodeActive(id: string, active: boolean): Promise<SpaceNode> {
  return setEntityActive("nodes", id, active) as Promise<SpaceNode>;
}

export async function setSiteActive(id: string, active: boolean): Promise<SpaceSite> {
  return setEntityActive("sites", id, active) as Promise<SpaceSite>;
}

export async function getSpaceImpact(id: string): Promise<SpaceImpact> {
  const { data } = await api.get<unknown>(`/spaces/nodes/${id}/impact/`);
  const record = isRecord(data) ? data : {};
  return {
    childCount: asNumber(record.active_children ?? record.child_count ?? record.children),
    assetCount: asNumber(record.asset_count ?? record.assets),
    assignmentCount: asNumber(record.assignment_count ?? record.assignments),
    mapCount: asNumber(record.active_map_count ?? record.map_count ?? record.maps),
    canArchive: asBoolean(record.can_archive, true),
    reason: asString(record.reason ?? record.detail),
  };
}

export async function getSpaceOptions(
  params: { siteId?: string; parentId?: string } = {},
): Promise<SpaceOptions> {
  const { data } = await api.get<unknown>("/spaces/options/", {
    params: { site_id: params.siteId || undefined, parent_id: params.parentId || undefined },
  });
  const record = isRecord(data) ? data : {};
  const nodes = asList(record.nodes).map((item) => {
    const node = mapNode(item);
    return {
      id: node.id,
      siteId: node.siteId,
      parentId: node.parentId,
      kind: node.kind,
      nodeType: node.nodeType,
      code: node.code,
      name: node.name,
      pathCode: node.pathCode,
      active: node.active,
    };
  });
  const allowedNodeTypes = asList(record.allowed_node_types).flatMap((item) => {
    const value = asString(item.value).toUpperCase();
    return isSpaceNodeType(value) ? [{ value, label: asString(item.label, value) }] : [];
  });
  return {
    sites: asList(record.sites).map(mapSite),
    parent: isRecord(record.parent) ? mapNode(record.parent) : null,
    allowedNodeTypes,
    nodes,
  };
}

export function toTreeNode(node: SpaceNode): SpaceTreeNode {
  return {
    id: node.id,
    entityType: "node",
    siteId: node.siteId,
    parentId: node.parentId,
    kind: node.kind,
    code: node.code,
    name: node.name,
    active: node.active,
    pathCode: node.pathCode,
    squareMeters: node.squareMeters,
    headcount: node.headcount,
    commonSpace: node.commonSpace,
    legacyLocation: node.legacyLocation,
    usage: node.usage,
    children: [],
  };
}

export function treeNodeKindLabel(node: SpaceTreeNode): SpaceKind {
  return node.kind;
}
