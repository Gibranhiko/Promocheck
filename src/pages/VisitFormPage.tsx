import { useState, useEffect } from "react"
import { useNavigate, useParams, useBlocker } from "react-router-dom"
import { doc, getDoc } from "firebase/firestore"
import { AppShell } from "@/shared/components/layout/AppShell"
import { CategoryPhotoCapture } from "@/features/camera/components/CategoryPhotoCapture"
import { useAuth } from "@/features/auth/hooks"
import { useVisits } from "@/features/visits/hooks/useVisits"
import { useToast } from "@/shared/store/toastStore"
import { visitSchema } from "@/features/visits/schemas/visitSchema"
import { fetchActiveStores } from "@/features/admin/services/storeService"
import { getVisit, saveVisitLocally, savePhotoLocally, getPhotosForVisit } from "@/services/offline/db"
import { fetchVisit } from "@/features/visits/services/visitService"
import { db as firestoreDb } from "@/services/firebase/firebaseServices"
import {
  ALL_PHOTO_CATEGORIES,
  DEFAULT_REQUIRED_CATEGORIES,
} from "@/types/PhotoCategory"
import {
  VISIT_TYPE_LABELS,
  VISIT_CONDITION_LABELS,
} from "@/types/VisitType"
import type { Visit, VisitType, VisitCondition } from "@/types"
import type { PhotoCategory, LocalPhoto } from "@/types/PhotoCategory"
import type { Store } from "@/types/Store"

interface FieldErrors {
  visitType?: string
  visitDate?: string
  storeId?: string
}

