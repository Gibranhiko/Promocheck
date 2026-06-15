import { useEffect, useState, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { FiWifi, FiWifiOff, FiRefreshCw, FiAlertCircle } from "react-icons/fi"
import { AppShell } from "@/shared/components/layout/AppShell"
import { StatusBadge } from "@/shared/components/ui/StatusBadge"
import { SkeletonList } from "@/shared/components/ui/Skeleton"
import { EmptyState } from "@/shared/components/ui/EmptyState"
import { OperationFAB } from "@/shared/components/ui/FAB"
import { formatRelativeTime } from "@/shared/utils"
import { useOnlineStatus } from "@/shared/hooks"
import { useToast } from "@/shared/store/toastStore"
import { useAuth } from "@/features/auth/hooks"
import { getLocalOperations } from "@/services/offline"
import { fetchOperationsByOperator } from "@/features/operations/services/operationService"
import { OPERATOR_NAV } from "@/shared/constants/navItems"
import type { Operation } from "@/types"

// Statuses that allow the operator to open and edit the operation
const EDITABLE_STATUSES = new Set(["pending_sync", "synced", "rejected"])

export function OperatorPage() {
  const { isOnline, pendingCount, isSyncing, uploadProgress, syncingOperationId, sync } = useOnlineStatus()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [recentOperations, setRecentOperations] = useState<Operation[]>([])
  const [isLoadingOps, setIsLoadingOps] = useState(true)
  const toast = useToast()

  const loadRecentOperations = useCallback(async () => {
    const [localResult, serverResult] = await Promise.allSettled([
      getLocalOperations(),
      user
        ? fetchOperationsByOperator(user.uid)
        : Promise.resolve({ operations: [] as Operation[], nextPage: null }),
    ])

    const localOps = localResult.status === "fulfilled" ? localResult.value : []
    const serverOps = serverResult.status === "fulfilled" ? serverResult.value.operations : []

    const map = new Map<string, Operation>()
    for (const op of [...serverOps, ...localOps]) {
      const key = op.localId || op.id
      if (!map.has(key) || op.status === "pending_sync") map.set(key, op)
    }

    const sorted = Array.from(map.values())
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 5)
    setRecentOperations(sorted)
    setIsLoadingOps(false)
  }, [user])

  useEffect(() => {
    loadRecentOperations()
  }, [loadRecentOperations])

  useEffect(() => {
    if (isOnline) sync()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!isSyncing) loadRecentOperations()
  }, [isSyncing, loadRecentOperations])

  const handleSync = async () => {
    await sync()
    await loadRecentOperations()
    toast.success("Sync complete")
  }

  const handleOperationTap = (op: Operation) => {
    if (EDITABLE_STATUSES.has(op.status)) {
      navigate(`/operation/${op.id}/edit`)
    }
  }

  // Sort rejected operations to the top
  const rejectedOps = recentOperations.filter((op) => op.status === "rejected")
  const otherOps = recentOperations.filter((op) => op.status !== "rejected")
  const sortedOperations = [...rejectedOps, ...otherOps]

  return (
    <AppShell title="Home" navItems={OPERATOR_NAV}>
      <div className="space-y-6">
        {/* Rejected operations alert banner */}
        {rejectedOps.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <FiAlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700">
                {rejectedOps.length === 1
                  ? "1 operation was rejected"
                  : `${rejectedOps.length} operations were rejected`}
              </p>
              <p className="text-xs text-red-600 mt-0.5">
                Tap the operation below to see the reason and re-submit.
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
                  {isOnline ? "Online" : "Offline"}
                </p>
                <p className="text-sm text-gray-500">
                  {isSyncing
                    ? "Uploading…"
                    : pendingCount > 0
                    ? `${pendingCount} pending sync`
                    : "All synced"}
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
                Sync
              </button>
            )}
          </div>
        </div>

        {/* Recent operations */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="section-title">Recent Operations</h2>
          </div>

          {isLoadingOps ? (
            <SkeletonList count={3} />
          ) : sortedOperations.length === 0 ? (
            <EmptyState
              icon="📋"
              title="No operations yet"
              description="Tap the + button to record your first load or unload."
            />
          ) : (
            <div className="space-y-3">
              {sortedOperations.map((op) => {
                const isUploadingThis = syncingOperationId === op.id
                const isRejected = op.status === "rejected"
                const isEditable = EDITABLE_STATUSES.has(op.status)

                return (
                  <div
                    key={op.id}
                    onClick={() => handleOperationTap(op)}
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
                        <p className="font-semibold text-gray-900">{op.orderNumber}</p>
                        <p className="text-sm text-gray-500 mt-0.5">
                          Door {op.doorNumber} · <span className="capitalize">{op.operationType}</span> · {formatRelativeTime(op.createdAt)}
                        </p>
                      </div>
                      <div className="flex-shrink-0 ml-3">
                        <StatusBadge status={op.status} />
                      </div>
                    </div>

                    {/* Rejection reason inline */}
                    {isRejected && op.rejectionReason && (
                      <div className="mt-2 pt-2 border-t border-red-200">
                        <p className="text-xs font-semibold text-red-700">Rejection reason:</p>
                        <p className="text-xs text-red-600 mt-0.5">{op.rejectionReason}</p>
                      </div>
                    )}

                    {isUploadingThis && (
                      <div className="mt-3 space-y-1">
                        <p className="text-xs text-gray-500">
                          {uploadProgress
                            ? `Uploading photo ${uploadProgress.uploaded} of ${uploadProgress.total}…`
                            : "Preparing upload…"}
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

      <OperationFAB disabled={isSyncing} />
    </AppShell>
  )
}
