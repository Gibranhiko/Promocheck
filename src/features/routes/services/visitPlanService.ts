import {
  collection,
  updateDoc,
  getDocs,
  doc,
  query,
  where,
  orderBy,
  writeBatch,
} from "firebase/firestore"
import { db } from "@/services/firebase"
import { fetchRouteStores, fetchRoute } from "./routeService"
import { fetchActiveStores } from "@/features/admin/services/storeService"
import type { VisitPlan, VisitFrequency } from "@/types/Route"

const MS_PER_DAY = 1000 * 60 * 60 * 24

function startOfDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function plannedDatesForFrequency(
  freq: VisitFrequency,
  weekStart: Date
): Date[] {
  const start = new Date(weekStart)
  start.setHours(0, 0, 0, 0)
  if (freq === "weekly") return [start]
  if (freq === "biweekly") {
    // plan on week start; biweekly means only on even ISO weeks
    const weekNum = Math.ceil((start.getTime() - new Date(start.getFullYear(), 0, 1).getTime()) / (7 * MS_PER_DAY))
    return weekNum % 2 === 0 ? [start] : []
  }
  // monthly — plan on first Monday of the month
  const firstOfMonth = new Date(start.getFullYear(), start.getMonth(), 1)
  // move to Monday
  const dayOfWeek = firstOfMonth.getDay()
  const daysToMonday = dayOfWeek === 0 ? 1 : (dayOfWeek === 1 ? 0 : 8 - dayOfWeek)
  const firstMonday = new Date(firstOfMonth.getTime() + daysToMonday * MS_PER_DAY)
  // only generate if it falls within the week
  const endOfWeek = new Date(start.getTime() + 6 * MS_PER_DAY)
  return firstMonday >= start && firstMonday <= endOfWeek ? [firstMonday] : []
}

export async function generateVisitPlans(routeId: string, weekStart: Date): Promise<VisitPlan[]> {
  const [route, routeStores, allStores] = await Promise.all([
    fetchRoute(routeId),
    fetchRouteStores(routeId),
    fetchActiveStores(),
  ])
  if (!route) throw new Error(`Route ${routeId} not found`)

  const storeMap = new Map(allStores.map((s) => [s.id, s.name]))
  const batch = writeBatch(db)
  const plans: VisitPlan[] = []

  for (const rs of routeStores) {
    const storeName = storeMap.get(rs.storeId) ?? rs.storeId
    const dates = plannedDatesForFrequency(rs.visitFrequency, weekStart)

    for (const date of dates) {
      const planRef = doc(collection(db, "visit_plans"))
      const payload: Omit<VisitPlan, "id"> = {
        routeId,
        storeId: rs.storeId,
        storeName,
        promoterId: route.promoterId,
        plannedDate: startOfDay(date.getTime()),
        status: "pending",
        createdAt: Date.now(),
      }
      batch.set(planRef, payload)
      plans.push({ id: planRef.id, ...payload })
    }
  }
  await batch.commit()
  return plans
}

export async function fetchVisitPlansByPromoter(
  promoterId: string,
  weekStart: Date
): Promise<VisitPlan[]> {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  const snap = await getDocs(
    query(
      collection(db, "visit_plans"),
      where("promoterId", "==", promoterId),
      where("plannedDate", ">=", startOfDay(weekStart.getTime())),
      where("plannedDate", "<=", weekEnd.getTime()),
      orderBy("plannedDate", "asc")
    )
  )
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VisitPlan, "id">) }))
}

export async function fetchTodayPlans(promoterId: string): Promise<VisitPlan[]> {
  const today = startOfDay(Date.now())
  const snap = await getDocs(
    query(
      collection(db, "visit_plans"),
      where("promoterId", "==", promoterId),
      where("plannedDate", "==", today),
      where("status", "==", "pending"),
      orderBy("plannedDate", "asc")
    )
  )
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VisitPlan, "id">) }))
}

export async function markPlanCompleted(planId: string, visitId: string): Promise<void> {
  await updateDoc(doc(db, "visit_plans", planId), { status: "completed", visitId })
}

export async function markOverduePlans(promoterId: string): Promise<number> {
  const now = startOfDay(Date.now())
  const snap = await getDocs(
    query(
      collection(db, "visit_plans"),
      where("promoterId", "==", promoterId),
      where("status", "==", "pending"),
      where("plannedDate", "<", now)
    )
  )
  if (snap.empty) return 0
  const batch = writeBatch(db)
  for (const d of snap.docs) batch.update(d.ref, { status: "missed" })
  await batch.commit()
  return snap.size
}

export async function fetchMissedPlans(promoterId: string): Promise<VisitPlan[]> {
  const snap = await getDocs(
    query(
      collection(db, "visit_plans"),
      where("promoterId", "==", promoterId),
      where("status", "==", "missed"),
      orderBy("plannedDate", "desc")
    )
  )
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VisitPlan, "id">) }))
}

export async function fetchAllVisitPlans(
  weekStart: Date
): Promise<VisitPlan[]> {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  const snap = await getDocs(
    query(
      collection(db, "visit_plans"),
      where("plannedDate", ">=", startOfDay(weekStart.getTime())),
      where("plannedDate", "<=", weekEnd.getTime()),
      orderBy("plannedDate", "asc")
    )
  )
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VisitPlan, "id">) }))
}
