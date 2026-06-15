import {
  getPendingOperations,
  markOperationSynced,
  markOperationError,
  getPhotosForOperation,
  saveOperationLocally,
} from "./db"
import {
  syncOperationToFirestore,
  uploadPhotoToStorage,
  updateOperationPhotos,
} from "@/features/operations/services/operationService"
import { auth } from "@/services/firebase"
import type { Operation, PhotoRecord } from "@/types/Operation"
import type { PhotoType } from "@/types/PhotoType"

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2000

export type SyncStatus = "idle" | "syncing" | "error" | "success"

export interface SyncResult {
  success: boolean
  operationId: string
  error?: string
  retries: number
  syncedAt?: number
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function syncOperationWithRetry(
  op: Operation,
  onPhotoUploaded?: () => void
): Promise<SyncResult> {
  let retries = 0
  let lastError: Error | null = null

  while (retries < MAX_RETRIES) {
    try {
      // 1. Save operation to Firestore first (empty photos) using local ID as doc ID.
      //    setDoc is idempotent so retries are safe.
      await syncOperationToFirestore(op)

      // 2. Upload photos now that the Firestore doc exists (storage rules read it).
      const photos = await getPhotosForOperation(op.id)
      const photoUrls: Partial<Record<PhotoType, PhotoRecord>> = {}
      for (const photo of photos) {
        const record = await uploadPhotoToStorage(op.id, photo.photoType, photo.blob)
        photoUrls[photo.photoType] = record
        onPhotoUploaded?.()
      }

      // 3. Update Firestore doc with the photo download URLs.
      //    Merge with any existing photo URLs already on the operation (re-submissions
      //    keep un-re-captured photos from the previous upload).
      const mergedPhotos = { ...(op.photos ?? {}), ...photoUrls }
      await updateOperationPhotos(op.id, mergedPhotos)

      // 4. Update local IndexedDB record.
      const syncedOp: Operation = {
        ...op,
        status: "synced",
        syncedAt: Date.now(),
        photos: mergedPhotos,
        rejectionReason: undefined,
      }
      await saveOperationLocally(syncedOp)
      await markOperationSynced(op.id)

      return { success: true, operationId: op.id, retries, syncedAt: Date.now() }
    } catch (err) {
      lastError = err instanceof Error ? err : null
      retries++
      if (import.meta.env.DEV) console.error(`Sync attempt ${retries} failed for operation ${op.id}:`, err)
      if (retries < MAX_RETRIES) {
        await delay(RETRY_DELAY_MS * retries)
      }
    }
  }

  const errorMessage = lastError?.message ?? "Max retries exceeded"
  await markOperationError(op.id, errorMessage)
  return { success: false, operationId: op.id, retries, error: errorMessage }
}

export async function runSyncEngine(
  onProgress?: (uploaded: number, total: number) => void,
  onOperationStart?: (operationId: string) => void
): Promise<SyncResult[]> {
  const pending = await getPendingOperations()
  if (pending.length === 0) return []

  const currentUid = auth.currentUser?.uid
  const ownOps = pending.filter((op) => {
    if (op.operatorId !== currentUid) {
      if (import.meta.env.DEV) console.warn(`Skipping operation ${op.id}: operatorId mismatch`)
      return false
    }
    return true
  })

  // Count total photos across all operations upfront so the progress bar has a total.
  let total = 0
  for (const op of ownOps) {
    const photos = await getPhotosForOperation(op.id)
    total += photos.length
  }
  let uploaded = 0
  onProgress?.(0, total)

  const results: SyncResult[] = []
  for (const op of ownOps) {
    onOperationStart?.(op.id)
    const result = await syncOperationWithRetry(op, () => {
      uploaded++
      onProgress?.(uploaded, total)
    })
    results.push(result)
  }
  return results
}

let syncIntervalId: ReturnType<typeof setInterval> | ReturnType<typeof setTimeout> | null = null

export function supportsBackgroundSync(): boolean {
  return "serviceWorker" in navigator && "SyncManager" in window
}

export async function registerBackgroundSync(): Promise<boolean> {
  if (!supportsBackgroundSync()) return false
  try {
    const registration = await navigator.serviceWorker.ready
    await (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register("sync-operations")
    return true
  } catch (err) {
    if (import.meta.env.DEV) console.warn("Background Sync registration failed:", err)
    return false
  }
}

export function startBackgroundSync(intervalMs = 5 * 60 * 1000): void {
  if (syncIntervalId !== null) return
  syncIntervalId = setInterval(async () => {
    if (navigator.onLine) {
      await runSyncEngine()
    }
  }, intervalMs) as unknown as typeof syncIntervalId
}

export function stopBackgroundSync(): void {
  if (syncIntervalId !== null) {
    clearInterval(syncIntervalId)
    syncIntervalId = null
  }
}

export const syncEngine = {
  runSyncEngine,
  startBackgroundSync,
  stopBackgroundSync,
  supportsBackgroundSync,
  registerBackgroundSync,
}
