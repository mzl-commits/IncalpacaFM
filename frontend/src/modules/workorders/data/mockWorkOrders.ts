import type { WorkOrder } from "../types";

export const mockWorkOrders: WorkOrder[] = [
  {
    id: "OT-001",
    code: "OT-2026-0001",

    requestId: "SOL-002",
    requestCode: "SOL-2026-0002",

    operatorId: "USR-OPE-001",
    operatorName: "Carlos Mamani",

    supervisorId: "USR-SUP-001",
    supervisorName: "Rosa Medina",

    specialty: "ELECTRICIDAD",
    adminPriority: "MEDIA",
    status: "PROGRAMADA",

    scheduledDate: "2026-07-26",
    administratorNotes:
      "Coordinar acceso con el responsable del área.",

    progressPercentage: 0,

    createdAt: "2026-07-24T08:30:00",
    updatedAt: "2026-07-24T08:30:00",
  },
];