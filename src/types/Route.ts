export type VisitFrequency = "weekly" | "biweekly" | "monthly"

export interface Route {
  id: string
  name: string
  promoterId: string
  promoterName: string
  active: boolean
  createdAt: number
}

export interface RouteStore {
  id: string
  routeId: string
  storeId: string
  order: number
  visitFrequency: VisitFrequency
  active: boolean
  createdAt: number
}

export type VisitPlanStatus = "pending" | "completed" | "missed"

export interface VisitPlan {
  id: string
  routeId: string
  storeId: string
  storeName: string
  promoterId: string
  plannedDate: number
  status: VisitPlanStatus
  visitId?: string
  createdAt: number
}
