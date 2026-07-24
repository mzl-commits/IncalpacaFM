import QRCode from "qrcode";
import { offlineDb } from "@/offline/db";
import type { AssetEntryDraft, RegisteredAsset } from "@/modules/assets/entryModel";

const DRAFT_ID = "asset-entry-current";
const REGISTERED_KEY = "sgtb_registered_assets";

export async function loadAssetEntryDraft(): Promise<AssetEntryDraft | null> {
  const item = await offlineDb.drafts.get(DRAFT_ID);
  return (item?.payload as AssetEntryDraft | undefined) ?? null;
}

export async function saveAssetEntryDraft(draft: AssetEntryDraft) {
  await offlineDb.drafts.put({
    id: DRAFT_ID,
    domain: "assets",
    payload: draft,
    updatedAt: new Date().toISOString(),
    syncStatus: navigator.onLine ? "draft" : "pending",
  });
}

export async function clearAssetEntryDraft() {
  await offlineDb.drafts.delete(DRAFT_ID);
}

export function listRegisteredAssets(): RegisteredAsset[] {
  try {
    return JSON.parse(localStorage.getItem(REGISTERED_KEY) ?? "[]") as RegisteredAsset[];
  } catch {
    return [];
  }
}

export async function registerAsset(draft: AssetEntryDraft): Promise<RegisteredAsset> {
  const existing = listRegisteredAssets();
  const sequence = String(existing.length + 188).padStart(6, "0");
  const code = `INC-BIEN-${new Date().getFullYear()}-${sequence}`;
  const publicToken = crypto.randomUUID().replaceAll("-", "").slice(0, 20);
  const publicUrl = `${window.location.origin}/q/${publicToken}`;
  const qrDataUrl = await QRCode.toDataURL(publicUrl, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 420,
    color: { dark: "#001e40", light: "#ffffff" },
  });

  const registered: RegisteredAsset = {
    id: crypto.randomUUID(),
    code,
    publicToken,
    publicUrl,
    qrDataUrl,
    createdAt: new Date().toISOString(),
    createdBy: "Facility Management",
    administrativeStatus: "Registrado",
    operationalStatus: "No evaluado",
    assignmentStatus: draft.assigneeId ? "Asignado" : "Pendiente",
    draft,
  };

  localStorage.setItem(REGISTERED_KEY, JSON.stringify([registered, ...existing]));
  window.dispatchEvent(new CustomEvent("sgtb:asset-registered"));
  await clearAssetEntryDraft();
  return registered;
}
