import type { WorkRequest } from "../types";

export const mockWorkRequests: WorkRequest[] = [
  {
    id: "SOL-001",
    code: "SOL-2026-0001",

    requesterId: "USR-001",
    requesterName: "Ana Torres",
    requesterEmail: "ana.torres@incalpaca.com",

    locationId: "UBI-001",
    zone: "Zona Industrial",
    building: "Edificio Administrativo",
    area: "Sistemas",
    room: "Oficina 204",

    requestType: "MANTENIMIENTO_CORRECTIVO",
    description:
      "El tomacorriente principal produce chispas al conectar un equipo.",

    requesterPriority: "URGENTE",
    project: false,

    evidence: [],

    status: "PENDIENTE",

    reportedAt: "2026-07-24T09:30:00",
    updatedAt: "2026-07-24T09:30:00",
  },
  {
    id: "SOL-002",
    code: "SOL-2026-0002",

    requesterId: "USR-002",
    requesterName: "Marco Quispe",
    requesterEmail: "marco.quispe@incalpaca.com",

    locationId: "UBI-002",
    zone: "Zona Industrial",
    building: "Planta Principal",
    area: "Mantenimiento",
    room: "Taller mecánico",

    requestType: "INSTALACION",
    description:
      "Se requiere instalar iluminación adicional en el área de trabajo.",

    requesterPriority: "NORMAL",
    project: false,

    evidence: [],

    status: "EN_EVALUACION",

    reportedAt: "2026-07-23T14:15:00",
    updatedAt: "2026-07-24T08:20:00",
  },
];