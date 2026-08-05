import type { AssetEntryDraft } from "@/modules/assets/entryModel";

export type EntryErrors = Record<string, string>;

const required = (value: string, message: string, errors: EntryErrors, key: string) => {
  if (!value.trim()) errors[key] = message;
};

export function validateEntryStep(step: number, draft: AssetEntryDraft): EntryErrors {
  const errors: EntryErrors = {};

  if (step === 0) {
    if (draft.entryType === "purchase") {
      required(draft.purchaseOrder, "Ingresa la orden de compra.", errors, "purchaseOrder");
      required(draft.supplier, "Selecciona o ingresa el proveedor.", errors, "supplier");
      required(draft.acquisitionDate, "Selecciona la fecha de adquisición.", errors, "acquisitionDate");
      if (!draft.cost || Number(draft.cost) <= 0) errors.cost = "El costo debe ser mayor que cero.";
    }
    if (draft.entryType === "own_creation") {
      required(draft.producingArea, "Ingresa el área responsable.", errors, "producingArea");
      required(draft.internalOrder, "Ingresa el proyecto u orden interna.", errors, "internalOrder");
      required(draft.completionDate, "Selecciona la fecha de finalización.", errors, "completionDate");
    }
    if (draft.entryType === "donation") {
      required(draft.donor, "Ingresa el nombre del donante.", errors, "donor");
      required(draft.donationDocument, "Ingresa el documento de donación.", errors, "donationDocument");
      required(draft.receptionDate, "Selecciona la fecha de recepción.", errors, "receptionDate");
    }
    if (draft.entryType === "rental") {
      required(draft.supplier, "Ingresa el proveedor.", errors, "supplier");
      required(draft.contractNumber, "Ingresa el número de contrato.", errors, "contractNumber");
      required(draft.rentalStartDate, "Selecciona la fecha de inicio.", errors, "rentalStartDate");
      required(draft.rentalEndDate, "Selecciona la fecha de término.", errors, "rentalEndDate");
      if (draft.rentalStartDate && draft.rentalEndDate && draft.rentalEndDate <= draft.rentalStartDate) {
        errors.rentalEndDate = "La fecha de término debe ser posterior al inicio.";
      }
    }
  }

  if (step === 1) {
    required(draft.name, "Ingresa el nombre del bien.", errors, "name");
    required(draft.description, "Ingresa una descripción.", errors, "description");
    required(draft.effectiveEntryDate, "Selecciona la fecha efectiva.", errors, "effectiveEntryDate");
    if (draft.manufactureYear) {
      const year = Number(draft.manufactureYear);
      if (year < 1950 || year > new Date().getFullYear() + 1) errors.manufactureYear = "Ingresa un año válido.";
    }
    if (!draft.evidence.some((item) => item.category === "photo")) {
      errors.photo = "Adjunta al menos una fotografía del bien.";
    }
    if (["SN-LEN-T14-001", "MON-IND-027"].includes(draft.serialNumber.trim().toUpperCase())) {
      errors.serialNumber = "Este número de serie coincide con un bien existente.";
    }
  }

  if (step === 2) {
    if (!draft.classificationPending) {
      required(draft.taxonomyId, "Selecciona una taxonomía activa.", errors, "taxonomyId");
    } else {
      required(draft.classificationPendingReason, "Justifica por qué la clasificación está pendiente.", errors, "classificationPendingReason");
    }
    if (draft.usefulLifeYears && Number(draft.usefulLifeYears) <= 0) errors.usefulLifeYears = "Debe ser mayor que cero.";
    if (draft.requiresMaintenance && (!draft.preventiveFrequencyMonths || Number(draft.preventiveFrequencyMonths) <= 0)) {
      errors.preventiveFrequencyMonths = "Define la frecuencia preventiva.";
    }
  }

  if (step === 3) {
    if (!draft.locationPending) {
      required(draft.zone, "Selecciona la zona.", errors, "zone");
      required(draft.building, "Selecciona el edificio.", errors, "building");
      required(draft.locationArea, "Selecciona el área.", errors, "locationArea");
      required(draft.room, "Selecciona el ambiente.", errors, "room");
      if (draft.locationMapId && (draft.locationMarkerX === null || draft.locationMarkerY === null)) {
        errors.locationMarker = "Coloca el marcador sobre la imagen del ambiente.";
      }
    } else {
      required(draft.locationPendingReason, "Justifica la ubicación pendiente.", errors, "locationPendingReason");
    }
  }

  if (step === 4) {
    if (!draft.evidence.some((item) => item.category === "photo")) errors.photo = "Falta una fotografía.";
  }

  if (step === 5) {
    if (!draft.confirmInspected) errors.confirmInspected = "Debes confirmar que verificaste el bien.";
    if (!draft.confirmAssignment) errors.confirmAssignment = "Debes confirmar la ubicación inicial o almacenamiento.";
  }

  return errors;
}
