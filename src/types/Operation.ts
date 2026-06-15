import type { PhotoType } from "./PhotoType"
import type { OperationType } from "./OperationType"

export type OperationStatus = "pending_sync" | "synced" | "approved" | "rejected" | "error"

export interface PhotoRecord {
  url: string
  capturedAt: number
}

export interface Operation {
  id: string
  localId: string
  orderNumber: string
  doorNumber: string
  operationType: OperationType
  operatorId: string
  operatorName: string
  clientId: string
  clientName: string
  photos: Partial<Record<PhotoType, PhotoRecord>>
  status: OperationStatus
  createdAt: number
  syncedAt?: number
  errorMessage?: string
  rejectionReason?: string
}

export interface LocalPhoto {
  id: string
  blob: Blob
  operationId: string
  photoType: PhotoType
}