function todayTimestamp(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function timestampToDateInput(ts: number): string {
  return new Date(ts).toISOString().split("T")[0]
}

function dateInputToTimestamp(value: string): number {
  return new Date(value + "T00:00:00").getTime()
}

export function VisitFormPage() {
  const navigate = useNavigate()
  const { id: editId } = useParams<{ id: string }>()
  const isEditMode = !!editId

  const { user } = useAuth()
  const { saveVisitOffline } = useVisits()
  const toast = useToast()

  const [existingVisit, setExistingVisit] = useState<Visit | null>(null)
  const [isLoadingEdit, setIsLoadingEdit] = useState(isEditMode)

  // Form fields
  const [visitType, setVisitType] = useState<VisitType>("routine")
  const [visitDate, setVisitDate] = useState(timestampToDateInput(todayTimestamp()))
  const [selectedStore, setSelectedStore] = useState<Store | null>(null)
  const [stores, setStores] = useState<Store[]>([])
  const [overallCondition, setOverallCondition] = useState<VisitCondition | "">("")
  const [notes, setNotes] = useState("")
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  // Photos: new blobs captured in this session
  const [categoryPhotos, setCategoryPhotos] = useState<Partial<Record<PhotoCategory, Blob[]>>>({})
  // Photos already uploaded (edit mode — shows count badge)
  const [existingPhotoCounts, setExistingPhotoCounts] = useState<Partial<Record<PhotoCategory, number>>>({})

  // Required categories — from Firestore config or default
  const [requiredCategories, setRequiredCategories] = useState<PhotoCategory[]>(DEFAULT_REQUIRED_CATEGORIES)

  const [isSubmitting, setIsSubmitting] = useState(false)

  // Load stores and photo config in parallel
  useEffect(() => {
    fetchActiveStores()
      .then(setStores)
      .catch(() => toast.error("No se pudieron cargar las tiendas"))

    getDoc(doc(firestoreDb, "config", "photo_requirements"))
      .then((snap) => {
        if (snap.exists()) {
          const required = snap.data().required as PhotoCategory[]
          if (Array.isArray(required) && required.length > 0) {
            setRequiredCategories(required)
          }
        }
      })
      .catch(() => {/* use defaults on error */})
  }, [toast])

  // Edit mode: load existing visit and pre-fill
  useEffect(() => {
    if (!isEditMode || !editId) return

    const load = async () => {
      setIsLoadingEdit(true)
      try {
        let visit: Visit | null = (await getVisit(editId)) ?? null
        if (!visit) visit = await fetchVisit(editId)
        if (!visit) {
          toast.error("Visita no encontrada")
          navigate(-1)
          return
        }

        setExistingVisit(visit)
        setVisitType(visit.visitType)
        setVisitDate(timestampToDateInput(visit.visitDate))
        if (visit.overallCondition) setOverallCondition(visit.overallCondition)
        if (visit.notes) setNotes(visit.notes)

        // Count existing uploaded photos per category
        const counts: Partial<Record<PhotoCategory, number>> = {}
        for (const [cat, records] of Object.entries(visit.photos ?? {})) {
          if (Array.isArray(records)) counts[cat as PhotoCategory] = records.length
        }
        setExistingPhotoCounts(counts)

        // If pending_sync, load local blobs for preview
        if (visit.status === "pending_sync") {
          const localPhotos = await getPhotosForVisit(editId)
          const blobs: Partial<Record<PhotoCategory, Blob[]>> = {}
          for (const p of localPhotos) {
            if (!blobs[p.category]) blobs[p.category] = []
            blobs[p.category]![p.sequence] = p.blob
          }
          setCategoryPhotos(blobs)
        }

        fetchActiveStores().then((allStores) => {
          setStores(allStores)
          setSelectedStore(allStores.find((s) => s.id === visit!.storeId) ?? null)
        })
      } catch {
        toast.error("Error al cargar la visita")
        navigate(-1)
      } finally {
        setIsLoadingEdit(false)
      }
    }

    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, isEditMode])

  const handlePhotosChange = (category: PhotoCategory, blobs: Blob[]) => {
    setCategoryPhotos((prev) => ({ ...prev, [category]: blobs }))
  }

  const missingRequired = requiredCategories.filter((cat) => {
    const newCount = categoryPhotos[cat]?.length ?? 0
    const existingCount = existingPhotoCounts[cat] ?? 0
    return newCount === 0 && existingCount === 0
  })

  const handleSubmit = async () => {
    if (!user) return

    const result = visitSchema.safeParse({
      visitType,
      visitDate: dateInputToTimestamp(visitDate),
      storeId: selectedStore?.id ?? "",
      storeName: selectedStore?.name ?? "",
      notes: notes.trim() || undefined,
      overallCondition: overallCondition || undefined,
    })

    const errors: FieldErrors = {}
    if (!result.success) {
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof FieldErrors
        if (field) errors[field] = issue.message
      }
    }
    if (!selectedStore) errors.storeId = "Selecciona una tienda"
    if (missingRequired.length > 0) {
      toast.error("Captura las fotos requeridas antes de guardar")
      setFieldErrors(errors)
      return
    }
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    setIsSubmitting(true)
    try {
      const photosMap = new Map<PhotoCategory, Blob[]>()
      for (const [cat, blobs] of Object.entries(categoryPhotos) as [PhotoCategory, Blob[]][]) {
        if (blobs.length > 0) photosMap.set(cat, blobs)
      }

      if (isEditMode && existingVisit) {
        const updatedVisit: Visit = {
          ...existingVisit,
          visitType,
          visitDate: dateInputToTimestamp(visitDate),
          storeId: selectedStore!.id,
          storeName: selectedStore!.name,
          overallCondition: overallCondition || undefined,
          notes: notes.trim() || undefined,
          photos: existingVisit.photos,
          status: "pending_sync",
          rejectionReason: undefined,
        }
        await saveVisitLocally(updatedVisit)

        // Save newly captured blobs
        for (const [category, blobs] of photosMap) {
          for (let sequence = 0; sequence < blobs.length; sequence++) {
            const photo: LocalPhoto = {
              id: `${existingVisit.id}_${category}_${sequence}`,
              blob: blobs[sequence],
              visitId: existingVisit.id,
              category,
              sequence,
            }
            await savePhotoLocally(photo)
          }
        }

        toast.success(navigator.onLine ? "Actualizada. Subiendo…" : "Actualizada. Se sincronizará cuando haya conexión.")
        navigate("/promoter", { replace: true })
      } else {
        const visitId = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`
        await saveVisitOffline(
          {
            id: visitId,
            localId: visitId,
            visitType,
            visitDate: dateInputToTimestamp(visitDate),
            promoterId: user.uid,
            promoterName: user.name || user.email || "Promotora",
            storeId: selectedStore!.id,
            storeName: selectedStore!.name,
            overallCondition: overallCondition || undefined,
            notes: notes.trim() || undefined,
            photos: {},
            status: "pending_sync",
            createdAt: Date.now(),
          },
          photosMap
        )

        toast.success(navigator.onLine ? "Visita guardada. Subiendo fotos…" : "Guardada localmente. Se sincronizará cuando haya conexión.")
        navigate("/promoter", { replace: true })
      }
    } catch {
      toast.error("Error al guardar la visita. Intenta de nuevo.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const hasAnyChange = visitType !== "routine" || notes.length > 0 ||
    selectedStore !== null || Object.values(categoryPhotos).some((b) => b.length > 0)

  const isFormDirty = isEditMode
    ? (visitType !== existingVisit?.visitType ||
       selectedStore?.id !== existingVisit?.storeId ||
       Object.values(categoryPhotos).some((b) => b.length > 0))
    : hasAnyChange

  const blocker = useBlocker(isFormDirty && !isSubmitting)

  if (isLoadingEdit) {
    return (
      <AppShell title="Editar visita" showBack>
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </AppShell>
    )
  }

  const pageTitle = isEditMode ? "Editar visita" : "Nueva visita"
  const rejectionReason = existingVisit?.rejectionReason

  return (
    <AppShell title={pageTitle} showBack>
      <div className="space-y-6">

        {/* Rejection reason banner */}
        {rejectionReason && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-red-700 mb-1">Rechazada — Por favor corrige y re-envía</p>
            <p className="text-sm text-red-600">{rejectionReason}</p>
          </div>
        )}

        {/* Section 1: Datos de visita */}
        <div className="card">
          <h3 className="font-medium text-gray-900 mb-4">Datos de la visita</h3>
          <div className="space-y-4">

            {/* Store */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tienda <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedStore?.id ?? ""}
                onChange={(e) => {
                  const s = stores.find((s) => s.id === e.target.value) ?? null
                  setSelectedStore(s)
                  setFieldErrors((prev) => ({ ...prev, storeId: undefined }))
                }}
                className={`input ${fieldErrors.storeId ? "input-error" : ""}`}
              >
                <option value="">Selecciona una tienda…</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {fieldErrors.storeId && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.storeId}</p>
              )}
            </div>

            {/* Visit type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tipo de visita <span className="text-red-500">*</span>
              </label>
              <select
                value={visitType}
                onChange={(e) => {
                  setVisitType(e.target.value as VisitType)
                  setFieldErrors((prev) => ({ ...prev, visitType: undefined }))
                }}
                className={`input ${fieldErrors.visitType ? "input-error" : ""}`}
              >
                {Object.entries(VISIT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </div>

            {/* Visit date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fecha de visita <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={visitDate}
                onChange={(e) => {
                  setVisitDate(e.target.value)
                  setFieldErrors((prev) => ({ ...prev, visitDate: undefined }))
                }}
                className={`input ${fieldErrors.visitDate ? "input-error" : ""}`}
                max={timestampToDateInput(Date.now())}
              />
              {fieldErrors.visitDate && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.visitDate}</p>
              )}
            </div>

            {/* Overall condition */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Condición general
              </label>
              <div className="flex gap-3">
                {(Object.entries(VISIT_CONDITION_LABELS) as [VisitCondition, string][]).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setOverallCondition((prev) => prev === value ? "" : value)}
                    className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                      overallCondition === value
                        ? value === "good"
                          ? "border-green-500 bg-green-50 text-green-700"
                          : value === "regular"
                          ? "border-amber-500 bg-amber-50 text-amber-700"
                          : "border-red-500 bg-red-50 text-red-700"
                        : "border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Photos */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900">Evidencia fotográfica</h3>
            {missingRequired.length === 0 ? (
              <span className="text-xs text-green-600 font-medium">✓ Completa</span>
            ) : (
              <span className="text-xs text-gray-500">{missingRequired.length} requerida(s)</span>
            )}
          </div>

          <div className="space-y-4">
            {ALL_PHOTO_CATEGORIES.map((category) => {
              const existingCount = existingPhotoCounts[category] ?? 0
              return (
                <div key={category}>
                  {existingCount > 0 && (
                    <p className="text-xs text-gray-400 mb-1 ml-1">
                      {existingCount} foto(s) ya subida(s)
                    </p>
                  )}
                  <CategoryPhotoCapture
                    category={category}
                    required={requiredCategories.includes(category)}
                    blobs={categoryPhotos[category] ?? []}
                    onPhotosChange={(blobs) => handlePhotosChange(category, blobs)}
                  />
                </div>
              )
            })}
          </div>
        </div>

        {/* Section 3: Notes */}
        <div className="card">
          <h3 className="font-medium text-gray-900 mb-3">Notas</h3>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Observaciones adicionales (opcional)…"
            rows={3}
            maxLength={500}
            className="input resize-none"
          />
          <p className="mt-1 text-xs text-gray-400 text-right">{notes.length}/500</p>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!selectedStore || isSubmitting}
          className="btn btn-primary w-full py-3 text-base touch-target"
        >
          {isSubmitting
            ? "Guardando…"
            : isEditMode
            ? "Guardar y re-enviar"
            : "Guardar visita"}
        </button>
      </div>

      {/* Navigation blocker */}
      {blocker.state === "blocked" && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full p-6 space-y-4">
            <h2 className="font-semibold text-gray-900">¿Descartar cambios?</h2>
            <p className="text-sm text-gray-600">
              Tienes información sin guardar. Si regresas ahora se perderán los datos y fotos capturadas.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => blocker.reset()}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Seguir editando
              </button>
              <button
                onClick={() => blocker.proceed()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Descartar
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  )
}
