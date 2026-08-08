import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createModel,
  deleteModel,
  getModel,
  listModels,
  updateModel,
  type AssetModel,
} from "./modelRepository";

export const modelKeys = {
  all: ["asset_models"] as const,
  list: () => [...modelKeys.all, "list"] as const,
  detail: (id: string) => [...modelKeys.all, "detail", id] as const,
};

export function useModelList() {
  return useQuery({
    queryKey: modelKeys.list(),
    queryFn: listModels,
  });
}

export function useModel(id: string | undefined) {
  return useQuery({
    queryKey: modelKeys.detail(id ?? ""),
    queryFn: () => getModel(id!),
    enabled: Boolean(id),
  });
}

export function useCreateModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<AssetModel, "id" | "createdAt">) => createModel(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: modelKeys.all }),
  });
}

export function useUpdateModel(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<AssetModel>) => updateModel(id, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: modelKeys.all }),
  });
}

export function useDeleteModel() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteModel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: modelKeys.all }),
  });
}
