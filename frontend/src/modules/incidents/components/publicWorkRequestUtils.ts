import type { SystemUser } from '@/modules/accounts/types';

import { createClientId } from "@/utils/uuid";

export type ImpactAnswer = "" | "SI" | "NO";
export type AffectedPeople = "" | "SOLO_YO" | "VARIAS_PERSONAS" | "TODA_EL_AREA";
export type SuggestedPriority = "NORMAL" | "URGENTE" | "EMERGENCIA";

export interface PublicLocationOption {
  id: string;
  code: string;
  site: string;
  zone: string;
  building: string;
  area: string;
  room: string;
  specificLocation: string;
  displayName: string;
}

export interface PublicAssetContext {
  displayCode: string;
  name: string;
  photoUrl: string | null;
  generalLocation: string;
  locationId?: string;
  site?: string;
  zone?: string;
  building?: string;
  area?: string;
  room?: string;
}
export interface PublicRequestFormState {
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string;
  requesterDni: string;
  requesterWorkerCode: string;
  locationId: string;
  site: string;
  zone: string;
  building: string;
  area: string;
  room: string;
  description: string;
  issueCategory: string;
  otherIssueCategoryDetail: string;
  assetTypeDetail: string;
  assetCondition: string;
  startedWhen: string;
  photoName: string;
  cannotAttachPhoto: boolean;
  noPhotoReason: string;
  stopsWork: ImpactAnswer;
  safetyRisk: ImpactAnswer;
  essentialService: ImpactAnswer;
  biggerDamageRisk: ImpactAnswer;
  affectedPeople: AffectedPeople;
}

export const initialForm: PublicRequestFormState = {
  requesterName: "",
  requesterEmail: "",
  requesterPhone: "",
  requesterDni: "",
  requesterWorkerCode: "",
  locationId: "",
  site: "",
  zone: "",
  building: "",
  area: "",
  room: "",
  description: "",
  issueCategory: "",
  otherIssueCategoryDetail: "",
  assetTypeDetail: "",
  assetCondition: "",
  startedWhen: "",
  photoName: "",
  cannotAttachPhoto: false,
  noPhotoReason: "",
  stopsWork: "",
  safetyRisk: "",
  essentialService: "",
  biggerDamageRisk: "",
  affectedPeople: "",
};

export function getLoggedRequester(): SystemUser | null {
  const raw = sessionStorage.getItem("sgtb_current_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SystemUser;
  } catch {
    return null;
  }
}


export const yesNoOptions = [
  { value: "SI", label: "Si" },
  { value: "NO", label: "No" },
] as const;

export const priorityLabels: Record<SuggestedPriority, string> = {
  NORMAL: "Normal",
  URGENTE: "Urgente",
  EMERGENCIA: "Emergencia",
};

export function calculateSuggestedPriority(form: PublicRequestFormState): SuggestedPriority {
  if (form.safetyRisk === "SI") return "EMERGENCIA";

  const urgentSignals = [
    form.stopsWork === "SI",
    form.essentialService === "SI",
    form.biggerDamageRisk === "SI",
    form.affectedPeople === "TODA_EL_AREA",
  ].filter(Boolean).length;

  if (urgentSignals >= 2 || form.affectedPeople === "VARIAS_PERSONAS") return "URGENTE";

  return "NORMAL";
}

export function getPriorityReasons(form: PublicRequestFormState) {
  const reasons: string[] = [];
  if (form.stopsWork === "SI") reasons.push("Impide realizar actividades normalmente");
  if (form.safetyRisk === "SI") reasons.push("Existe riesgo para seguridad o salud");
  if (form.essentialService === "SI") reasons.push("Afecta un equipo o servicio indispensable");
  if (form.biggerDamageRisk === "SI") reasons.push("Puede generar daños mayores");
  if (form.affectedPeople === "VARIAS_PERSONAS") reasons.push("Afecta a varias personas");
  if (form.affectedPeople === "TODA_EL_AREA") reasons.push("Afecta a toda el area");

  return reasons;
}
export function getSubmitErrorMessage(error: unknown) {
  const response = error && typeof error === "object" && "response" in error
    ? (error as { response?: { data?: unknown } }).response
    : undefined;
  const data = response?.data;
  if (data && typeof data === "object") {
    const values = Object.values(data as Record<string, unknown>).flat();
    const first = values.find((value) => typeof value === "string");
    if (typeof first === "string") return first;
  }
  return "No se pudo registrar la solicitud. Intenta nuevamente.";
}
