import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createSite,
  createSpaceNode,
  deleteSite,
  deleteSpaceNode,
  getSite,
  getSpaceImpact,
  getSpaceNode,
  getSpaceTree,
  getSpaceOptions,
  listSites,
  listSpaceNodes,
  setSiteActive,
  setSpaceNodeActive,
  updateSite,
  updateSpaceNode,
} from "./spacesRepository";
import type { SpaceFilters, SpaceNodeInput, SpaceSiteInput } from "./types";

export const spaceKeys = {
  all: ["spaces"] as const,
  nodes: () => [...spaceKeys.all, "nodes"] as const,
  nodeList: (filters: SpaceFilters) => [...spaceKeys.nodes(), filters] as const,
  sites: (active: "true" | "false" | "" = "") => [...spaceKeys.all, "sites", active] as const,
  site: (id: string) => [...spaceKeys.sites(), "detail", id] as const,
  tree: (active: "true" | "false" | "") => [...spaceKeys.all, "tree", active] as const,
  detail: (id: string) => [...spaceKeys.all, "detail", id] as const,
  impact: (id: string) => [...spaceKeys.all, "impact", id] as const,
  options: (siteId?: string, parentId?: string) =>
    [...spaceKeys.all, "options", siteId ?? "", parentId ?? ""] as const,
};

export function useSpaces(filters: SpaceFilters = {}) {
  return useQuery({
    queryKey: spaceKeys.nodeList(filters),
    queryFn: () => listSpaceNodes(filters),
  });
}

export function useSites(active: "true" | "false" | "" = "") {
  return useQuery({ queryKey: spaceKeys.sites(active), queryFn: () => listSites(active) });
}

export function useSite(id: string | undefined) {
  return useQuery({
    queryKey: spaceKeys.site(id ?? ""),
    queryFn: () => getSite(id!),
    enabled: Boolean(id),
  });
}

export function useSpaceTree(active: "true" | "false" | "" = "") {
  return useQuery({ queryKey: spaceKeys.tree(active), queryFn: () => getSpaceTree(active) });
}

export function useSpaceNode(id: string | undefined) {
  return useQuery({
    queryKey: spaceKeys.detail(id ?? ""),
    queryFn: () => getSpaceNode(id!),
    enabled: Boolean(id),
  });
}

export function useSpaceImpact(id: string | undefined) {
  return useQuery({
    queryKey: spaceKeys.impact(id ?? ""),
    queryFn: () => getSpaceImpact(id!),
    enabled: Boolean(id),
  });
}

export function useSpaceOptions(siteId?: string, parentId?: string, enabled = true) {
  return useQuery({
    queryKey: spaceKeys.options(siteId, parentId),
    queryFn: () => getSpaceOptions({ siteId, parentId }),
    enabled,
    staleTime: 5 * 60_000,
  });
}

function invalidateSpaceQueries(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ queryKey: spaceKeys.all });
}

export function useCreateSpaceNode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SpaceNodeInput) => createSpaceNode(input),
    onSuccess: () => invalidateSpaceQueries(queryClient),
  });
}

export function useCreateSite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SpaceSiteInput) => createSite(input),
    onSuccess: () => invalidateSpaceQueries(queryClient),
  });
}

export function useUpdateSpaceNode(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SpaceNodeInput) => updateSpaceNode(id, input),
    onSuccess: () => invalidateSpaceQueries(queryClient),
  });
}

export function useUpdateSite(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SpaceSiteInput) => updateSite(id, input),
    onSuccess: () => invalidateSpaceQueries(queryClient),
  });
}

export function useSetSpaceNodeActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setSpaceNodeActive(id, active),
    onSuccess: () => invalidateSpaceQueries(queryClient),
  });
}

export function useSetSiteActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setSiteActive(id, active),
    onSuccess: () => invalidateSpaceQueries(queryClient),
  });
}

export function useDeleteSite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSite(id),
    onSuccess: () => invalidateSpaceQueries(queryClient),
  });
}

export function useDeleteSpaceNode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSpaceNode(id),
    onSuccess: () => invalidateSpaceQueries(queryClient),
  });
}
