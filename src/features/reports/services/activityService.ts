import { collection, getDocs, query, where, orderBy } from "firebase/firestore"
import { db } from "@/services/firebase"
import type { Visit } from "@/types/Visit"

export interface PromoterActivity {
  promoterId: string
  promoterName: string
  visitCount: number
  photoCount: number
  stockCount: number
  lastVisitAt: number | null
}

export async function fetchPromoterActivity(
  dateFrom: number,
  dateTo: number
): Promise<PromoterActivity[]> {
  const snap = await getDocs(
    query(
      collection(db, "visits"),
      where("createdAt", ">=", dateFrom),
      where("createdAt", "<=", dateTo),
      orderBy("createdAt", "desc")
    )
  )
  const visits = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Visit))

  // Group by promoter
  const map = new Map<string, PromoterActivity>()
  for (const v of visits) {
    const existing = map.get(v.promoterId)
    const photoCount = Object.values(v.photos ?? {}).reduce(
      (sum, records) => sum + (Array.isArray(records) ? records.length : 0),
      0
    )

    if (existing) {
      existing.visitCount++
      existing.photoCount += photoCount
      if (v.createdAt > (existing.lastVisitAt ?? 0)) {
        existing.lastVisitAt = v.createdAt
      }
    } else {
      map.set(v.promoterId, {
        promoterId: v.promoterId,
        promoterName: v.promoterName,
        visitCount: 1,
        photoCount,
        stockCount: 0,
        lastVisitAt: v.createdAt,
      })
    }
  }

  // Fetch stock_snapshots counts per promoter
  const snapshotSnap = await getDocs(
    query(
      collection(db, "stock_snapshots"),
      where("capturedAt", ">=", dateFrom),
      where("capturedAt", "<=", dateTo)
    )
  )
  for (const d of snapshotSnap.docs) {
    const data = d.data()
    const capturedById = data.capturedById as string
    const entry = map.get(capturedById)
    if (entry) entry.stockCount++
  }

  return [...map.values()].sort((a, b) => b.visitCount - a.visitCount)
}
