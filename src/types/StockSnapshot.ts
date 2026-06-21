export type StockSnapshotStatus = "pending_sync" | "synced"

export interface StockSnapshot {
  id: string
  visitId: string
  storeId: string
  productId: string
  shelfQty: number
  backroomQty: number
  totalQty: number
  needsReorder: boolean
  capturedAt: number
  capturedById: string
  status: StockSnapshotStatus
}
