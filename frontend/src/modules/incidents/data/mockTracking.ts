import type { RequestTracking } from "../trackingModel";

export const mockTracking: RequestTracking[] = [
  {
    incidentId: "INC-001",
    currentStatus: "EN_PROCESO",
    workerName: "Carlos Medina",
    workerSpecialty: "Electricidad",
    events: [
      {
        id: "1",
        status: "REPORTADO",
        description: "Solicitud registrada",
        date: "2026-07-31",
      },
      {
        id: "2",
        status: "ASIGNADO",
        description: "Operario asignado",
        date: "2026-07-31",
      },
      {
        id: "3",
        status: "EN_PROCESO",
        description: "Trabajo iniciado",
        date: "2026-08-01",
      },
    ],
  },
];