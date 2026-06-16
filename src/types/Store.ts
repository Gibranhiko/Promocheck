export type StoreType = "supermarket" | "convenience" | "pharmacy" | "other"
export type VisitFrequency = "weekly" | "biweekly" | "monthly"

export interface Store {
  id: string
  name: string
  address?: string
  storeType: StoreType
  chain?: string
  contactName?: string
  contactPhone?: string
  visitFrequency: VisitFrequency
  active: boolean
  createdAt: number
  createdBy: string
}

export const STORE_TYPE_LABELS: Record<StoreType, string> = {
  supermarket: "Supermercado",
  convenience: "Tienda de conveniencia",
  pharmacy: "Farmacia",
  other: "Otro",
}

export const VISIT_FREQUENCY_LABELS: Record<VisitFrequency, string> = {
  weekly: "Semanal",
  biweekly: "Quincenal",
  monthly: "Mensual",
}
