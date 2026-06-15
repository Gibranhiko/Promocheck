import { useState, useEffect } from "react"
import { useNavigate, useSearchParams, useParams, useBlocker } from "react-router-dom"
import { AppShell } from "@/shared/components/layout/AppShell"
import { CameraCapture } from "@/features/camera"
import { useAuth } from "@/features/auth/hooks"
import { useOperations } from "@/features/operations/hooks"
import { useToast } from "@/shared/store/toastStore"
import { operationSchema } from "@/features/operations/schemas/operationSchema"
import { PHOTO_TYPE_LABELS, INCIDENT_PHOTO_TYPES, getRequiredPhotosForType } from "@/types/PhotoType"
import { fetchActiveClients, type Client } from "@/features/admin/services/clientService"
import { getOperation, saveOperationLocally, savePhotoLocally, getPhotosForOperation } from "@/services/offline"
import { fetchOperation } from "@/features/operations/services/operationService"
import type { PhotoType, IncidentPhotoType } from "@/types/PhotoType"
import type { Operation, PhotoRecord } from "@/types/Operation"

interface FieldErrors {
  orderNumber?: string
  doorNumber?: string
  clientId?: string
}

export function OperationFormPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { id: editId } = useParams<{ id: string }>()
  const isEditMode = !!editId

  const operationType: "load" | "unload" = searchParams.get("type") === "unload" ? "unload" : "load"

  const { user } = useAuth()
  const { saveOperationOffline } = useOperations()
  const toast = useToast()

  const [existingOperation, setExistingOperation] = useState<Operation | null>(null)
  const [isLoadingEdit, setIsLoadingEdit] = useState(isEditMode)

  // Existing photo URLs (from previous upload) — preserved for photos not re-captured
  const [existingPhotoUrls, setExistingPhotoUrls] = useState<Partial<Record<PhotoType, PhotoRecord>>>({})

  const [orderNumber, setOrderNumber] = useState("")
  const [doorNumber, setDoorNumber] = useState("")
  const [editOperationType, setEditOperationType] = useState<"load" | "unload">(operationType)
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [photos, setPhotos] = useState<Partial<Record<PhotoType, Blob>>>({})
  const [capturingFor, setCapturingFor] = useState<PhotoType | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showIncident, setShowIncident] = useState(false)
  const [incidentCount, setIncidentCount] = useState(1)

  const activeOperationType = isEditMode ? editOperationType : operationType

  // Load clients
  useEffect(() => {
    fetchActiveClients()
      .then(setClients)
      .catch(() => toast.error("Could not load clients"))
  }, [toast])

  // In edit mode, load the existing operation and pre-fill the form
  useEffect(() => {
    if (!isEditMode || !editId) return

    const load = async () => {
      setIsLoadingEdit(true)
      try {
        let op: Operation | null = (await getOperation(editId)) ?? null
        if (!op) op = await fetchOperation(editId)
        if (!op) {
          toast.error("Operation not found")
          navigate(-1)
          return
        }

        setExistingOperation(op)
        setOrderNumber(op.orderNumber)
        setDoorNumber(op.doorNumber)
        setEditOperationType(op.operationType)

        // Pre-fill existing photo URLs (remote) so we know what's already on file
        if (op.photos && Object.keys(op.photos).length > 0) {
          setExistingPhotoUrls(op.photos)
        } else if (op.status === "pending_sync") {
          // Load local blobs and convert to object URLs for preview
          const localPhotos = await getPhotosForOperation(editId)
          const blobs: Partial<Record<PhotoType, Blob>> = {}
          for (const p of localPhotos) {
            blobs[p.photoType] = p.blob
          }
          setPhotos(blobs)
        }

        // Wait for clients to load then pre-select
        fetchActiveClients().then((allClients) => {
          const client = allClients.find((c) => c.id === op!.clientId) ?? null
          setSelectedClient(client)
          setClients(allClients)
        })
      } catch {
        toast.error("Failed to load operation")
        navigate(-1)
      } finally {
        setIsLoadingEdit(false)
      }
    }

    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, isEditMode])

  const requiredPhotos = getRequiredPhotosForType(activeOperationType)

  // A photo is considered "captured" if we have a new blob OR an existing URL
  const isPhotoCaptured = (type: PhotoType): boolean => {
    return !!photos[type] || !!existingPhotoUrls[type]
  }

  const capturedRequiredCount = requiredPhotos.filter(isPhotoCaptured).length
  const allPhotosCaptured = capturedRequiredCount === requiredPhotos.length

  const validateField = (field: "orderNumber" | "doorNumber", value: string): string | undefined => {
    const result = operationSchema.pick({ [field]: true } as Record<typeof field, true>).safeParse({ [field]: value })
    if (!result.success) return result.error.errors[0].message
    return undefined
  }

  const handleOrderNumberChange = (value: string) => {
    const upper = value.toUpperCase()
    setOrderNumber(upper)
    setFieldErrors((prev) => ({ ...prev, orderNumber: validateField("orderNumber", upper) }))
  }

  const handleDoorNumberChange = (value: string) => {
    const upper = value.toUpperCase()
    setDoorNumber(upper)
    setFieldErrors((prev) => ({ ...prev, doorNumber: validateField("doorNumber", upper) }))
  }

  const handlePhotoCapture = (blob: Blob, photoType: PhotoType) => {
    setPhotos((prev) => ({ ...prev, [photoType]: blob }))
    setCapturingFor(null)
  }

  const handleSubmit = async () => {
    if (!user) return

    const result = operationSchema.safeParse({ orderNumber, doorNumber, operationType: activeOperationType })
    const errors: FieldErrors = {}
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof FieldErrors
        if (field) errors[field] = issue.message
      }
    }
    if (!selectedClient) errors.clientId = "Please select a client"
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }
    if (!allPhotosCaptured) return

    setIsSubmitting(true)

    try {
      if (isEditMode && existingOperation) {
        // EDIT MODE: update local record and reset to pending_sync
        const updatedOp: Operation = {
          ...existingOperation,
          orderNumber: result.data!.orderNumber,
          doorNumber: result.data!.doorNumber,
          clientId: selectedClient!.id,
          clientName: selectedClient!.name,
          // Keep existing photo URLs; new blobs are saved to IndexedDB separately
          photos: existingPhotoUrls,
          status: "pending_sync",
          rejectionReason: undefined,
        }
        await saveOperationLocally(updatedOp)

        // Save only newly captured blobs (overwrite if photo was re-taken)
        for (const [photoType, blob] of Object.entries(photos) as [PhotoType, Blob][]) {
          await savePhotoLocally({
            id: `${existingOperation.id}_${photoType}`,
            blob,
            operationId: existingOperation.id,
            photoType,
          })
        }

        toast.success(navigator.onLine ? "Updated. Uploading…" : "Updated locally. Will sync when online.")
        navigate("/operator", { replace: true })
      } else {
        // CREATE MODE: new operation
        const operationId = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`
        const isOnline = navigator.onLine
        const photosMap = new Map(Object.entries(photos)) as Map<PhotoType, Blob>

        await saveOperationOffline(
          {
            id: operationId,
            localId: operationId,
            orderNumber: result.data!.orderNumber,
            doorNumber: result.data!.doorNumber,
            operationType: activeOperationType,
            operatorId: user.uid,
            operatorName: user.name || user.email || "Unknown",
            clientId: selectedClient!.id,
            clientName: selectedClient!.name,
            photos: {},
            status: "pending_sync",
            createdAt: Date.now(),
          },
          photosMap
        )

        toast.success(isOnline ? "Operation saved. Uploading photos…" : "Saved locally. Will sync when online.")
        navigate("/operator", { replace: true })
      }
    } catch {
      toast.error("Failed to save operation. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const isFormValid = !fieldErrors.orderNumber && !fieldErrors.doorNumber &&
    orderNumber.length > 0 && doorNumber.length > 0 && !!selectedClient && allPhotosCaptured

  // Block navigation away from a dirty form (iOS swipe-back, Android hardware back, browser back)
  const isFormDirty = isEditMode
    ? (orderNumber !== (existingOperation?.orderNumber ?? "") ||
       doorNumber !== (existingOperation?.doorNumber ?? "") ||
       selectedClient?.id !== existingOperation?.clientId ||
       Object.keys(photos).length > 0)
    : (orderNumber.length > 0 || doorNumber.length > 0 || selectedClient !== null || Object.keys(photos).length > 0)

  const blocker = useBlocker(isFormDirty && !isSubmitting)

  if (isLoadingEdit) {
    return (
      <AppShell title="Edit Operation" showBack>
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    )
  }

  const pageTitle = isEditMode
    ? `Edit ${activeOperationType === "load" ? "Load" : "Unload"}`
    : activeOperationType === "load" ? "New Load" : "New Unload"

  // Show rejection reason banner if editing a rejected operation
  const rejectionReason = existingOperation?.rejectionReason

  return (
    <AppShell title={pageTitle} showBack>
      <div className="space-y-6">
        {/* Rejection reason banner */}
        {rejectionReason && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-red-700 mb-1">Rejected — Please fix and re-submit</p>
            <p className="text-sm text-red-600">{rejectionReason}</p>
          </div>
        )}

        <div className="card">
          <h3 className="font-medium text-gray-900 mb-4">Operation Details</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client
              </label>
              <select
                value={selectedClient?.id ?? ""}
                onChange={(e) => {
                  const c = clients.find((c) => c.id === e.target.value) ?? null
                  setSelectedClient(c)
                  setFieldErrors((prev) => ({ ...prev, clientId: undefined }))
                }}
                className={`input ${fieldErrors.clientId ? "input-error" : ""}`}
              >
                <option value="">Select a client…</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              {fieldErrors.clientId && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.clientId}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Order Number
              </label>
              <input
                type="text"
                value={orderNumber}
                onChange={(e) => handleOrderNumberChange(e.target.value)}
                placeholder="e.g., ORD12345"
                className={`input ${fieldErrors.orderNumber ? "input-error" : ""}`}
                maxLength={20}
              />
              {fieldErrors.orderNumber && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.orderNumber}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Door Number
              </label>
              <input
                type="text"
                value={doorNumber}
                onChange={(e) => handleDoorNumberChange(e.target.value)}
                placeholder="e.g., D01"
                className={`input ${fieldErrors.doorNumber ? "input-error" : ""}`}
                maxLength={10}
              />
              {fieldErrors.doorNumber && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.doorNumber}</p>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900">Required Photos</h3>
            <span className="text-sm text-gray-500">
              {capturedRequiredCount} / {requiredPhotos.length}
            </span>
          </div>

          <div className="space-y-3">
            {requiredPhotos.map((photoType) => {
              const hasNewBlob = !!photos[photoType]
              const hasExistingUrl = !!existingPhotoUrls[photoType]
              const isCaptured = hasNewBlob || hasExistingUrl
              const label = hasNewBlob ? "Re-captured" : hasExistingUrl ? "On file" : null

              return (
                <div
                  key={photoType}
                  className={`p-3 rounded-lg border ${
                    isCaptured
                      ? "border-green-300 bg-green-50"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">
                      {PHOTO_TYPE_LABELS[photoType]}
                    </span>
                    <div className="flex items-center gap-2">
                      {label && (
                        <span className="text-green-600 text-sm font-medium">{label}</span>
                      )}
                      <button
                        onClick={() => setCapturingFor(photoType)}
                        className={`btn text-sm py-1 ${isCaptured ? "btn-secondary" : "btn-primary"}`}
                      >
                        {isCaptured ? "Re-take" : "Capture"}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Incident photos — optional */}
        <div className="card">
          <button
            type="button"
            onClick={() => setShowIncident((v) => !v)}
            className="w-full flex items-center justify-between text-left"
          >
            <div>
              <h3 className="font-medium text-amber-700">Report an Incident</h3>
              <p className="text-xs text-gray-500 mt-0.5">Optional — attach up to 3 incident photos</p>
            </div>
            <span className="text-amber-600 text-sm font-medium">
              {showIncident ? "Hide" : "Add"}
            </span>
          </button>

          {showIncident && (
            <div className="mt-4 space-y-3">
              {INCIDENT_PHOTO_TYPES.slice(0, incidentCount).map((photoType: IncidentPhotoType) => (
                <div
                  key={photoType}
                  className={`p-3 rounded-lg border ${
                    photos[photoType]
                      ? "border-amber-300 bg-amber-50"
                      : "border-gray-200 bg-gray-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900 text-sm">
                      {PHOTO_TYPE_LABELS[photoType]}
                    </span>
                    {photos[photoType] ? (
                      <div className="flex items-center gap-2">
                        <span className="text-amber-600 text-sm font-medium">Captured</span>
                        <button
                          type="button"
                          onClick={() => setPhotos((prev) => { const next = { ...prev }; delete next[photoType]; return next })}
                          className="text-gray-400 hover:text-red-500 text-xs"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setCapturingFor(photoType)}
                        className="btn btn-secondary text-sm py-1"
                      >
                        Capture
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {incidentCount < INCIDENT_PHOTO_TYPES.length && (
                <button
                  type="button"
                  onClick={() => setIncidentCount((n) => Math.min(n + 1, INCIDENT_PHOTO_TYPES.length))}
                  className="text-sm text-amber-600 font-medium"
                >
                  + Add another photo
                </button>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!isFormValid || isSubmitting}
          className="btn btn-primary w-full py-3 text-base touch-target"
        >
          {isSubmitting
            ? "Saving..."
            : isEditMode
            ? "Save & Re-submit"
            : "Save Operation"}
        </button>
      </div>

      {capturingFor && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] overflow-auto">
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold">Capture {PHOTO_TYPE_LABELS[capturingFor]}</h2>
              <button
                onClick={() => setCapturingFor(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            <div className="p-4">
              <CameraCapture
                photoType={capturingFor}
                onCapture={handlePhotoCapture}
                onCancel={() => setCapturingFor(null)}
              />
            </div>
          </div>
        </div>
      )}

      {blocker.state === "blocked" && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">Discard changes?</h2>
            <p className="text-sm text-gray-600">
              You have unsaved data. If you go back now, all entered information and captured photos will be lost.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => blocker.reset()}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Keep editing
              </button>
              <button
                onClick={() => blocker.proceed()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
