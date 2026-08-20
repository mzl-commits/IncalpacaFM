export const ENTRY_TYPES = ["purchase", "own_creation", "donation", "rental"] as const;
export type EntryType = (typeof ENTRY_TYPES)[number];

export const CONDITIONS = ["Nuevo", "Bueno", "Regular", "Requiere revisión"] as const;
export const CRITICALITIES = ["Baja", "Media", "Alta", "Crítica"] as const;
export type AssigneeType = "person" | "area" | "common_space";

export interface EvidenceItem {
  id: string;
  name: string;
  category: "origin" | "photo" | "certificate" | "manual" | "other";
  mimeType: string;
  size: number;
  dataUrl?: string;
}

export interface AssetTaxonomySnapshot {
  name: string;
  assetType: string;
  category: string;
  subcategory: string;
  specialty: string;
}

export interface AssetEntryDraft {
  currentStep: number;
  entryType: EntryType;
  purchaseOrder: string;
  supplier: string;
  voucherNumber: string;
  acquisitionDate: string;
  cost: string;
  currency: "PEN" | "USD";
  producingArea: string;
  internalOrder: string;
  completionDate: string;
  donor: string;
  donationDocument: string;
  receptionDate: string;
  contractNumber: string;
  rentalStartDate: string;
  rentalEndDate: string;
  name: string;
  description: string;
  brand: string;
  model: string;
  serialNumber: string;
  color: string;
  manufactureYear: string;
  condition: (typeof CONDITIONS)[number];
  effectiveEntryDate: string;
  observations: string;
  taxonomyId: string;
  taxonomyPrefix: string;
  fmCode: string;
  taxonomyVersion: string;
  taxonomySnapshot: AssetTaxonomySnapshot | null;
  assetType: string;
  category: string;
  subcategory: string;
  technicalSpecialty: string;
  criticality: (typeof CRITICALITIES)[number];
  usefulLifeYears: string;
  preventiveFrequencyMonths: string;
  requiresMaintenance: boolean;
  requiresCertification: boolean;
  classificationPending: boolean;
  classificationPendingReason: string;
  zone: string;
  building: string;
  locationArea: string;
  room: string;
  specificLocation: string;
  locationId: string;
  locationMapId: string;
  locationMarkerX: number | null;
  locationMarkerY: number | null;
  locationPending: boolean;
  locationPendingReason: string;
  assigneeType: AssigneeType;
  assigneeId: string;
  assigneeName: string;
  assignmentDate: string;
  assignmentReason: string;
  costCenter: string;
  assignmentObservations: string;
  evidence: EvidenceItem[];
  confirmInspected: boolean;
  confirmAssignment: boolean;
}

export interface RegisteredAsset {
  id: string;
  code: string;
  fmCode: string | null;
  publicToken: string;
  publicUrl: string;
  photoUrl: string | null;
  qrDataUrl: string;
  createdAt: string;
  createdBy: string;
  administrativeStatus: "Registrado";
  operationalStatus: "No evaluado";
  assignmentStatus: "Asignado" | "Entregado" | "Sin asignar" | "En traslado" | "Devuelto";
  locationDetail: {
    id: string;
    zone: string;
    building: string;
    area: string;
    room: string;
    specificLocation: string;
    marker: { mapId: string; mapVersion: number; x: number; y: number } | null;
  } | null;
  draft: AssetEntryDraft;
}

export function getAssetDisplayCode(asset: Pick<RegisteredAsset, "code" | "fmCode">) {
  return asset.fmCode || asset.code;
}

const today = new Date().toISOString().slice(0, 10);

export const emptyAssetEntryDraft: AssetEntryDraft = {
  currentStep: 0,
  entryType: "purchase",
  purchaseOrder: "",
  supplier: "",
  voucherNumber: "",
  acquisitionDate: "",
  cost: "",
  currency: "PEN",
  producingArea: "",
  internalOrder: "",
  completionDate: "",
  donor: "",
  donationDocument: "",
  receptionDate: "",
  contractNumber: "",
  rentalStartDate: "",
  rentalEndDate: "",
  name: "",
  description: "",
  brand: "",
  model: "",
  serialNumber: "",
  color: "",
  manufactureYear: new Date().getFullYear().toString(),
  condition: "Nuevo",
  effectiveEntryDate: today,
  observations: "",
  taxonomyId: "",
  taxonomyPrefix: "",
  fmCode: "",
  taxonomyVersion: "",
  taxonomySnapshot: null,
  assetType: "",
  category: "",
  subcategory: "",
  technicalSpecialty: "",
  criticality: "Media",
  usefulLifeYears: "",
  preventiveFrequencyMonths: "",
  requiresMaintenance: false,
  requiresCertification: false,
  classificationPending: false,
  classificationPendingReason: "",
  zone: "",
  building: "",
  locationArea: "",
  room: "",
  specificLocation: "",
  locationId: "",
  locationMapId: "",
  locationMarkerX: null,
  locationMarkerY: null,
  locationPending: false,
  locationPendingReason: "",
  assigneeType: "person",
  assigneeId: "",
  assigneeName: "",
  assignmentDate: today,
  assignmentReason: "",
  costCenter: "",
  assignmentObservations: "",
  evidence: [],
  confirmInspected: false,
  confirmAssignment: false,
};

export const entryTypeLabels: Record<EntryType, string> = {
  purchase: "Compra",
  own_creation: "Creación propia",
  donation: "Regalo o donación",
  rental: "Alquiler",
};

export const assigneeTypeLabels: Record<AssigneeType, string> = {
  person: "Persona",
  area: "Área",
  common_space: "Espacio común",
};

export const locationTaxonomy = {
  "Zona Industrial": {
    "Edificio Administrativo": {
      Sistemas: ["Oficina 204", "Almacén TI"],
      Finanzas: ["Oficina 105", "Archivo contable"],
    },
    "Planta Principal": {
      Producción: ["Línea 1", "Línea 2", "Control de calidad"],
      Mantenimiento: ["Taller mecánico", "Taller eléctrico"],
    },
  },
  "Zona Comercial": {
    "Centro de distribución": {
      Logística: ["Recepción", "Almacén central", "Despacho"],
    },
  },
} as const;

export const assignableOptions: Record<
  AssigneeType,
  Array<{ id: string; name: string; detail: string }>
> = {
  person: [
    { id: "P-0142", name: "Ana Torres", detail: "Sistemas · Analista de infraestructura" },
    { id: "P-0277", name: "Marco Quispe", detail: "Mantenimiento · Técnico mecánico" },
    { id: "P-0319", name: "Rosa Medina", detail: "Facility Management · Supervisora" },
  ],
  area: [
    { id: "A-SIS", name: "Área de Sistemas", detail: "Centro de costo 4102" },
    { id: "A-MAN", name: "Área de Mantenimiento", detail: "Centro de costo 4201" },
    { id: "A-LOG", name: "Área de Logística", detail: "Centro de costo 4305" },
  ],
  common_space: [
    { id: "E-COM-01", name: "Sala de reuniones principal", detail: "Edificio Administrativo" },
    { id: "E-COM-02", name: "Comedor de planta", detail: "Planta Principal" },
    { id: "E-COM-03", name: "Almacén de uso común", detail: "Centro de distribución" },
  ],
};
