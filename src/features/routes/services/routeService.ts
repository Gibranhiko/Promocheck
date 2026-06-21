import {
  collection,
  addDoc,
  updateDoc,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  orderBy,
  writeBatch,
} from "firebase/firestore"
import { db } from "@/services/firebase"
import type { Route, RouteStore, VisitFrequency } from "@/types/Route"

// ── Routes ──────────────────────────────────────────────────────────────────

export async function fetchRoutes(): Promise<Route[]> {
  const snap = await getDocs(query(collection(db, "routes"), orderBy("createdAt", "desc")))
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Route, "id">) }))
}

export async function fetchRoute(id: string): Promise<Route | null> {
  const snap = await getDoc(doc(db, "routes", id))
  if (!snap.exists()) return null
  return { id: snap.id, ...(snap.data() as Omit<Route, "id">) }
}

export interface CreateRouteData {
  name: string
  promoterId: string
  promoterName: string
}

export async function createRoute(data: CreateRouteData): Promise<Route> {
  const payload: Omit<Route, "id"> = {
    name: data.name.trim(),
    promoterId: data.promoterId,
    promoterName: data.promoterName,
    active: true,
    createdAt: Date.now(),
  }
  const ref = await addDoc(collection(db, "routes"), payload)
  return { id: ref.id, ...payload }
}

export async function updateRoute(id: string, data: Partial<Pick<Route, "name" | "promoterId" | "promoterName">>): Promise<void> {
  const payload: Record<string, unknown> = {}
  if (data.name) payload.name = data.name.trim()
  if (data.promoterId) payload.promoterId = data.promoterId
  if (data.promoterName) payload.promoterName = data.promoterName
  await updateDoc(doc(db, "routes", id), payload)
}

export async function deactivateRoute(id: string): Promise<void> {
  await updateDoc(doc(db, "routes", id), { active: false })
}

export async function reactivateRoute(id: string): Promise<void> {
  await updateDoc(doc(db, "routes", id), { active: true })
}

// ── RouteStores ──────────────────────────────────────────────────────────────

export async function fetchRouteStores(routeId: string): Promise<RouteStore[]> {
  const snap = await getDocs(
    query(
      collection(db, "route_stores"),
      where("routeId", "==", routeId),
      where("active", "==", true),
      orderBy("order", "asc")
    )
  )
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RouteStore, "id">) }))
}

export async function addStoreToRoute(
  routeId: string,
  storeId: string,
  order: number,
  visitFrequency: VisitFrequency
): Promise<RouteStore> {
  const payload: Omit<RouteStore, "id"> = {
    routeId,
    storeId,
    order,
    visitFrequency,
    active: true,
    createdAt: Date.now(),
  }
  const ref = await addDoc(collection(db, "route_stores"), payload)
  return { id: ref.id, ...payload }
}

export async function removeStoreFromRoute(id: string): Promise<void> {
  await updateDoc(doc(db, "route_stores", id), { active: false })
}

export async function reorderRouteStore(id: string, newOrder: number): Promise<void> {
  await updateDoc(doc(db, "route_stores", id), { order: newOrder })
}

// ── Conflict check + reassignment (T4.3) ─────────────────────────────────────

export async function checkPromoterRouteConflict(
  promoterId: string,
  excludeRouteId: string
): Promise<boolean> {
  const snap = await getDocs(
    query(
      collection(db, "routes"),
      where("promoterId", "==", promoterId),
      where("active", "==", true)
    )
  )
  return snap.docs.some((d) => d.id !== excludeRouteId)
}

export async function reassignRoute(routeId: string, newPromoterId: string, newPromoterName: string): Promise<void> {
  const batch = writeBatch(db)
  batch.update(doc(db, "routes", routeId), { promoterId: newPromoterId, promoterName: newPromoterName })

  // Update pending visit_plans for this route
  const plansSnap = await getDocs(
    query(
      collection(db, "visit_plans"),
      where("routeId", "==", routeId),
      where("status", "==", "pending")
    )
  )
  for (const d of plansSnap.docs) {
    batch.update(d.ref, { promoterId: newPromoterId })
  }
  await batch.commit()
}
