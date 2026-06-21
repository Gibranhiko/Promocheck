import { useState, useEffect } from "react"
import { SkeletonList } from "@/shared/components/ui/Skeleton"
import { EmptyState } from "@/shared/components/ui/EmptyState"
import { fetchPromoterActivity } from "@/features/reports/services/activityService"
import type { PromoterActivity } from "@/features/reports/services/activityService"

interface Props {
  dateFrom: number
  dateTo: number
}

export function PromoterActivityReport({ dateFrom, dateTo }: Props) {
  const [rows, setRows] = useState<PromoterActivity[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    fetchPromoterActivity(dateFrom, dateTo).then((data) => {
      if (!cancelled) {
        setRows(data)
        setIsLoading(false)
      }
    }).catch(() => {
      if (!cancelled) setIsLoading(false)
    })
    return () => { cancelled = true }
  }, [dateFrom, dateTo])

  if (isLoading) return <SkeletonList count={4} />

  if (rows.length === 0) {
    return <EmptyState icon="👩" title="Sin actividad" description="No hay visitas registradas en este período." />
  }

  return (
    <div className="card overflow-hidden p-0">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 border-b">
          <tr className="text-left text-gray-500">
            <th className="px-4 py-3 font-medium">Promotora</th>
            <th className="px-4 py-3 font-medium text-center">Visitas</th>
            <th className="px-4 py-3 font-medium text-center">Fotos</th>
            <th className="px-4 py-3 font-medium text-center">Conteos</th>
            <th className="px-4 py-3 font-medium">Última visita</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.promoterId} className="border-b last:border-b-0">
              <td className="px-4 py-3 font-medium text-gray-900">{row.promoterName}</td>
              <td className="px-4 py-3 text-center font-semibold text-brand-700">{row.visitCount}</td>
              <td className="px-4 py-3 text-center text-gray-600">{row.photoCount}</td>
              <td className="px-4 py-3 text-center text-gray-600">{row.stockCount}</td>
              <td className="px-4 py-3 text-xs text-gray-500">
                {row.lastVisitAt
                  ? new Date(row.lastVisitAt).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })
                  : "—"
                }
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
