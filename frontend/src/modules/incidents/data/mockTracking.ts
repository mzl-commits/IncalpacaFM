import type { RequestTracking } from "../trackingModel";

export const mockTracking: RequestTracking[] = [
  {
    incidentId: "INC-001",
    code: "SOL-2026-0001",
    description: "Revision de luminaria en oficina",
    currentStatus: "EN_PROCESO",
    workerName: "Carlos Medina",
    workerSpecialty: "Electricidad",
    workOrderCode: "OT-2026-0001",
    progressPercentage: 45,
    location: "Planta / Administracion / Oficina 1",
    reportedAt: "2026-07-31T08:00:00Z",
    updatedAt: "2026-08-01T10:00:00Z",
    events: [
      {
        id: "1",
        status: "REPORTADO",
        description: "Solicitud registrada",
        date: "2026-07-31T08:00:00Z",
      },
      {
        id: "2",
        status: "ASIGNADO",
        description: "Operario asignado",
        date: "2026-07-31T11:00:00Z",
      },
      {
        id: "3",
        status: "EN_PROCESO",
        description: "Trabajo iniciado",
        date: "2026-08-01T10:00:00Z",
      },
    ],
  },
];