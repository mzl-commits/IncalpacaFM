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
  fm_code: string | null;
  display_code?: string;
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
  taxonomy_detail?: {
    id: string;
    prefix: string;
    name: string;
    asset_type: string;
    category: string;
    subcategory: string;
    specialty: string;
    source_version?: string;
  } | null;
  location_detail?: {
    id: string;
    zone: string;
    building: string;
    area: string;
    room: string;
    specific_location: string;
    marker: { map_id: string; map_version: number; x: string; y: string } | null;
  } | null;
};

function mapAsset(item: AssetApiRecord): RegisteredAsset {
  return {
    id: item.id,
    code: item.code,
    fmCode: item.fm_code ?? (item.display_code && item.display_code !== item.code ? item.display_code : null),
    publicToken: item.public_token,
    publicUrl: item.public_url,
    qrDataUrl: "",
    createdAt: item.created_at,
    createdBy: item.registered_by_name,
    administrativeStatus: item.administrative_status,
    operationalStatus: item.operational_status,
    assignmentStatus: item.assignment_status,
    locationDetail: item.location_detail ? {
      id: item.location_detail.id,
      zone: item.location_detail.zone,
      building: item.location_detail.building,
      area: item.location_detail.area,
      room: item.location_detail.room,
      specificLocation: item.location_detail.specific_location,
      marker: item.location_detail.marker ? {
        mapId: item.location_detail.marker.map_id,
        mapVersion: item.location_detail.marker.map_version,
        x: Number(item.location_detail.marker.x),
        y: Number(item.location_detail.marker.y),
      } : null,
    } : null,
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
      taxonomyId: item.taxonomy_detail?.id ?? item.entry_payload.taxonomyId ?? "",
      taxonomyPrefix: item.taxonomy_detail?.prefix ?? item.entry_payload.taxonomyPrefix ?? "",
      taxonomyVersion:
        item.taxonomy_detail?.source_version ?? item.entry_payload.taxonomyVersion ?? "",
      taxonomySnapshot: item.taxonomy_detail
        ? {
            name: item.taxonomy_detail.name,
            assetType: item.taxonomy_detail.asset_type,
            category: item.taxonomy_detail.category,
            subcategory: item.taxonomy_detail.subcategory,
            specialty: item.taxonomy_detail.specialty,
          }
        : item.entry_payload.taxonomySnapshot ?? null,
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
    fm_code?: string | null;
    display_code?: string;
    internal_code?: string;
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
      taxonomy_id: draft.classificationPending ? null : draft.taxonomyId,
      location_id: draft.locationPending ? null : draft.locationId || null,
      location_map_id: draft.locationPending ? null : draft.locationMapId || null,
      location_marker_x: draft.locationPending ? null : draft.locationMarkerX,
      location_marker_y: draft.locationPending ? null : draft.locationMarkerY,
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
