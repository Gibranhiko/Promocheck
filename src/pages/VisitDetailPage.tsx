import { useEffect, useState, useCallback } from "react"
import { useParams } from "react-router-dom"
import { FiX, FiCheck, FiDownload } from "react-icons/fi"
import { AppShell } from "@/shared/components/layout/AppShell"
import { StatusBadge } from "@/shared/components/ui/StatusBadge"
import { formatDateTime } from "@/shared/utils"
import { fetchVisit, updateVisitStatus } from "@/features/visits/services/visitService"
import { getVisit, getPhotosForVisit } from "@/services/offline/db"
import { useToast } from "@/shared/store/toastStore"
import { useAuth } from "@/features/auth/hooks"
import { downloadVisitZip } from "@/features/admin/utils/downloadVisitZip"
import { PHOTO_CATEGORY_LABELS } from "@/types/PhotoCategory"
import { VISIT_TYPE_LABELS, VISIT_CONDITION_LABELS } from "@/types/VisitType"
import type { Visit, VisitStatus } from "@/types"
import type { PhotoCategory } from "@/types/PhotoCategory"

interface PhotoEntry {
  category: PhotoCategory
  sequence: number
  label: string
  src: string
  capturedAt: number | null
  isObjectUrl: boolean
  hasError?: boolean
}

const REVIEWABLE_STATUSES: { value: VisitStatus; label: string }[] = [
  { value: "approved", label: "Aprobar" },
  { value: "rejected", label: "Rechazar" },
]

