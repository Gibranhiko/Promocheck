import { useEffect, useState, useCallback } from "react"
import { useParams } from "react-router-dom"
import { FiX, FiCheck, FiDownload } from "react-icons/fi"
import { AppShell } from "@/shared/components/layout/AppShell"
import { StatusBadge } from "@/shared/components/ui/StatusBadge"
import { formatDateTime } from "@/shared/utils"
import {
  fetchOperation,
  updateOperationStatus,
} from "@/features/operations/services/operationService"
import { getOperation, getPhotosForOperation } from "@/services/offline"
import { useToast } from "@/shared/store/toastStore"
import { PHOTO_TYPE_LABELS, isIncidentPhoto } from "@/types/PhotoType"
import { useAuth } from "@/features/auth/hooks"
import { downloadOperationZip } from "@/features/admin/utils/downloadOperationZip"
import type { Operation, OperationStatus } from "@/types/Operation"
import type { PhotoType } from "@/types/PhotoType"

interface PhotoEntry {
  type: PhotoType
  label: string
  src: string
  capturedAt: number | null
  isObjectUrl: boolean
  hasError?: boolean
}

// Statuses admin can set when reviewing a synced operation
const REVIEWABLE_STATUSES: { value: OperationStatus; label: string }[] = [
  { value: "approved", label: "Approve" },
  { value: "rejected", label: "Reject" },
]

