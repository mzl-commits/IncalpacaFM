import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getFmCodeSummary, issueFmCode, listFmCodeAssets } from "./fmCodeRepository";
import { taxonomyKeys } from "./taxonomyQueries";
import type { FmCodeFilters } from "./types";

export const fmCodeKeys = {
  all: ["fm-codes"] as const,
  assets: (filters: FmCodeFilters) => [...fmCodeKeys.all, "assets", filters] as const,
  summary: () => [...fmCodeKeys.all, "summary"] as const,
};

export function useFmCodeAssets(filters: FmCodeFilters) {
  return useQuery({
    queryKey: fmCodeKeys.assets(filters),
    queryFn: () => listFmCodeAssets(filters),
    placeholderData: (previous) => previous,
  });
}

export function useFmCodeSummary() {
  return useQuery({
    queryKey: fmCodeKeys.summary(),
    queryFn: getFmCodeSummary,
  });
}

export function useIssueFmCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ assetId, taxonomyId }: { assetId: string; taxonomyId: string }) =>
      issueFmCode(assetId, taxonomyId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: fmCodeKeys.all });
      void queryClient.invalidateQueries({ queryKey: taxonomyKeys.all });
    },
  });
}
