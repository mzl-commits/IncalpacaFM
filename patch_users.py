import re

with open(r'c:\Users\Asus TUF F15\incalpacafm\sgtb-incalpaca\frontend\src\modules\assets\pages\AssetMapOverviewPage.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add useLocations import
import_loc = 'import { useLocationMapImage } from "../locationMapQueries";'
new_import_loc = 'import { useLocationMapImage, useLocations } from "../locationMapQueries";'
content = content.replace(import_loc, new_import_loc)

# Add useLocations query
space_nodes_query = 'const spaceNodesQuery = useQuery({\n    queryKey: ["space-nodes", "map"],\n    queryFn: () => listSpaceNodes({ active: "true" }),\n  });'
new_space_nodes_query = space_nodes_query + '\n  const locationsQuery = useLocations();'
content = content.replace(space_nodes_query, new_space_nodes_query)

# Change assetsByLocation
assets_by_location_old = """  const assetsByLocation = useMemo(() => {
    const grouped = new Map<string, typeof assets>();
    for (const asset of assets) {
      const id = asset.locationDetail?.id;
      if (id) grouped.set(id, [...(grouped.get(id) ?? []), asset]);
    }
    return grouped;
  }, [assets]);"""

assets_by_location_new = """  const assetsByLocation = useMemo(() => {
    const grouped = new Map<string, typeof assets>();
    const locationToSpace = new Map<string, string>();
    for (const node of spaceNodesQuery.data || []) {
      if (node.legacyLocation?.id) locationToSpace.set(node.legacyLocation.id, node.id);
    }
    for (const asset of assets) {
      const locId = asset.locationDetail?.id;
      if (locId) {
        const spaceId = locationToSpace.get(locId);
        if (spaceId) grouped.set(spaceId, [...(grouped.get(spaceId) ?? []), asset]);
      }
    }
    return grouped;
  }, [assets, spaceNodesQuery.data]);"""
content = content.replace(assets_by_location_old, assets_by_location_new)

# Map users in spaceNodesToLocations
def_space = 'function spaceNodesToLocations(nodes: SpaceNode[]): LocationOption[] {'
new_def_space = 'function spaceNodesToLocations(nodes: SpaceNode[], usersMap: Map<string, any[]>): LocationOption[] {'
content = content.replace(def_space, new_def_space)

assigned_users = 'assignedUsers: [],'
new_assigned_users = 'assignedUsers: node.legacyLocation ? usersMap.get(node.legacyLocation.id) || [] : [],'
content = content.replace(assigned_users, new_assigned_users)

locations_memo = """  const locations = useMemo(
    () => spaceNodesToLocations(spaceNodesQuery.data ?? []),
    [spaceNodesQuery.data],
  );"""
new_locations_memo = """  const locationsData = locationsQuery.data ?? [];
  const locations = useMemo(() => {
    const usersMap = new Map(locationsData.map(l => [l.id, l.assignedUsers]));
    return spaceNodesToLocations(spaceNodesQuery.data ?? [], usersMap);
  }, [spaceNodesQuery.data, locationsData]);"""
content = content.replace(locations_memo, new_locations_memo)

# Improve AreaModulesView photo empty state
area_photo = """      {photo && (
        <div className="asset-map-area-photo" style={{ marginBottom: 24, borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e5e5', backgroundColor: '#f9fafb' }}>
          <img src={photo} alt={`Fotografía de ${areaName}`} style={{ width: '100%', maxHeight: 400, objectFit: 'cover', display: 'block' }} />
        </div>
      )}"""
new_area_photo = """      <div className="asset-map-area-photo" style={{ marginBottom: 24, borderRadius: 8, overflow: 'hidden', border: '1px solid #e5e5e5', backgroundColor: '#f9fafb', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: photo ? 'auto' : 200 }}>
        {photo ? (
          <img src={photo} alt={`Fotografía de ${areaName}`} style={{ width: '100%', maxHeight: 400, objectFit: 'cover', display: 'block' }} />
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
            <ImageSquare size={48} weight="duotone" style={{ marginBottom: 12, opacity: 0.5 }} />
            <p style={{ margin: 0, fontSize: 14 }}>Sin imagen referencial de área</p>
          </div>
        )}
      </div>"""
content = content.replace(area_photo, new_area_photo)

# Fix AreaModulesView finding logic, in case node.name !== building (maybe it's a MACRO_AREA)
selected_area_node = 'const selectedAreaNode = (!searchMode && building) ? spaceNodesQuery.data?.find((n: SpaceNode) => n.name === building && n.nodeType === "AREA") : null;'
new_selected_area_node = 'const selectedAreaNode = (!searchMode && building) ? spaceNodesQuery.data?.find((n: SpaceNode) => n.name === building && (n.nodeType === "AREA" || n.nodeType === "MACRO_AREA")) : null;'
content = content.replace(selected_area_node, new_selected_area_node)

with open(r'c:\Users\Asus TUF F15\incalpacafm\sgtb-incalpaca\frontend\src\modules\assets\pages\AssetMapOverviewPage.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
