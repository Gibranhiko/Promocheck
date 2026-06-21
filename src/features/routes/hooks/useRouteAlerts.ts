import { useState, useEffect } from "react"
import { collection, getDocs, query, where } from "firebase/firestore"
import { db } from "@/services/firebase"
import { fetchMissedPlans } from "@/features/routes/services/visitPlanService"
import type { VisitPlan } from "@/types/Route"

export function useRouteAlerts(promoterId: string | undefined) {
  const [missedPlans, setMissedPlans] = useState<VisitPlan[]>([])

  useEffect(() => {
    if (!promoterId) return
    fetchMissedPlans(promoterId)
      .then(setMissedPlans)
      .catch(() => {})
  }, [promoterId])

  return { missedPlans, missedCount: missedPlans.length }
}

interface MissedByPromoter {
  promoterId: string
  promoterName?: string
  count: number
}

export async function fetchAllMissedPlanCounts(): Promise<MissedByPromoter[]> {
  const snap = await getDocs(
    query(collection(db, "visit_plans"), where("status", "==", "missed"))
  )
  const map = new Map<string, number>()
  for (const d of snap.docs) {
    const pid = d.data().promoterId as string
    map.set(pid, (map.get(pid) ?? 0) + 1)
  }
  return [...map.entries()].map(([promoterId, count]) => ({ promoterId, count }))
}
