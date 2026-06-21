import { z } from "zod"

export const productSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(100),
  sku: z.string().min(1, "SKU requerido").max(50),
  unit: z.enum(["unit", "pack", "box"]),
  defaultMinThreshold: z.number().int().min(0, "Debe ser 0 o mayor"),
  active: z.boolean().default(true),
})

export type ProductFormValues = z.infer<typeof productSchema>

export const stockCountSchema = z.object({
  productId: z.string().min(1),
  shelfQty: z.number().int().min(0, "Debe ser 0 o mayor"),
  backroomQty: z.number().int().min(0, "Debe ser 0 o mayor"),
})

export type StockCountEntry = z.infer<typeof stockCountSchema>
