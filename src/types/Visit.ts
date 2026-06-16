import type { VisitType, VisitCondition, VisitStatus } from "./VisitType"
import type { PhotoCategory, PhotoRecord } from "./PhotoCategory"

export interface Visit {
  id: string
  localId: string
  visitType: VisitType
  visitDate: number
  notes?: string
  overallCondition?: VisitCondition
  promoterId: string
  promoterName: string
  storeId: string
  storeName: string
  photos: Partial<Record<PhotoCategory, PhotoRecord[]>>
  status: VisitStatus
  createdAt: number
  syncedAt?: number
  errorMessage?: string
  rejectionReason?: string
}
