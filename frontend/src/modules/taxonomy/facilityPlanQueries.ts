import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getFacilityPlan,
  getFacilityPlanImage,
  listFacilityPlans,
  reconcileFacilityPlan,
} from "./facilityPlanRepository";

export const facilityPlanKeys = {
  all: ["facility-plans"] as const,
  list: () => [...facilityPlanKeys.all, "list"] as const,
  detail: (id: string) => [...facilityPlanKeys.all, "detail", id] as const,
  image: (id: string, version: string) =>
    [...facilityPlanKeys.all, "image", id, version] as const,
};

export function useFacilityPlans() {
  return useQuery({ queryKey: facilityPlanKeys.list(), queryFn: listFacilityPlans });
}

export function useFacilityPlan(id: string | undefined) {
  return useQuery({
    queryKey: facilityPlanKeys.detail(id ?? ""),
    queryFn: () => getFacilityPlan(id!),
    enabled: Boolean(id),
  });
}

export function useFacilityPlanImage(
  id: string | undefined,
  version: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: facilityPlanKeys.image(id ?? "", version ?? ""),
    queryFn: () => getFacilityPlanImage(id!),
    enabled: Boolean(id && enabled),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useReconcileFacilityPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reconcileFacilityPlan(id),
    onSuccess: (plan) => {
      queryClient.setQueryData(facilityPlanKeys.detail(plan.id), plan);
      queryClient.invalidateQueries({ queryKey: facilityPlanKeys.list() });
    },
  });
}
