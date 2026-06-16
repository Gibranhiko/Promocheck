import { useCallback, useEffect } from "react"
import { useVisitStore } from "../store/visitStore"
import {
  fetchVisitsPaginated,
  fetchVisitsByPromoter,
} from "../services/visitService"
import type { DocumentSnapshot } from "firebase/firestore"
import {
  getLocalVisits,
  getPendingVisits,
  saveVisitLocally,
  savePhotoLocally,
} from "@/services/offline/db"
import { runSyncEngine } from "@/services/offline/syncEngine"
import type { Visit } from "@/types/Visit"
import type { PhotoCategory, LocalPhoto } from "@/types/PhotoCategory"

export function useVisits(promoterId?: string) {
  const {
    visits,
    isLoading,
    error,
    pendingSyncCount,
    setVisits,
    addVisit,
    setLoading,
    setError,
    setPendingSyncCount,
    setLastSyncedAt,
    incrementPendingCount,
  } = useVisitStore()

  const loadLocalVisits = useCallback(async () => {
    return getLocalVisits()
  }, [])

  const loadServerVisits = useCallback(async (pageParam?: DocumentSnapshot) => {
    setLoading(true)
    setError(null)
    try {
      if (promoterId) {
        const { visits: serverVisits } = await fetchVisitsByPromoter(promoterId)
        setVisits(serverVisits)
      } else {
        const { visits: serverVisits } = await fetchVisitsPaginated(pageParam)
        setVisits(serverVisits)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar visitas")
    } finally {
      setLoading(false)
    }
  }, [promoterId, setVisits, setLoading, setError])

  const syncPendingVisits = useCallback(async () => {
    try {
      const results = await runSyncEngine()
      const successCount = results.filter((r) => r.success).length
      const failedCount = results.filter((r) => !r.success).length

      setLastSyncedAt(Date.now())

      if (failedCount > 0) {
        setError(`${failedCount} visita(s) no se pudieron sincronizar`)
      }

      return { successCount, failedCount }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al sincronizar")
      return { successCount: 0, failedCount: 0 }
    }
  }, [setError, setLastSyncedAt])

  // photos: Map<PhotoCategory, Blob[]> — múltiples fotos por categoría
  const saveVisitOffline = useCallback(async (
    visit: Visit,
    photos: Map<PhotoCategory, Blob[]>
  ) => {
    try {
      await saveVisitLocally(visit)

      for (const [category, blobs] of photos) {
        for (let sequence = 0; sequence < blobs.length; sequence++) {
          const photo: LocalPhoto = {
            id: `${visit.id}_${category}_${sequence}`,
            blob: blobs[sequence],
            visitId: visit.id,
            category,
            sequence,
          }
          await savePhotoLocally(photo)
        }
      }

      incrementPendingCount()
      addVisit(visit)

      return visit
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar visita")
      throw err
    }
  }, [addVisit, incrementPendingCount, setError])

  const refreshPendingCount = useCallback(async () => {
    const pending = await getPendingVisits()
    setPendingSyncCount(pending.length)
  }, [setPendingSyncCount])

  useEffect(() => {
    refreshPendingCount()
  }, [refreshPendingCount])

  return {
    visits,
    isLoading,
    error,
    pendingSyncCount,
    loadLocalVisits,
    loadServerVisits,
    syncPendingVisits,
    saveVisitOffline,
    refreshPendingCount,
  }
}