export function OperationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const toast = useToast()
  const isAdmin = user?.role === "admin"

  const [operation, setOperation] = useState<Operation | null>(null)
  const [photos, setPhotos] = useState<PhotoEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lightboxPhoto, setLightboxPhoto] = useState<PhotoEntry | null>(null)

  const [pendingStatus, setPendingStatus] = useState<OperationStatus | "">("")
  const [rejectionReason, setRejectionReason] = useState("")
  const [isSavingStatus, setIsSavingStatus] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  const loadOperation = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    setError(null)

    try {
      let op: Operation | null = await fetchOperation(id)
      if (!op) op = (await getOperation(id)) ?? null
      if (!op) { setError("Operation not found"); return }

      setOperation(op)
      setPendingStatus("")

      const photoEntries: PhotoEntry[] = []

      const remotePhotos = op.photos ?? {}
      const hasRemotePhotos = Object.keys(remotePhotos).length > 0

      if (hasRemotePhotos) {
        for (const [type, record] of Object.entries(remotePhotos)) {
          if (!record) continue
          photoEntries.push({
            type: type as PhotoType,
            label: PHOTO_TYPE_LABELS[type as PhotoType] ?? type,
            src: (record as { url: string }).url,
            capturedAt: (record as { capturedAt?: number }).capturedAt ?? null,
            isObjectUrl: false,
          })
        }
      }

      if (photoEntries.length === 0) {
        const localPhotos = await getPhotosForOperation(id)
        for (const photo of localPhotos) {
          photoEntries.push({
            type: photo.photoType,
            label: PHOTO_TYPE_LABELS[photo.photoType],
            src: URL.createObjectURL(photo.blob),
            capturedAt: null,
            isObjectUrl: true,
          })
        }
      }

      photoEntries.sort((a, b) => (a.capturedAt ?? 0) - (b.capturedAt ?? 0))
      setPhotos(photoEntries)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load operation")
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => { loadOperation() }, [loadOperation])

  useEffect(() => {
    return () => {
      photos.forEach((p) => { if (p.isObjectUrl) URL.revokeObjectURL(p.src) })
    }
  }, [photos])

  const handleStatusSave = async () => {
    if (!operation || !pendingStatus || pendingStatus === operation.status) return
    if (pendingStatus === "rejected" && !rejectionReason.trim()) {
      toast.error("Please provide a rejection reason")
      return
    }
    setIsSavingStatus(true)
    try {
      await updateOperationStatus(
        operation.id,
        pendingStatus as OperationStatus,
        pendingStatus === "rejected" ? rejectionReason.trim() : undefined
      )
      setOperation((prev) =>
        prev
          ? {
              ...prev,
              status: pendingStatus as OperationStatus,
              rejectionReason: pendingStatus === "rejected" ? rejectionReason.trim() : undefined,
            }
          : prev
      )
      setRejectionReason("")
      toast.success(pendingStatus === "approved" ? "Operation approved" : "Operation rejected")
    } catch {
      toast.error("Failed to update status")
      setPendingStatus(operation.status)
    } finally {
      setIsSavingStatus(false)
    }
  }

  const handleDownloadZip = async () => {
    if (!operation) return
    setIsDownloading(true)
    try {
      await downloadOperationZip(operation)
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error"
      toast.error(`Failed to download photos: ${message}`)
    } finally {
      setIsDownloading(false)
    }
  }

  if (isLoading) {
    return (
      <AppShell title="Operation Details" showBack>
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    )
  }

  if (error || !operation) {
    return (
      <AppShell title="Operation Details" showBack>
        <div className="card text-center py-12">
          <p className="text-red-600 font-medium">{error ?? "Operation not found"}</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell title="Operation Details" showBack>
      <div className="space-y-6">
        {/* Operation info */}
        <div className="card space-y-4">
          {/* Status row */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Status</span>
              <StatusBadge status={operation.status} />
            </div>

            {/* Admin review controls — shown whenever photos exist and not already approved/rejected */}
            {isAdmin && !["approved", "rejected"].includes(operation.status) && Object.keys(operation.photos ?? {}).length > 0 && (
              <div className="space-y-2 pt-1">
                <div className="flex gap-2">
                  {REVIEWABLE_STATUSES.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setPendingStatus(pendingStatus === s.value ? "" : s.value)}
                      className={`flex-1 btn text-sm py-2 ${
                        pendingStatus === s.value
                          ? s.value === "approved"
                            ? "bg-green-600 text-white"
                            : "bg-red-600 text-white"
                          : "btn-secondary"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>

                {pendingStatus === "rejected" && (
                  <textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Reason for rejection (required)…"
                    className="input w-full text-sm resize-none"
                    rows={3}
                  />
                )}

                {pendingStatus !== "" && (
                  <button
                    onClick={handleStatusSave}
                    disabled={isSavingStatus || (pendingStatus === "rejected" && !rejectionReason.trim())}
                    className={`btn w-full text-sm ${
                      pendingStatus === "approved"
                        ? "bg-green-600 text-white hover:bg-green-700"
                        : "bg-red-600 text-white hover:bg-red-700"
                    }`}
                  >
                    <FiCheck className="w-4 h-4" />
                    {isSavingStatus
                      ? "Saving…"
                      : pendingStatus === "approved"
                      ? "Confirm Approval"
                      : "Confirm Rejection"}
                  </button>
                )}
              </div>
            )}

            {/* Show rejection reason if operation was rejected */}
            {operation.status === "rejected" && operation.rejectionReason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-red-700 mb-1">Rejection Reason</p>
                <p className="text-sm text-red-600">{operation.rejectionReason}</p>
              </div>
            )}
          </div>

          <div>
            <span className="text-sm text-gray-500">Client</span>
            <p className="font-medium">{operation.clientName || "—"}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">Order Number</span>
            <p className="font-medium">{operation.orderNumber}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">Door Number</span>
            <p className="font-medium">{operation.doorNumber}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">Operation Type</span>
            <p className="font-medium capitalize">{operation.operationType}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">Operator</span>
            <p className="font-medium">{operation.operatorName}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">Created</span>
            <p className="font-medium">{formatDateTime(operation.createdAt)}</p>
          </div>
          {operation.syncedAt && (
            <div>
              <span className="text-sm text-gray-500">Synced</span>
              <p className="font-medium">{formatDateTime(operation.syncedAt)}</p>
            </div>
          )}

          {isAdmin && Object.keys(operation.photos ?? {}).length > 0 && (
            <button
              onClick={handleDownloadZip}
              disabled={isDownloading}
              className="btn btn-secondary w-full flex items-center justify-center gap-2"
            >
              <FiDownload className="w-4 h-4" />
              {isDownloading ? "Preparing ZIP…" : "Download Photos as ZIP"}
            </button>
          )}
        </div>

        {/* Photo gallery */}
        {(() => {
          const regularPhotos = photos.filter((p) => !isIncidentPhoto(p.type))
          const incidentPhotos = photos.filter((p) => isIncidentPhoto(p.type))

          const renderGrid = (items: typeof photos) => (
            <div className="grid grid-cols-2 gap-3">
              {items.map((photo) => (
                <button
                  key={photo.type}
                  onClick={() => !photo.hasError && setLightboxPhoto(photo)}
                  className="flex flex-col gap-1 text-left"
                >
                  <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                    {photo.hasError ? (
                      <span className="text-xs text-gray-400 text-center px-2">Failed to load</span>
                    ) : (
                      <img
                        src={photo.src}
                        alt={photo.label}
                        className="w-full h-full object-cover"
                        onError={() =>
                          setPhotos((prev) =>
                            prev.map((p) => p.type === photo.type ? { ...p, hasError: true } : p)
                          )
                        }
                      />
                    )}
                  </div>
                  <span className="text-xs font-medium text-gray-700 truncate px-1">
                    {photo.label}
                  </span>
                  {photo.capturedAt && (
                    <span className="text-xs text-gray-400 px-1">
                      {formatDateTime(photo.capturedAt)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )

          return (
            <>
              <div className="card">
                <h3 className="font-medium text-gray-900 mb-4">Photos ({regularPhotos.length})</h3>
                {regularPhotos.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <p>No photos available</p>
                    {operation.status === "pending_sync" && (
                      <p className="text-xs mt-1">Photos will appear after the operator syncs.</p>
                    )}
                    {operation.status !== "pending_sync" && Object.keys(operation.photos ?? {}).length === 0 && (
                      <p className="text-xs mt-1 text-orange-500">Photos were not found in this operation's record. It may need to be re-synced.</p>
                    )}
                  </div>
                ) : renderGrid(regularPhotos)}
              </div>

              {incidentPhotos.length > 0 && (
                <div className="card border border-amber-200 bg-amber-50">
                  <h3 className="font-medium text-amber-800 mb-4">
                    Incident Photos ({incidentPhotos.length})
                  </h3>
                  {renderGrid(incidentPhotos)}
                </div>
              )}
            </>
          )
        })()}
      </div>

      {/* Lightbox */}
      {lightboxPhoto && (
        <div
          className="fixed inset-0 bg-black z-50 flex flex-col"
          onClick={() => setLightboxPhoto(null)}
        >
          <div
            className="flex items-center justify-between px-4 pt-4 pb-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <p className="text-white font-medium">{lightboxPhoto.label}</p>
              {lightboxPhoto.capturedAt && (
                <p className="text-white/60 text-xs">{formatDateTime(lightboxPhoto.capturedAt)}</p>
              )}
            </div>
            <button
              onClick={() => setLightboxPhoto(null)}
              className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white"
            >
              <FiX className="w-6 h-6" />
            </button>
          </div>
          <div
            className="flex-1 overflow-auto"
            style={{ touchAction: "pinch-zoom" }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={lightboxPhoto.src}
              alt={lightboxPhoto.label}
              className="min-w-full min-h-full object-contain"
              style={{ width: "100vw", height: "calc(100vh - 72px)" }}
            />
          </div>
        </div>
      )}
    </AppShell>
  )
}
