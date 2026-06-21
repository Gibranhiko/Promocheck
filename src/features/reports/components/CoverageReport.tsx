import { useState, useEffect } from "react"
import { fetchActiveStores } from "@/features/admin/services/storeService"
import { fetchVisitsByDateRange } from "@/features/visits/services/visitService"
import { SkeletonList } from "@/shared/components/ui/Skeleton"
import { VISIT_FREQUENCY_LABELS } from "@/types/Store"
import type { Store, VisitFrequency } from "@/types/Store"
import type { Visit } from "@/types/Visit"

interface Props {
  dateFrom: number
  dateTo: number
}

function expectedVisits(freq: VisitFrequency, dateFrom: number, dateTo: number): number {
  const days = Math.max(1, (dateTo - dateFrom) / (1000 * 60 * 60 * 24))
  if (freq === "weekly") return Math.ceil(days / 7)
  if (freq === "biweekly") return Math.ceil(days / 14)
  return Math.ceil(days / 30)
}

interface CoverageRow {
  store: Store
  expected: number
  actual: number
  pct: number
  lastVisitAt: number | null
}

function pctColor(pct: number): string {
  if (pct >= 100) return "bg-green-100 text-green-700"
  if (pct >= 50) return "bg-yellow-100 text-yellow-700"
  return "bg-red-100 text-red-700"
}

export function CoverageReport({ dateFrom, dateTo }: Props) {
  const [rows, setRows] = useState<CoverageRow[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    Promise.all([fetchActiveStores(), fetchVisitsByDateRange(dateFrom, dateTo)]).then(
      ([stores, visits]: [Store[], Visit[]]) => {
        if (cancelled) return
        const visitsByStore = new Map<string, Visit[]>()
        for (const v of visits) {
          const arr = visitsByStore.get(v.storeId) ?? []
          arr.push(v)
          visitsByStore.set(v.storeId, arr)
        }

        const result: CoverageRow[] = stores.map((store) => {
          const sv = visitsByStore.get(store.id) ?? []
          const expected = expectedVisits(store.visitFrequency, dateFrom, dateTo)
          const actual = sv.length
          const pct = expected > 0 ? Math.round((actual / expected) * 100) : 0
          const lastVisitAt = sv.length > 0 ? Math.max(...sv.map((v) => v.createdAt)) : null
          return { store, expected, actual, pct, lastVisitAt }
        })

        result.sort((a, b) => a.pct - b.pct)
        setRows(result)
        setIsLoading(false)
      }
    )
    return () => { cancelled = true }
  }, [dateFrom, dateTo])

  if (isLoading) return <SkeletonList count={4} />

  return (
    <div className="card overflow-hidden p-0">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr className="text-left text-gray-500">
            <th className="px-4 py-3 font-medium">Tienda</th>
            <th className="px-4 py-3 font-medium">Frecuencia</th>
            <th className="px-4 py-3 font-medium text-center">Esperadas</th>
            <th className="px-4 py-3 font-medium text-center">Realizadas</th>
            <th className="px-4 py-3 font-medium text-center">Cobertura</th>
            <th className="px-4 py-3 font-medium">Última visita</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ store, expected, actual, pct, lastVisitAt }) => (
            <tr key={store.id} className="border-b last:border-b-0">
              <td className="px-4 py-3 font-medium text-gray-900">
                {store.name}
                {store.chain && <span className="text-xs text-gray-400 ml-1">· {store.chain}</span>}
              </td>
              <td className="px-4 py-3 text-gray-600">{VISIT_FREQUENCY_LABELS[store.visitFrequency]}</td>
              <td className="px-4 py-3 text-center text-gray-600">{expected}</td>
              <td className="px-4 py-3 text-center text-gray-600">{actual}</td>
              <td className="px-4 py-3 text-center">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${pctColor(pct)}`}>
                  {pct}%
                </span>
              </td>
              <td className="px-4 py-3 text-gray-500 text-xs">
                {lastVisitAt
                  ? new Date(lastVisitAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })
                  : "—"
                }
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                Sin datos para este período
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
