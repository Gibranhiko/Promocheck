import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { FiWifi, FiWifiOff, FiRefreshCw, FiAlertCircle } from "react-icons/fi"
import { AppShell } from "@/shared/components/layout/AppShell"
import { StatusBadge } from "@/shared/components/ui/StatusBadge"
import { SkeletonList } from "@/shared/components/ui/Skeleton"
import { EmptyState } from "@/shared/components/ui/EmptyState"
import { VisitFAB } from "@/shared/components/ui/FAB"
import { formatRelativeTime } from "@/shared/utils"
import { useOnlineStatus } from "@/shared/hooks"
import { useToast } from "@/shared/store/toastStore"
import { useAuth } from "@/features/auth/hooks"
import { getLocalVisits } from "@/services/offline/db"
import { fetchVisitsByPromoter } from "@/features/visits/services/visitService"
import { PROMOTER_NAV } from "@/shared/constants/navItems"
import { VISIT_TYPE_LABELS } from "@/types/VisitType"
import type { Visit } from "@/types/Visit"

const EDITABLE_STATUSES = new Set(["pending_sync", "synced", "rejected"])

export function PromoterPage() {
  const { isOnline, pendingCount, isSyncing, uploadProgress, syncingVisitId, sync } = useOnlineStatus()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [recentVisits, setRecentVisits] = useState<Visit[]>([])
  const [isLoadingVisits, setIsLoadingVisits] = useState(true)
  const toast = useToast()

  const loadRecentVisits = useCallback(async () => {
    const [localResult, serverResult] = await Promise.allSettled([
      getLocalVisits(),
      user
        ? fetchVisitsByPromoter(user.uid)
        : Promise.resolve({ visits: [] as Visit[], nextPage: null }),
    ])

    const localVisits = localResult.status === "fulfilled" ? localResult.value : []
    const serverVisits = serverResult.status === "fulfilled" ? serverResult.value.visits : []

    const map = new Map<string, Visit>()
    for (const v of [...serverVisits, ...localVisits]) {
      const key = v.localId || v.id
      if (!map.has(key) || v.status === "pending_sync") map.set(key, v)
    }

    const sorted = Array.from(map.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5)
    setRecentVisits(sorted)
    setIsLoadingVisits(false)
  }, [user])

  useEffect(() => { loadRecentVisits() }, [loadRecentVisits])

  useEffect(() => {
    if (isOnline) sync()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isSyncing) loadRecentVisits()
  }, [isSyncing, loadRecentVisits])

  const handleSync = async () => {
    await sync()
    await loadRecentVisits()
    toast.success("Sincronización completada")
  }

  const handleVisitTap = (visit: Visit) => {
    if (EDITABLE_STATUSES.has(visit.status)) {
      navigate(`/visit/${visit.id}/edit`)
    }
  }

  const rejectedVisits = recentVisits.filter((v) => v.status === "rejected")
  const otherVisits = recentVisits.filter((v) => v.status !== "rejected")
  const sortedVisits = [...rejectedVisits, ...otherVisits]

  return (
    <AppShell title="Inicio" navItems={PROMOTER_NAV}>
      <div className="space-y-6">
        {/* Rejected visits alert */}
        {rejectedVisits.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <FiAlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700">
                {rejectedVisits.length === 1
                  ? "1 visita fue rechazada"
                  : `${rejectedVisits.length} visitas fueron rechazadas`}
              </p>
              <p className="text-xs text-red-600 mt-0.5">
                Toca la visita para ver el motivo y re-enviarla.
              </p>
            </div>
          </div>
        )}

        {/* Online / sync status */}
        <div className="card space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isOnline ? "bg-success-light" : "bg-surface-tertiary"
              }`}>
                {isOnline
                  ? <FiWifi className="w-5 h-5 text-success" />
                  : <FiWifiOff className="w-5 h-5 text-gray-400" />
                }
              </div>
              <div>
                <p className="font-semibold text-gray-900">
                  {isOnline ? "En línea" : "Sin conexión"}
                </p>
                <p className="text-sm text-gray-500">
                  {isSyncing
                    ? "Subiendo…"
                    : pendingCount > 0
                    ? `${pendingCount} pendiente(s) de sincronizar`
                    : "Todo sincronizado"}
                </p>
              </div>
            </div>
            {pendingCount > 0 && !isSyncing && (
              <button
                onClick={handleSync}
                disabled={!isOnline}
                className="btn btn-secondary"
              >
                <FiRefreshCw className="w-4 h-4" />
                Sincronizar
              </button>
            )}
          </div>
        </div>

        {/* Recent visits */}
        <div>
          <h2 className="section-title mb-3">Visitas recientes</h2>

          {isLoadingVisits ? (
            <SkeletonList count={3} />
          ) : sortedVisits.length === 0 ? (
            <EmptyState
              icon="📋"
              title="Sin visitas aún"
              description="Toca el botón + para registrar tu primera visita."
            />
          ) : (
            <div className="space-y-3">
              {sortedVisits.map((visit) => {
                const isUploadingThis = syncingVisitId === visit.id
                const isRejected = visit.status === "rejected"
                const isEditable = EDITABLE_STATUSES.has(visit.status)

                return (
                  <div
                    key={visit.id}
                    onClick={() => handleVisitTap(visit)}
                    className={`card transition-colors ${
                      isRejected
                        ? "border border-red-200 bg-red-50"
                        : isEditable
                        ? "cursor-pointer active:bg-gray-50"
                        : ""
                    } ${isEditable ? "cursor-pointer" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900">{visit.storeName}</p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          {VISIT_TYPE_LABELS[visit.visitType]} · {formatRelativeTime(visit.createdAt)}
                        </p>
                      </div>
                      <div className="flex-shrink-0 ml-3">
                        <StatusBadge status={visit.status} />
                      </div>
                    </div>

                    {isRejected && visit.rejectionReason && (
                      <div className="mt-2 pt-2 border-t border-red-200">
                        <p className="text-xs font-semibold text-red-700">Motivo de rechazo:</p>
                        <p className="text-xs text-red-600 mt-0.5">{visit.rejectionReason}</p>
                      </div>
                    )}

                    {isUploadingThis && (
                      <div className="mt-3 space-y-1">
                        <p className="text-xs text-gray-500">
                          {uploadProgress
                            ? `Subiendo foto ${uploadProgress.uploaded} de ${uploadProgress.total}…`
                            : "Preparando subida…"}
                        </p>
                        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full transition-all duration-300"
                            style={{
                              width: uploadProgress && uploadProgress.total > 0
                                ? `${(uploadProgress.uploaded / uploadProgress.total) * 100}%`
                                : "5%"
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <VisitFAB disabled={isSyncing} />
    </AppShell>
  )
}
