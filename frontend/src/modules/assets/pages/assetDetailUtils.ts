import type { AssetDetailRecord } from "@/modules/assets/assetDetailRepository";

export function displayCode(asset: AssetDetailRecord) {
  return asset.display_code || asset.fm_code || asset.code;
}

export function toInputDate(value: string | null) {
  if (!value) return "";
  try {
    return new Date(value).toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

export function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
}

export type DetailTab = "overview" | "responsibles" | "repairs" | "qr";
export type ResponsibleItem = AssetDetailRecord["responsible_history"][number];
