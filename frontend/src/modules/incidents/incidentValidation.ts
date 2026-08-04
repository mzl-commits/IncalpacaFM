import { z } from "zod";
import {
  REQUEST_PRIORITIES,
  REQUEST_TYPES,
} from "./incidentModel";

export const workRequestSchema = z.object({
  locationId: z.string().min(1, "Selecciona una ubicación"),

  zone: z.string().min(1, "Selecciona una zona"),
  building: z.string().min(1, "Selecciona un edificio"),
  area: z.string().min(1, "Selecciona un área"),
  room: z.string().min(1, "Selecciona un ambiente"),

  requestType: z.enum(REQUEST_TYPES, {
    error: "Selecciona un tipo de solicitud",
  }),

  description: z
    .string()
    .trim()
    .min(10, "La descripción debe tener al menos 10 caracteres")
    .max(1000, "La descripción no puede superar los 1000 caracteres"),

  requesterPriority: z.enum(REQUEST_PRIORITIES),

  project: z.boolean(),
});

export type WorkRequestFormValues = z.infer<typeof workRequestSchema>;