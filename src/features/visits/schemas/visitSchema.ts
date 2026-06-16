import { z } from "zod"

export const visitSchema = z.object({
  visitType: z.enum(["routine", "audit", "special_event"], {
    required_error: "Selecciona el tipo de visita",
  }),
  visitDate: z
    .number({ required_error: "La fecha de visita es requerida" })
    .int()
    .positive("Fecha inválida"),
  storeId: z.string().min(1, "Selecciona una tienda"),
  storeName: z.string().min(1).max(100),
  notes: z.string().max(500, "Las notas no pueden exceder 500 caracteres").optional(),
  overallCondition: z.enum(["good", "regular", "bad"]).optional(),
})

export type VisitFormValues = z.infer<typeof visitSchema>
