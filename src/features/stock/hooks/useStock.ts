import { saveSnapshotsLocally } from "@/services/offline/db"
import { fetchStoreProductsWithDetails } from "@/features/stock/services/storeProductService"
import type { StoreProductWithDetails } from "@/features/stock/services/storeProductService"
import type { StockSnapshot } from "@/types/StockSnapshot"

export interface StockCountEntry {
  productId: string
  productName: string
  shelfQty: number
  backroomQty: number
  minThreshold: number
}

export async function loadStoreProducts(storeId: string): Promise<StoreProductWithDetails[]> {
  return fetchStoreProductsWithDetails(storeId)
}

export async function saveStockCounts(
  visitId: string,
  storeId: string,
  counts: StockCountEntry[],
  capturedById: string
): Promise<void> {
  if (counts.length === 0) return
  const now = Date.now()
  const snapshots: StockSnapshot[] = counts.map((count) => {
    const totalQty = count.shelfQty + count.backroomQty
    return {
      id: `snap_${visitId}_${count.productId}`,
      visitId,
      storeId,
      productId: count.productId,
      shelfQty: count.shelfQty,
      backroomQty: count.backroomQty,
      totalQty,
      needsReorder: totalQty < count.minThreshold,
      capturedAt: now,
      capturedById,
      status: "pending_sync",
    }
  })
  await saveSnapshotsLocally(snapshots)
}
