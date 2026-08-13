import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getLocationMapImage,
  listLocations,
  removeLocationMap,
  updateLocationArea,
  updateBuildingArea,
  uploadLocationMap,
} from "./locationMapRepository";

export const locationMapKeys = {
  all: ["location-maps"] as const,
  locations: () => [...locationMapKeys.all, "locations"] as const,
  image: (id: string) => [...locationMapKeys.all, "image", id] as const,
};

export function useLocations() {
  return useQuery({
    queryKey: locationMapKeys.locations(),
    queryFn: listLocations,
  });
}

export function useLocationMapImage(id: string | undefined) {
  return useQuery({
    queryKey: locationMapKeys.image(id ?? ""),
    queryFn: () => getLocationMapImage(id!),
    enabled: Boolean(id),
    staleTime: Number.POSITIVE_INFINITY,
  });
}

export function useUploadLocationMap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadLocationMap,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: locationMapKeys.locations() });
    },
  });
}

export function useRemoveLocationMap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: removeLocationMap,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: locationMapKeys.locations() });
    },
  });
}

export function useUpdateLocationArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ locationId, squareMeters }: { locationId: string; squareMeters: number | null }) =>
      updateLocationArea(locationId, squareMeters),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: locationMapKeys.locations() });
    },
  });
}

export function useUpdateBuildingArea() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ locationId, squareMeters }: { locationId: string; squareMeters: number | null }) =>
      updateBuildingArea(locationId, squareMeters),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: locationMapKeys.locations() });
    },
  });
}
