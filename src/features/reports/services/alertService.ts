import { getDoc, doc } from "firebase/firestore"
import { db } from "@/services/firebase"
import { fetchActiveStores } from "@/features/admin/services/storeService"
import { fetchAllActiveStoreProducts } from "@/features/stock/services/storeProductService"
import { fetchActiveProducts } from "@/features/stock/services/productService"
import { calculateForecast } from "./forecastingService"

export const DEFAULT_ALERT_THRESHOLD_DAYS = 7

export interface StockAlert {
  storeId: string
  storeName: string
  productId: string
  productName: string
  currentStock: number
  daysOfInventory: number
  urgency: "critical" | "warning"
  suggestedOrderQty: number
}

export async function fetchAlertThresholdDays(): Promise<number> {
  try {
    const snap = await getDoc(doc(db, "config", "alert_settings"))
    if (snap.exists()) {
      const days = snap.data().thresholdDays as number
      if (typeof days === "number" && days > 0) return days
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_ALERT_THRESHOLD_DAYS
}

export async function saveAlertThresholdDays(days: number): Promise<void> {
  const { setDoc } = await import("firebase/firestore")
  await setDoc(doc(db, "config", "alert_settings"), { thresholdDays: days }, { merge: true })
}

export async function fetchStockAlerts(thresholdDays?: number): Promise<StockAlert[]> {
  const threshold = thresholdDays ?? (await fetchAlertThresholdDays())

  const [stores, products, storeProducts] = await Promise.all([
    fetchActiveStores(),
    fetchActiveProducts(),
    fetchAllActiveStoreProducts(),
  ])

  const storeMap = new Map(stores.map((s) => [s.id, s.name]))
  const productMap = new Map(products.map((p) => [p.id, p.name]))

  const forecasts = await Promise.all(
    storeProducts.map((sp) =>
      calculateForecast(sp.storeId, sp.productId, sp.minThreshold).then((f) => ({ sp, f }))
    )
  )

  const alerts: StockAlert[] = []
  for (const { sp, f } of forecasts) {
    if (!f || f.daysOfInventory === null) continue
    if (f.daysOfInventory >= threshold * 1.5) continue

    const storeName = storeMap.get(sp.storeId)
    const productName = productMap.get(sp.productId)
    if (!storeName || !productName) continue

    alerts.push({
      storeId: sp.storeId,
      storeName,
      productId: sp.productId,
      productName,
      currentStock: f.currentStock,
      daysOfInventory: f.daysOfInventory,
      urgency: f.daysOfInventory < threshold ? "critical" : "warning",
      suggestedOrderQty: f.suggestedOrderQty,
    })
  }

  return alerts.sort((a, b) => {
    if (a.urgency !== b.urgency) return a.urgency === "critical" ? -1 : 1
    return a.daysOfInventory - b.daysOfInventory
  })
}
