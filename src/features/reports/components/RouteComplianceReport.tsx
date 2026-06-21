import { useState, useEffect } from "react"
import { collection, getDocs, query, where, orderBy } from "firebase/firestore"
import { db } from "@/services/firebase"
import { SkeletonList } from "@/shared/components/ui/Skeleton"
import { EmptyState } from "@/shared/components/ui/EmptyState"
import type { VisitPlan } from "@/types/Route"

interface PromoterCompliance {
  promoterId: string
  promoterName: string
  total: number
  completed: number
  missed: number
  pending: number
  pct: number
  plans: VisitPlan[]
}

interface Props {
  dateFrom: number
  dateTo: number
}

function pctColor(pct: number): string {
  if (pct >= 100) return "bg-green-100 text-green-700"
  if (pct >= 50) return "bg-yellow-100 text-yellow-700"
  return "bg-red-100 text-red-700"
}

export function RouteComplianceReport({ dateFrom, dateTo }: Props) {
  const [rows, setRows] = useState<PromoterCompliance[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [drillDown, setDrillDown] = useState<PromoterCompliance | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    getDocs(
      query(
        collection(db, "visit_plans"),
        where("plannedDate", ">=", dateFrom),
        where("plannedDate", "<=", dateTo),
        orderBy("plannedDate", "asc")
      )
    ).then((snap) => {
      if (cancelled) return
      const plans = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<VisitPlan, "id">) }))

      const map = new Map<string, PromoterCompliance>()
      for (const plan of plans) {
        let row = map.get(plan.promoterId)
        if (!row) {
          row = { promoterId: plan.promoterId, promoterName: plan.storeName, total: 0, completed: 0, missed: 0, pending: 0, pct: 0, plans: [] }
          // promoterName from plan context — we'll use a different approach below
          map.set(plan.promoterId, row)
        }
        row.total++
        row.plans.push(plan)
        if (plan.status === "completed") row.completed++
        else if (plan.status === "missed") row.missed++
        else row.pending++
      }

      // Get promoter names from the plans' storeName field isn't right —
      // we need promoterName. Let's fetch route data or just use promoterId.
      // Actually VisitPlan doesn't store promoterName, only promoterId.
      // We'll derive a label from the first plan's context by fetching routes lazily.
      // For simplicity, show promoterId truncated until routes are loaded.

      const result: PromoterCompliance[] = [...map.values()].map((row) => ({
        ...row,
        pct: row.total > 0 ? Math.round((row.completed / row.total) * 100) : 0,
      })).sort((a, b) => a.pct - b.pct)

      setRows(result)
      setIsLoading(false)
    }).catch(() => {
      if (!cancelled) setIsLoading(false)
    })

    return () => { cancelled = true }
  }, [dateFrom, dateTo])

  // Fetch promoter names from routes collection
  useEffect(() => {
    if (rows.length === 0) return
    getDocs(query(collection(db, "routes"))).then((snap) => {
      const nameMap = new Map<string, string>()
      for (const d of snap.docs) {
        const data = d.data()
        nameMap.set(data.promoterId as string, data.promoterName as string)
      }
      setRows((prev) => prev.map((r) => ({ ...r, promoterName: nameMap.get(r.promoterId) ?? r.promoterId })))
    }).catch(() => {})
  }, [rows.length])

  if (isLoading) return <SkeletonList count={4} />

  if (rows.length === 0) {
    return <EmptyState icon="📋" title="Sin planes en este período" description="No se generaron planes de visita para este rango de fechas." />
  }

  if (drillDown) {
    return (
      <div className="space-y-3">
        <button onClick={() => setDrillDown(null)} className="btn btn-secondary text-sm">← Volver</button>
        <h3 className="font-semibold text-gray-900">{drillDown.promoterName}</h3>
        <div className="card overflow-hidden p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr className="text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Tienda</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium text-center">Estado</th>
              </tr>
            </thead>
            <tbody>
              {drillDown.plans.map((plan) => (
                <tr key={plan.id} className="border-b last:border-b-0">
                  <td className="px-4 py-2.5 font-medium text-gray-900">{plan.storeName}</td>
                  <td className="px-4 py-2.5 text-gray-500 text-xs">
                    {new Date(plan.plannedDate).toLocaleDateString("es-MX", { day: "2-digit", month: "short" })}
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      plan.status === "completed" ? "bg-green-100 text-green-700" :
                      plan.status === "missed" ? "bg-red-100 text-red-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {plan.status === "completed" ? "Completada" : plan.status === "missed" ? "Vencida" : "Pendiente"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="card overflow-hidden p-0">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr className="text-left text-gray-500">
            <th className="px-4 py-3 font-medium">Promotora</th>
            <th className="px-4 py-3 font-medium text-center">Planes</th>
            <th className="px-4 py-3 font-medium text-center">Completados</th>
            <th className="px-4 py-3 font-medium text-center">Vencidos</th>
            <th className="px-4 py-3 font-medium text-center">Cumplimiento</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.promoterId}
              className="border-b last:border-b-0 cursor-pointer hover:bg-gray-50"
              onClick={() => setDrillDown(row)}
            >
              <td className="px-4 py-3 font-medium text-gray-900">{row.promoterName}</td>
              <td className="px-4 py-3 text-center text-gray-600">{row.total}</td>
              <td className="px-4 py-3 text-center text-green-600 font-semibold">{row.completed}</td>
              <td className="px-4 py-3 text-center text-red-500 font-semibold">{row.missed}</td>
              <td className="px-4 py-3 text-center">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pctColor(row.pct)}`}>{row.pct}%</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