export function VisitDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const toast = useToast()
  const isAdmin = user?.role === "admin"

  const [visit, setVisit] = useState<Visit | null>(null)
  const [photos, setPhotos] = useState<PhotoEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lightboxPhoto, setLightboxPhoto] = useState<PhotoEntry | null>(null)

  const [pendingStatus, setPendingStatus] = useState<VisitStatus | "">("")
  const [rejectionReason, setRejectionReason] = useState("")
  const [isSavingStatus, setIsSavingStatus] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

  const loadVisit = useCallback(async () => {
    if (!id) return
    setIsLoading(true)
    setError(null)

    try {
      let v: Visit | null = await fetchVisit(id)
      if (!v) v = (await getVisit(id)) ?? null
      if (!v) { setError("Visita no encontrada"); return }

      setVisit(v)
      setPendingStatus("")

      const photoEntries: PhotoEntry[] = []
      const remotePhotos = v.photos ?? {}
      const hasRemotePhotos = Object.keys(remotePhotos).length > 0

      if (hasRemotePhotos) {
        for (const [cat, records] of Object.entries(remotePhotos) as [PhotoCategory, { url: string; capturedAt: number }[]][]) {
          if (!Array.isArray(records)) continue
          records.forEach((record, idx) => {
            photoEntries.push({
              category: cat,
              sequence: idx,
              label: `${PHOTO_CATEGORY_LABELS[cat]} ${idx + 1}`,
              src: record.url,
              capturedAt: record.capturedAt ?? null,
              isObjectUrl: false,
            })
          })
        }
      }

      if (photoEntries.length === 0) {
        const localPhotos = await getPhotosForVisit(id)
        for (const photo of localPhotos) {
          photoEntries.push({
            category: photo.category,
            sequence: photo.sequence,
            label: `${PHOTO_CATEGORY_LABELS[photo.category]} ${photo.sequence + 1}`,
            src: URL.createObjectURL(photo.blob),
            capturedAt: null,
            isObjectUrl: true,
          })
        }
      }

      photoEntries.sort((a, b) => a.category.localeCompare(b.category) || a.sequence - b.sequence)
      setPhotos(photoEntries)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar la visita")
    } finally {
      setIsLoading(false)
    }
  }, [id])

  useEffect(() => { loadVisit() }, [loadVisit])

  useEffect(() => {
    return () => {
      photos.forEach((p) => { if (p.isObjectUrl) URL.revokeObjectURL(p.src) })
    }
  }, [photos])

  const handleStatusSave = async () => {
    if (!visit || !pendingStatus || pendingStatus === visit.status) return
    if (pendingStatus === "rejected" && !rejectionReason.trim()) {
      toast.error("Escribe el motivo de rechazo")
      return
    }
    setIsSavingStatus(true)
    try {
      await updateVisitStatus(
        visit.id,
        pendingStatus as VisitStatus,
        pendingStatus === "rejected" ? rejectionReason.trim() : undefined
      )
      setVisit((prev) =>
        prev ? { ...prev, status: pendingStatus as VisitStatus,
          rejectionReason: pendingStatus === "rejected" ? rejectionReason.trim() : undefined } : prev
      )
      setRejectionReason("")
      toast.success(pendingStatus === "approved" ? "Visita aprobada" : "Visita rechazada")
    } catch {
      toast.error("Error al actualizar el estado")
      setPendingStatus(visit.status)
    } finally {
      setIsSavingStatus(false)
    }
  }

  const handleDownloadZip = async () => {
    if (!visit) return
    setIsDownloading(true)
    try {
      await downloadVisitZip(visit)
    } catch (err) {
      toast.error(`Error al descargar fotos: ${err instanceof Error ? err.message : "Error desconocido"}`)
    } finally {
      setIsDownloading(false)
    }
  }

  if (isLoading) {
    return (
      <AppShell title="Detalle de visita" showBack>
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    )
  }

  if (error || !visit) {
    return (
      <AppShell title="Detalle de visita" showBack>
        <div className="card text-center py-12">
          <p className="text-red-600 font-medium">{error ?? "Visita no encontrada"}</p>
        </div>
      </AppShell>
    )
  }

  // Group photos by category for display
  const photosByCategory = photos.reduce<Record<string, PhotoEntry[]>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = []
    acc[p.category].push(p)
    return acc
  }, {})

  const totalPhotos = photos.length

  return (
    <AppShell title="Detalle de visita" showBack>
      <div className="space-y-6">
        {/* Visit info */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Estado</span>
            <StatusBadge status={visit.status} />
          </div>

          {/* Admin review controls */}
          {isAdmin && !["approved", "rejected"].includes(visit.status) && totalPhotos > 0 && (
            <div className="space-y-2 pt-1">
              <div className="flex gap-2">
                {REVIEWABLE_STATUSES.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => setPendingStatus(pendingStatus === s.value ? "" : s.value)}
                    className={`flex-1 btn text-sm py-2 ${
                      pendingStatus === s.value
                        ? s.value === "approved" ? "bg-green-600 text-white" : "bg-red-600 text-white"
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
                  placeholder="Motivo de rechazo (requerido)…"
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
                    ? "Guardando…"
                    : pendingStatus === "approved" ? "Confirmar aprobación" : "Confirmar rechazo"}
                </button>
              )}
            </div>
          )}

          {visit.status === "rejected" && visit.rejectionReason && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-red-700 mb-1">Motivo de rechazo</p>
              <p className="text-sm text-red-600">{visit.rejectionReason}</p>
            </div>
          )}

          <div>
            <span className="text-sm text-gray-500">Tienda</span>
            <p className="font-medium">{visit.storeName}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">Tipo de visita</span>
            <p className="font-medium">{VISIT_TYPE_LABELS[visit.visitType]}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">Fecha de visita</span>
            <p className="font-medium">{new Date(visit.visitDate).toLocaleDateString("es-MX", { dateStyle: "long" })}</p>
          </div>
          {visit.overallCondition && (
            <div>
              <span className="text-sm text-gray-500">Condición general</span>
              <p className="font-medium">{VISIT_CONDITION_LABELS[visit.overallCondition]}</p>
            </div>
          )}
          {visit.notes && (
            <div>
              <span className="text-sm text-gray-500">Notas</span>
              <p className="font-medium">{visit.notes}</p>
            </div>
          )}
          <div>
            <span className="text-sm text-gray-500">Promotora</span>
            <p className="font-medium">{visit.promoterName}</p>
          </div>
          <div>
            <span className="text-sm text-gray-500">Creada</span>
            <p className="font-medium">{formatDateTime(visit.createdAt)}</p>
          </div>
          {visit.syncedAt && (
            <div>
              <span className="text-sm text-gray-500">Sincronizada</span>
              <p className="font-medium">{formatDateTime(visit.syncedAt)}</p>
            </div>
          )}

          {isAdmin && totalPhotos > 0 && (
            <button
              onClick={handleDownloadZip}
              disabled={isDownloading}
              className="btn btn-secondary w-full flex items-center justify-center gap-2"
            >
              <FiDownload className="w-4 h-4" />
              {isDownloading ? "Preparando ZIP…" : "Descargar fotos como ZIP"}
            </button>
          )}
        </div>

        {/* Photo gallery grouped by category */}
        {Object.keys(photosByCategory).length === 0 ? (
          <div className="card text-center py-8 text-gray-400">
            <p>Sin fotos disponibles</p>
            {visit.status === "pending_sync" && (
              <p className="text-xs mt-1">Las fotos aparecerán después de sincronizar.</p>
            )}
          </div>
        ) : (
          Object.entries(photosByCategory).map(([cat, items]) => (
            <div key={cat} className="card">
              <h3 className="font-medium text-gray-900 mb-4">
                {PHOTO_CATEGORY_LABELS[cat as PhotoCategory]} ({items.length})
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {items.map((photo) => (
                  <button
                    key={`${photo.category}-${photo.sequence}`}
                    onClick={() => !photo.hasError && setLightboxPhoto(photo)}
                    className="flex flex-col gap-1 text-left"
                  >
                    <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 flex items-center justify-center">
                      {photo.hasError ? (
                        <span className="text-xs text-gray-400 text-center px-2">No disponible</span>
                      ) : (
                        <img
                          src={photo.src}
                          alt={photo.label}
                          className="w-full h-full object-cover"
                          onError={() =>
                            setPhotos((prev) =>
                              prev.map((p) =>
                                p.category === photo.category && p.sequence === photo.sequence
                                  ? { ...p, hasError: true } : p
                              )
                            )
                          }
                        />
                      )}
                    </div>
                    {photo.capturedAt && (
                      <span className="text-xs text-gray-400 px-1">{formatDateTime(photo.capturedAt)}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Lightbox */}
      {lightboxPhoto && (
        <div className="fixed inset-0 bg-black z-50 flex flex-col" onClick={() => setLightboxPhoto(null)}>
          <div className="flex items-center justify-between px-4 pt-4 pb-2" onClick={(e) => e.stopPropagation()}>
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
          <div className="flex-1 overflow-auto" style={{ touchAction: "pinch-zoom" }} onClick={(e) => e.stopPropagation()}>
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
