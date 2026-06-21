import { fetchRecentSnapshotsByStoreProduct } from "@/features/stock/services/stockSnapshotService"

const MAX_SNAPSHOTS = 10
const MS_PER_DAY = 1000 * 60 * 60 * 24

export interface ForecastResult {
  storeId: string
  productId: string
  currentStock: number
  dailyConsumptionAvg: number | null
  daysOfInventory: number | null
  suggestedOrderQty: number
  dataPoints: number
  lastSnapshotAt: number
}

export async function calculateForecast(
  storeId: string,
  productId: string,
  minThreshold = 0
): Promise<ForecastResult | null> {
  const snapshots = await fetchRecentSnapshotsByStoreProduct(storeId, productId, MAX_SNAPSHOTS)
  // already ordered desc by capturedAt from the query

  if (snapshots.length === 0) return null

  const currentStock = snapshots[0].totalQty
  const lastSnapshotAt = snapshots[0].capturedAt

  if (snapshots.length < 2) {
    return {
      storeId,
      productId,
      currentStock,
      dailyConsumptionAvg: null,
      daysOfInventory: null,
      suggestedOrderQty: Math.max(0, minThreshold - currentStock),
      dataPoints: snapshots.length,
      lastSnapshotAt,
    }
  }

  // Calculate daily consumption for each consecutive pair
  const rates: number[] = []
  for (let i = 0; i < snapshots.length - 1; i++) {
    const newer = snapshots[i]
    const older = snapshots[i + 1]
    const consumed = older.totalQty - newer.totalQty
    const days = (newer.capturedAt - older.capturedAt) / MS_PER_DAY
    if (days > 0 && consumed > 0) {
      rates.push(consumed / days)
    }
  }

  if (rates.length === 0) {
    // All pairs showed restocking or no change — can't forecast consumption
    return {
      storeId,
      productId,
      currentStock,
      dailyConsumptionAvg: null,
      daysOfInventory: null,
      suggestedOrderQty: Math.max(0, minThreshold - currentStock),
      dataPoints: snapshots.length,
      lastSnapshotAt,
    }
  }

  const dailyConsumptionAvg = rates.reduce((a, b) => a + b, 0) / rates.length
  const daysOfInventory = dailyConsumptionAvg > 0
    ? Math.round(currentStock / dailyConsumptionAvg)
    : null

  return {
    storeId,
    productId,
    currentStock,
    dailyConsumptionAvg: Math.round(dailyConsumptionAvg * 100) / 100,
    daysOfInventory,
    suggestedOrderQty: Math.max(0, minThreshold - currentStock),
    dataPoints: snapshots.length,
    lastSnapshotAt,
  }
}

export async function calculateBulkForecast(
  pairs: Array<{ storeId: string; productId: string; minThreshold?: number }>
): Promise<(ForecastResult | null)[]> {
  return Promise.all(
    pairs.map((p) => calculateForecast(p.storeId, p.productId, p.minThreshold))
  )
}
