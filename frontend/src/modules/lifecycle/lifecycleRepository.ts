import { api } from "@/services/api";
import type { DisposalMethod, RetirementRequest, TechnicalDiagnosis } from "./types";

type DiagnosisApi = {
  id: string; work_order_id: string; work_order_code: string; asset: string;
  asset_code: string; asset_display_code?: string | null; asset_name: string; evaluator_name: string;
  result: TechnicalDiagnosis["result"]; description: string; probable_cause: string;
  operational_risk: string; affected_components: string; technical_justification: string;
  estimated_repair_cost: string; estimated_current_value: string; evidence: string[];
  created_at: string;
};

type RetirementApi = {
  id: string; code: string; asset: string; asset_code: string; asset_display_code?: string | null; asset_name: string;
  diagnosis: string; work_order_code: string; diagnosis_result: RetirementRequest["diagnosisResult"];
  technical_justification: string; evidence: string[]; estimated_repair_cost: string;
  estimated_current_value: string; recommendation: DisposalMethod; requested_by: string;
  supervisor_name: string; status: RetirementRequest["status"]; decision_reason: string;
  decision_by: string; decision_at: string | null; approved_method: DisposalMethod | "";
  disposal: RetirementRequest["disposal"] | null; created_at: string; updated_at: string;
};

function mapDiagnosis(item: DiagnosisApi): TechnicalDiagnosis {
  return {
    id: item.id, workOrderId: item.work_order_id, workOrderCode: item.work_order_code,
    assetId: item.asset, assetCode: item.asset_display_code || item.asset_code, assetName: item.asset_name,
    evaluatorName: item.evaluator_name, result: item.result, description: item.description,
    probableCause: item.probable_cause, operationalRisk: item.operational_risk,
    affectedComponents: item.affected_components, technicalJustification: item.technical_justification,
    estimatedRepairCost: Number(item.estimated_repair_cost), estimatedCurrentValue: Number(item.estimated_current_value),
    evidence: item.evidence, createdAt: item.created_at,
  };
}

function mapRequest(item: RetirementApi): RetirementRequest {
  return {
    id: item.id, code: item.code, assetId: item.asset, assetCode: item.asset_display_code || item.asset_code,
    assetName: item.asset_name, diagnosisId: item.diagnosis, workOrderCode: item.work_order_code,
    diagnosisResult: item.diagnosis_result, technicalJustification: item.technical_justification,
    evidence: item.evidence, estimatedRepairCost: Number(item.estimated_repair_cost),
    estimatedCurrentValue: Number(item.estimated_current_value), recommendation: item.recommendation,
    requestedBy: item.requested_by, supervisorName: item.supervisor_name, status: item.status,
    decisionReason: item.decision_reason || undefined, decisionBy: item.decision_by || undefined,
    decisionAt: item.decision_at ?? undefined, approvedMethod: item.approved_method || undefined,
    disposal: item.disposal ?? undefined, createdAt: item.created_at, updatedAt: item.updated_at,
  };
}

export async function listDiagnoses() {
  const { data } = await api.get<DiagnosisApi[]>("/lifecycle/diagnoses/");
  return data.map(mapDiagnosis);
}

export async function getDiagnosisByWorkOrder(workOrderId: string) {
  return (await listDiagnoses()).find((item) => item.workOrderId === workOrderId);
}

export async function saveDiagnosis(input: Omit<TechnicalDiagnosis, "id" | "createdAt">, existingId?: string) {
  const payload = {
    work_order_id: input.workOrderId, work_order_code: input.workOrderCode, asset: input.assetId,
    evaluator_name: input.evaluatorName, result: input.result, description: input.description,
    probable_cause: input.probableCause, operational_risk: input.operationalRisk,
    affected_components: input.affectedComponents, technical_justification: input.technicalJustification,
    estimated_repair_cost: input.estimatedRepairCost, estimated_current_value: input.estimatedCurrentValue,
    evidence: input.evidence,
  };
  const { data } = existingId
    ? await api.patch<DiagnosisApi>(`/lifecycle/diagnoses/${existingId}/`, payload)
    : await api.post<DiagnosisApi>("/lifecycle/diagnoses/", payload);
  return mapDiagnosis(data);
}

export async function listRetirementRequests() {
  const { data } = await api.get<RetirementApi[]>("/lifecycle/retirement-requests/");
  return data.map(mapRequest);
}

export async function getRetirementRequest(id: string) {
  const { data } = await api.get<RetirementApi>(`/lifecycle/retirement-requests/${id}/`);
  return mapRequest(data);
}

export async function getRetirementRequestByDiagnosis(diagnosisId: string) {
  return (await listRetirementRequests()).find((item) => item.diagnosisId === diagnosisId);
}

export async function requestRetirementEvaluation(diagnosisId: string) {
  const { data } = await api.post<RetirementApi>(
    `/lifecycle/diagnoses/${diagnosisId}/request-retirement/`,
  );
  return mapRequest(data);
}

export async function createRetirementRequest(
  diagnosis: TechnicalDiagnosis,
  input: { recommendation: DisposalMethod; supervisorName: string; requestedBy: string },
) {
  const { data } = await api.post<RetirementApi>("/lifecycle/retirement-requests/", {
    asset: diagnosis.assetId, diagnosis: diagnosis.id, recommendation: input.recommendation,
    supervisor_name: input.supervisorName, requested_by: input.requestedBy,
  });
  return mapRequest(data);
}

export async function updateRetirementRequest(id: string, changes: Partial<RetirementRequest>) {
  const payload: Record<string, unknown> = {};
  if (changes.status) payload.status = changes.status;
  if (changes.decisionReason !== undefined) payload.decision_reason = changes.decisionReason;
  if (changes.decisionBy !== undefined) payload.decision_by = changes.decisionBy;
  if (changes.approvedMethod !== undefined) payload.approved_method = changes.approvedMethod;
  if (changes.disposal !== undefined) payload.disposal = changes.disposal;
  const { data } = await api.patch<RetirementApi>(`/lifecycle/retirement-requests/${id}/`, payload);
  return mapRequest(data);
}
