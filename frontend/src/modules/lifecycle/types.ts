export type ReparabilityResult = "REPARABLE" | "NO_REPARABLE" | "REPAIR_NOT_VIABLE";
export type RetirementStatus =
  | "PENDIENTE"
  | "EN_EVALUACION"
  | "APROBADA"
  | "RECHAZADA"
  | "SUBSANACION"
  | "PENDIENTE_DISPOSICION"
  | "CERRADA";
export type DisposalMethod = "POR_DEFINIR" | "VENTA" | "RECICLAJE" | "DESECHO" | "DONACION";

export interface TechnicalDiagnosis {
  id: string;
  workOrderId: string;
  workOrderCode: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  evaluatorName: string;
  result: ReparabilityResult;
  description: string;
  probableCause: string;
  operationalRisk: string;
  affectedComponents: string;
  technicalJustification: string;
  estimatedRepairCost: number;
  estimatedCurrentValue: number;
  evidence: string[];
  createdAt: string;
}

export interface RetirementRequest {
  id: string;
  code: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  diagnosisId: string;
  workOrderCode: string;
  diagnosisResult: ReparabilityResult;
  technicalJustification: string;
  evidence: string[];
  estimatedRepairCost: number;
  estimatedCurrentValue: number;
  recommendation: DisposalMethod;
  requestedBy: string;
  supervisorName: string;
  status: RetirementStatus;
  decisionReason?: string;
  decisionBy?: string;
  decisionAt?: string;
  approvedMethod?: DisposalMethod;
  disposal?: {
    effectiveDate: string;
    certificateNumber: string;
    organization: string;
    taxId: string;
    recoveredValue: number;
    evidence: string[];
    qrDestroyed: boolean;
    assignmentsClosed: boolean;
    inventoryUpdated: boolean;
  };
  createdAt: string;
  updatedAt: string;
}

export const retirementStatusLabels: Record<RetirementStatus, string> = {
  PENDIENTE: "Pendiente",
  EN_EVALUACION: "En evaluación",
  APROBADA: "Aprobada",
  RECHAZADA: "Rechazada",
  SUBSANACION: "Requiere subsanación",
  PENDIENTE_DISPOSICION: "Pendiente de disposición",
  CERRADA: "Cerrada",
};

export const disposalLabels: Record<DisposalMethod, string> = {
  POR_DEFINIR: "Por definir",
  VENTA: "Venta",
  RECICLAJE: "Reciclaje",
  DESECHO: "Desecho",
  DONACION: "Donación",
};
