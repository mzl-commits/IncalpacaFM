import { api } from "@/services/api";
import type { LocationMapSummary, LocationOption } from "./locationMapTypes";

type ApiLocationMap = {
  id: string;
  version: number;
  original_filename: string;
  image_sha256: string;
  width: number;
  height: number;
  description: string;
  active: boolean;
  created_at: string;
  image_url: string;
};

type ApiLocation = {
  id: string;
  location_code: string;
  source_company: string;
  source_version: string;
  requires_review: boolean;
  review_notes: string;
  zone: string;
  building: string;
  area: string;
  room: string;
  specific_location: string;
  common_space: boolean;
  active: boolean;
  display_name: string;
  active_map: ApiLocationMap | null;
};

function mapLocationMap(item: ApiLocationMap): LocationMapSummary {
  return {
    id: item.id,
    version: item.version,
    originalFilename: item.original_filename,
    imageSha256: item.image_sha256,
    width: item.width,
    height: item.height,
    description: item.description,
    active: item.active,
    createdAt: item.created_at,
    imageUrl: item.image_url,
  };
}

function mapLocation(item: ApiLocation): LocationOption {
  return {
    id: item.id,
    locationCode: item.location_code,
    sourceCompany: item.source_company,
    sourceVersion: item.source_version,
    requiresReview: item.requires_review,
    reviewNotes: item.review_notes,
    zone: item.zone,
    building: item.building,
    area: item.area,
    room: item.room,
    specificLocation: item.specific_location,
    commonSpace: item.common_space,
    active: item.active,
    displayName: item.display_name,
    activeMap: item.active_map ? mapLocationMap(item.active_map) : null,
  };
}

export async function listLocations(): Promise<LocationOption[]> {
  const { data } = await api.get<ApiLocation[]>("/locations/");
  return data.map(mapLocation);
}

export async function uploadLocationMap(input: {
  locationId: string;
  image: File;
  description: string;
}): Promise<LocationMapSummary> {
  const body = new FormData();
  body.append("location_id", input.locationId);
  body.append("image", input.image);
  body.append("description", input.description);
  const { data } = await api.post<ApiLocationMap>("/location-maps/", body, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return mapLocationMap(data);
}

export async function getLocationMapImage(id: string): Promise<string> {
  const { data } = await api.get<Blob>(`/location-maps/${id}/image/`, {
    responseType: "blob",
  });
  return URL.createObjectURL(data);
}

export async function removeLocationMap(id: string): Promise<void> {
  await api.delete(`/location-maps/${id}/`);
}
