import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { AppShell } from "@/shared/components/layout/AppShell"
import { StatusBadge } from "@/shared/components/ui/StatusBadge"
import { SkeletonList } from "@/shared/components/ui/Skeleton"
import { EmptyState } from "@/shared/components/ui/EmptyState"
import { formatDateTime } from "@/shared/utils"
import { useAuthStore } from "@/features/auth/store/authStore"
import { getLocalOperations } from "@/services/offline"
import { fetchOperationsByOperator } from "@/features/operations/services/operationService"
import { OPERATOR_NAV } from "@/shared/constants/navItems"
import type { Operation } from "@/types"
import type { DocumentSnapshot } from "firebase/firestore"

export function OperatorHistoryPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [operations, setOperations] = useState<Operation[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [nextPage, setNextPage] = useState<DocumentSnapshot | null>(null)

  const loadInitial = useCallback(async () => {
    if (!user) return
    setIsLoading(true)
    try {
      const [localResult, serverResult] = await Promise.allSettled([
        getLocalOperations(),
        fetchOperationsByOperator(user.uid),
      ])

      const localOps = localResult.status === "fulfilled" ? localResult.value : []
      const { operations: serverOps, nextPage: next } =
        serverResult.status === "fulfilled"
          ? serverResult.value
          : { operations: [], nextPage: null }

      const map = new Map<string, Operation>()
      for (const op of [...serverOps, ...localOps]) {
        const key = op.localId || op.id
        if (!map.has(key) || op.status === "pending_sync") map.set(key, op)
      }

      setOperations(
        Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt)
      )
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
      const { operations: more, nextPage: next } = await fetchOperationsByOperator(user.uid, nextPage)
      setOperations((prev) => {
        const map = new Map(prev.map((op) => [op.localId || op.id, op]))
        for (const op of more) {
          const key = op.localId || op.id
          if (!map.has(key)) map.set(key, op)
        }
        return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt)
      })
      setNextPage(next)
    } finally {
      setIsLoadingMore(false)
    }
  }

  return (
    <AppShell title="History" navItems={OPERATOR_NAV}>
      {isLoading ? (
        <SkeletonList count={5} />
      ) : operations.length === 0 ? (
        <EmptyState
          icon="📂"
          title="No operations yet"
          description="Your completed loads and unloads will appear here."
        />
      ) : (
        <div className="space-y-3">
          {operations.map((op) => (
            <button
              key={op.id}
              onClick={() => navigate(`/operation/${op.id}`)}
              className="card-interactive w-full text-left"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{op.orderNumber}</p>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Door {op.doorNumber} · <span className="capitalize">{op.operationType}</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDateTime(op.createdAt)}</p>
                </div>
                <StatusBadge status={op.status} />
              </div>
            </button>
          ))}

          {nextPage && (
            <button
              onClick={loadMore}
              disabled={isLoadingMore}
              className="btn btn-secondary w-full"
            >
              {isLoadingMore ? "Loading…" : "Load More"}
            </button>
          )}
        </div>
      )}
    </AppShell>
  )
}
