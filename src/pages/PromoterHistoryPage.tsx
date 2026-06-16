import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { AppShell } from "@/shared/components/layout/AppShell"
import { StatusBadge } from "@/shared/components/ui/StatusBadge"
import { SkeletonList } from "@/shared/components/ui/Skeleton"
import { EmptyState } from "@/shared/components/ui/EmptyState"
import { formatDateTime } from "@/shared/utils"
import { useAuthStore } from "@/features/auth/store/authStore"
import { getLocalVisits } from "@/services/offline/db"
import { fetchVisitsByPromoter } from "@/features/visits/services/visitService"
import { PROMOTER_NAV } from "@/shared/constants/navItems"
import { VISIT_TYPE_LABELS } from "@/types/VisitType"
import type { Visit } from "@/types/Visit"
import type { DocumentSnapshot } from "firebase/firestore"

export function PromoterHistoryPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [visits, setVisits] = useState<Visit[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [nextPage, setNextPage] = useState<DocumentSnapshot | null>(null)

  const loadInitial = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    try {
      const [localResult, serverResult] = await Promise.allSettled([
        getLocalVisits(),
        fetchVisitsByPromoter(user.uid),
      ])

      const localVisits = localResult.status === "fulfilled" ? localResult.value : []
      const { visits: serverVisits, nextPage: next } =
        serverResult.status === "fulfilled"
          ? serverResult.value
          : { visits: [], nextPage: null }

      const map = new Map<string, Visit>()
      for (const v of [...serverVisits, ...localVisits]) {
        const key = v.localId || v.id
        if (!map.has(key) || v.status === "pending_sync") map.set(key, v)
      }

      setVisits(Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt))
      setNextPage(next)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => { loadInitial() }, [loadInitial])

  const loadMore = async () => {
    if (!user || !nextPage || isLoadingMore) return
    setIsLoadingMore(true)
    try {
      const { visits: more, nextPage: next } = await fetchVisitsByPromoter(user.uid, nextPage)
      setVisits((prev) => {
        const map = new Map(prev.map((v) => [v.localId || v.id, v]))
        for (const v of more) {
          const key = v.localId || v.id
          if (!map.has(key)) map.set(key, v)
        }
        return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt)
      })
      setNextPage(next)
    } finally {
      setIsLoadingMore(false)
    }
  }

  return (
    <AppShell title="Historial" navItems={PROMOTER_NAV}>
      {isLoading ? (
        <SkeletonList count={5} />
      ) : visits.length === 0 ? (
        <EmptyState
          icon="📂"
          title="Sin visitas aún"
          description="Tus visitas registradas aparecerán aquí."
        />
      ) : (
        <div className="space-y-3">
          {visits.map((visit) => (
            <button
              key={visit.id}
              onClick={() => navigate(`/visit/${visit.id}`)}
              className="card-interactive w-full text-left"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{visit.storeName}</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    {VISIT_TYPE_LABELS[visit.visitType]}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(visit.createdAt)}</p>
                </div>
                <StatusBadge status={visit.status} />
              </div>
            </button>
          ))}

          {nextPage && (
            <button
              onClick={loadMore}
              disabled={isLoadingMore}
              className="btn btn-secondary w-full"
            >
              {isLoadingMore ? "Cargando…" : "Cargar más"}
            </button>
          )}
        </div>
      )}
    </AppShell>
  )
}
