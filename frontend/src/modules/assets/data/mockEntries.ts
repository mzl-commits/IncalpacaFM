import type { AssetEntry } from "@/modules/assets/types";

export const mockEntries: AssetEntry[] = [
  {
    id: "1",
    code: "INC-BOR-2026-0041",
    description: "Laptop Lenovo ThinkPad T14",
    entryType: "Compra",
    date: "24 jul 2026",
    registeredBy: "Ana Torres",
    status: "Pendiente",
  },
  {
    id: "2",
    code: "INC-BIEN-2026-0187",
    description: "Taladro percutor industrial",
    entryType: "Compra",
    date: "23 jul 2026",
    registeredBy: "Marco Quispe",
    status: "Registrado",
  },
  {
    id: "3",
    code: "INC-BOR-2026-0039",
    description: "Mueble archivador metálico",
    entryType: "Creación propia",
    date: "22 jul 2026",
    registeredBy: "Rosa Medina",
    status: "Borrador",
  },
  {
    id: "4",
    code: "INC-BOR-2026-0038",
    description: "Monitor industrial 27 pulgadas",
    entryType: "Donación",
    date: "22 jul 2026",
    registeredBy: "Luis Salas",
    status: "Observado",
  },
];
