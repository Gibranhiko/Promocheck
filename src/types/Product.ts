export type ProductUnit = "unit" | "pack" | "box"

export const PRODUCT_UNIT_LABELS: Record<ProductUnit, string> = {
  unit: "Unidad",
  pack: "Paquete",
  box: "Caja",
}

export interface Product {
  id: string
  name: string
  sku: string
  unit: ProductUnit
  defaultMinThreshold: number
  active: boolean
  createdAt: number
}
