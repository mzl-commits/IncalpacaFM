import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  activateTaxonomy,
  createTaxonomy,
  deactivateTaxonomy,
  getTaxonomy,
  listTaxonomies,
  loadActiveTaxonomyOptions,
  updateTaxonomy,
} from "./taxonomyRepository";
import type { TaxonomyFilters, TaxonomyInput } from "./types";

export const taxonomyKeys = {
  all: ["taxonomies"] as const,
  lists: () => [...taxonomyKeys.all, "list"] as const,
  list: (filters: TaxonomyFilters) => [...taxonomyKeys.lists(), filters] as const,
  options: () => [...taxonomyKeys.all, "options"] as const,
  detail: (id: string) => [...taxonomyKeys.all, "detail", id] as const,
};

export function useTaxonomyCatalog(filters: TaxonomyFilters) {
  return useQuery({
    queryKey: taxonomyKeys.list(filters),
    queryFn: () => listTaxonomies(filters),
  });
}

export function useTaxonomyOptions() {
  return useQuery({
    queryKey: taxonomyKeys.options(),
    queryFn: loadActiveTaxonomyOptions,
    staleTime: 5 * 60_000,
  });
}

export function useTaxonomy(id: string | undefined) {
  return useQuery({
    queryKey: taxonomyKeys.detail(id ?? ""),
    queryFn: () => getTaxonomy(id!),
    enabled: Boolean(id),
  });
}

export function useCreateTaxonomy() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TaxonomyInput) => createTaxonomy(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taxonomyKeys.all }),
  });
}

export function useUpdateTaxonomy(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TaxonomyInput) => updateTaxonomy(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taxonomyKeys.all }),
  });
}

export function useSetTaxonomyActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? activateTaxonomy(id) : deactivateTaxonomy(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taxonomyKeys.all }),
  });
}
