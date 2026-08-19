export type AssetEntryStatus = "Borrador" | "Pendiente" | "Observado" | "Registrado";

export interface AssetEntry {
  id: string;
  code: string;
  description: string;
  entryType: "Compra" | "Creación propia" | "Donación" | "Alquiler";
  date: string;
  registeredBy: string;
  status: AssetEntryStatus;
}
