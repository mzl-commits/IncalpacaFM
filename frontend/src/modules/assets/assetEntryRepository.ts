import QRCode from "qrcode";
import { offlineDb } from "@/offline/db";
import { api } from "@/services/api";
import {
  emptyAssetEntryDraft,
  type AssetEntryDraft,
  type RegisteredAsset,
} from "@/modules/assets/entryModel";

const DRAFT_ID = "asset-entry-current";

type AssetApiRecord = {
  id: string;
  code: string;
  public_token: string;
  public_url: string;
  entry_type: AssetEntryDraft["entryType"];
  name: string;
  description: string;
  brand: string;
  model: string;
  serial_number: string | null;
  condition: AssetEntryDraft["condition"];
  criticality: AssetEntryDraft["criticality"];
  created_at: string;
  registered_by_name: string;
  administrative_status: "Registrado";
  operational_status: "No evaluado";
  assignment_status: RegisteredAsset["assignmentStatus"];
  entry_payload: AssetEntryDraft;
};

function mapAsset(item: AssetApiRecord): RegisteredAsset {
  return {
    id: item.id,
    code: item.code,
    publicToken: item.public_token,
    publicUrl: item.public_url,
    qrDataUrl: "",
    createdAt: item.created_at,
    createdBy: item.registered_by_name,
    administrativeStatus: item.administrative_status,
    operationalStatus: item.operational_status,
    assignmentStatus: item.assignment_status,
    draft: {
      ...emptyAssetEntryDraft,
      ...item.entry_payload,
      name: item.name,
      description: item.description,
      brand: item.brand,
      model: item.model,
      serialNumber: item.serial_number ?? "",
      condition: item.condition,
      criticality: item.criticality,
      entryType: item.entry_type,
    },
  };
}

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

export async function listRegisteredAssets(): Promise<RegisteredAsset[]> {
  const { data } = await api.get<AssetApiRecord[]>("/assets/");
  return data.map(mapAsset);
}

export async function getPublicAsset(token: string) {
  const { data } = await api.get(`/public/assets/${token}/`);
  return data as {
    code: string;
    name: string;
    brand: string;
    model: string;
    condition: string;
    administrative_status: string;
    operational_status: string;
    classification: string;
    general_location: string;
    updated_at: string;
  };
}

export async function registerAsset(draft: AssetEntryDraft): Promise<RegisteredAsset> {
  const { data } = await api.post<AssetApiRecord>(
    "/assets/",
    {
      entry_type: draft.entryType,
      name: draft.name,
      description: draft.description,
      brand: draft.brand,
      model: draft.model,
      serial_number: draft.serialNumber || null,
      condition: draft.condition,
      entry_payload: draft,
    },
    { headers: { "X-Frontend-Origin": window.location.origin } },
  );
  const registered = mapAsset(data);
  registered.qrDataUrl = await QRCode.toDataURL(registered.publicUrl, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 420,
    color: { dark: "#001e40", light: "#ffffff" },
  });
  await clearAssetEntryDraft();
  return registered;
}
