import { api } from "@/services/api";

export interface WorkOrderMaterial {
  id: string;
  workOrderCode: string;
  material: number;
  materialNombre: string;
  materialCodigo: string;
  materialPrecio: string | null;
  materialStock: number;
  cantidad: number;
  tipo: "USADO" | "NECESARIO_NO_BLOQUEANTE";
  tipoLabel: string;
  esBloqueante: boolean;
  registradoPorNombre: string;
  creadoEn: string;
  actualizadoEn: string;
}

export interface WorkOrderMaterialPayload {
  material: number;
  cantidad: number;
  tipo: "USADO" | "NECESARIO_NO_BLOQUEANTE";
}

export async function listWorkOrderMateriales(workOrderId: string): Promise<WorkOrderMaterial[]> {
  const { data } = await api.get<WorkOrderMaterial[]>(`/work-orders/${workOrderId}/materiales/`);
  return data;
}

export async function addWorkOrderMaterial(
  workOrderId: string,
  payload: WorkOrderMaterialPayload,
): Promise<WorkOrderMaterial> {
  const { data } = await api.post<WorkOrderMaterial>(`/work-orders/${workOrderId}/materiales/`, payload);
  return data;
}

export async function updateWorkOrderMaterial(
  workOrderId: string,
  materialId: string,
  payload: Partial<WorkOrderMaterialPayload>,
): Promise<WorkOrderMaterial> {
  const { data } = await api.patch<WorkOrderMaterial>(
    `/work-orders/${workOrderId}/materiales/${materialId}/`,
    payload,
  );
  return data;
}

export async function deleteWorkOrderMaterial(workOrderId: string, materialId: string): Promise<void> {
  await api.delete(`/work-orders/${workOrderId}/materiales/${materialId}/`);
}

export async function marcarMaterialBloqueante(
  workOrderId: string,
  materialId: string,
): Promise<WorkOrderMaterial> {
  const { data } = await api.post<WorkOrderMaterial>(
    `/work-orders/${workOrderId}/materiales/${materialId}/marcar-bloqueante/`,
  );
  return data;
}

export async function autocompletarCostosMateriales(workOrderId: string) {
  const { data } = await api.post(`/work-orders/${workOrderId}/costs/autocompletar-materiales/`);
  return data;
}

export async function updateWorkOrderCostAmount(
  workOrderId: string,
  costId: string,
  amount: number | null,
): Promise<{ id: string; category: string; categoryLabel: string; description: string; amount: string | null; createdAt: string }> {
  const { data } = await api.patch(`/work-orders/${workOrderId}/costs/${costId}/`, { amount });
  return data;
}
