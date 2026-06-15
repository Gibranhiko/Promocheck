import { useCallback, useEffect } from "react"
import { useOperationStore } from "../store/operationStore"
import {
  fetchOperationsPaginated,
  fetchOperationsByOperator,
} from "../services/operationService"
import type { DocumentSnapshot } from "firebase/firestore"
import {
  getLocalOperations,
  getPendingOperations,
  saveOperationLocally,
  savePhotoLocally,
} from "@/services/offline/db"
import { runSyncEngine } from "@/services/offline/syncEngine"
import type { Operation, LocalPhoto } from "@/types/Operation"
import type { PhotoType } from "@/types/PhotoType"

export function useOperations(operatorId?: string) {
  const {
    operations,
    isLoading,
    error,
    pendingSyncCount,
    setOperations,
    addOperation,
    setLoading,
    setError,
    setPendingSyncCount,
    setLastSyncedAt,
    incrementPendingCount,
  } = useOperationStore()

  const loadLocalOperations = useCallback(async () => {
    const local = await getLocalOperations()
    return local
  }, [])

  const loadServerOperations = useCallback(async (pageParam?: DocumentSnapshot) => {
    setLoading(true)
    setError(null)
    try {
      if (operatorId) {
        const { operations: ops } = await fetchOperationsByOperator(operatorId)
        setOperations(ops)
      } else {
        const { operations: ops } = await fetchOperationsPaginated(pageParam)
        setOperations(ops)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load operations")
    } finally {
      setLoading(false)
    }
  }, [operatorId, setOperations, setLoading, setError])

  const syncPendingOperations = useCallback(async () => {
    try {
      const results = await runSyncEngine()
      const successCount = results.filter((r) => r.success).length
      const failedCount = results.filter((r) => !r.success).length
      
      setLastSyncedAt(Date.now())
      
      if (failedCount > 0) {
        setError(`${failedCount} operation(s) failed to sync`)
      }
      
      return { successCount, failedCount }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed")
      return { successCount: 0, failedCount: 0 }
    }
  }, [setError, setLastSyncedAt])

  const saveOperationOffline = useCallback(async (
    operation: Operation,
    photos: Map<PhotoType, Blob>
  ) => {
    try {
      await saveOperationLocally(operation)
      
      for (const [photoType, blob] of photos) {
        const photo: LocalPhoto = {
          id: `${operation.id}_${photoType}`,
          blob,
          operationId: operation.id,
          photoType,
        }
        await savePhotoLocally(photo)
      }
      
      incrementPendingCount()
      addOperation(operation)
      
      return operation
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save operation")
      throw err
    }
  }, [addOperation, incrementPendingCount, setError])

  const refreshPendingCount = useCallback(async () => {
    const pending = await getPendingOperations()
    setPendingSyncCount(pending.length)
  }, [setPendingSyncCount])

  useEffect(() => {
    refreshPendingCount()
  }, [refreshPendingCount])

  return {
    operations,
    isLoading,
    error,
    pendingSyncCount,
    loadLocalOperations,
    loadServerOperations,
    syncPendingOperations,
    saveOperationOffline,
    refreshPendingCount,
  }
}
