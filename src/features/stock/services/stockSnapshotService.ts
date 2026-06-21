import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
} from "firebase/firestore"
import { db } from "@/services/firebase"
import {
  getSnapshotsForVisit,
  markSnapshotSynced,
} from "@/services/offline/db"
import type { StockSnapshot } from "@/types/StockSnapshot"

export async function syncSnapshotsToFirestore(visitId: string): Promise<number> {
  const pending = await getSnapshotsForVisit(visitId)
  const toSync = pending.filter((s) => s.status === "pending_sync")
  if (toSync.length === 0) return 0

  await Promise.all(
    toSync.map(async (snapshot) => {
      const { id, ...data } = snapshot
      await setDoc(doc(db, "stock_snapshots", id), { ...data, status: "synced" })
      await markSnapshotSynced(id)
    })
  )
  return toSync.length
}

export async function fetchSnapshotsByVisit(visitId: string): Promise<StockSnapshot[]> {
  const snap = await getDocs(
    query(collection(db, "stock_snapshots"), where("visitId", "==", visitId))
  )
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StockSnapshot, "id">) }))
}

export async function fetchSnapshotsByStore(
  storeId: string,
  limitCount = 50
): Promise<StockSnapshot[]> {
  const snap = await getDocs(
    query(
      collection(db, "stock_snapshots"),
      where("storeId", "==", storeId),
      orderBy("capturedAt", "desc"),
      limit(limitCount)
    )
  )
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StockSnapshot, "id">) }))
}

export async function fetchRecentSnapshotsByStoreProduct(
  storeId: string,
  productId: string,
  limitCount = 10
): Promise<StockSnapshot[]> {
  const snap = await getDocs(
    query(
      collection(db, "stock_snapshots"),
      where("storeId", "==", storeId),
      where("productId", "==", productId),
      orderBy("capturedAt", "desc"),
      limit(limitCount)
    )
  )
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StockSnapshot, "id">) }))
}

export async function fetchLatestSnapshotByStoreProduct(
  storeId: string,
  productId: string
): Promise<StockSnapshot | null> {
  const snap = await getDocs(
    query(
      collection(db, "stock_snapshots"),
      where("storeId", "==", storeId),
      where("productId", "==", productId),
      orderBy("capturedAt", "desc"),
      limit(1)
    )
  )
  if (snap.empty) return null
  const d = snap.docs[0]
  return { id: d.id, ...(d.data() as Omit<StockSnapshot, "id">) }
}

export async function fetchSnapshot(id: string): Promise<StockSnapshot | null> {
  const snap = await getDoc(doc(db, "stock_snapshots", id))
  if (!snap.exists()) return null
  return { id: snap.id, ...(snap.data() as Omit<StockSnapshot, "id">) }
}
