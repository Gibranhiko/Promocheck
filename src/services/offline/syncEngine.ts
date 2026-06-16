// Sync engine — lógica sin cambios, solo tipos Visit
import {
  getPendingVisits,
  markVisitSynced,
  markVisitError,
  getPhotosForVisit,
  saveVisitLocally,
} from "./db"
import {
  syncVisitToFirestore,
  uploadVisitPhoto,
  updateVisitPhotos,
} from "@/features/visits/services/visitService"
import { auth } from "@/services/firebase"
import type { Visit } from "@/types/Visit"
import type { PhotoCategory, PhotoRecord } from "@/types/PhotoCategory"

const MAX_RETRIES = 3
const RETRY_DELAY_MS = 2000

export type SyncStatus = "idle" | "syncing" | "error" | "success"

export interface SyncResult {
  success: boolean
  visitId: string
  error?: string
  retries: number
  syncedAt?: number
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function syncVisitWithRetry(
  visit: Visit,
  onPhotoUploaded?: () => void
): Promise<SyncResult> {
  let retries = 0
  let lastError: Error | null = null

  while (retries < MAX_RETRIES) {
    try {
      // 1. Save visit to Firestore first (empty photos) using local ID as doc ID.
      //    setDoc is idempotent so retries are safe.
      await syncVisitToFirestore(visit)

      // 2. Upload photos now that the Firestore doc exists (storage rules read it).
      const photos = await getPhotosForVisit(visit.id)
      const photoUrls: Partial<Record<PhotoCategory, PhotoRecord[]>> = {}
      for (const photo of photos) {
        const record = await uploadVisitPhoto(visit.id, photo.category, photo.sequence, photo.blob)
        if (!photoUrls[photo.category]) photoUrls[photo.category] = []
        photoUrls[photo.category]![photo.sequence] = record
        onPhotoUploaded?.()
      }

      // 3. Update Firestore doc with the photo download URLs.
      //    Merge with any existing photo URLs already on the visit (re-submissions
      //    keep un-re-captured photos from the previous upload).
      const mergedPhotos: Partial<Record<PhotoCategory, PhotoRecord[]>> = { ...(visit.photos ?? {}) }
      for (const [cat, records] of Object.entries(photoUrls) as [PhotoCategory, PhotoRecord[]][]) {
        mergedPhotos[cat] = records
      }
      await updateVisitPhotos(visit.id, mergedPhotos)

      // 4. Update local IndexedDB record.
      const syncedVisit: Visit = {
        ...visit,
        status: "synced",
        syncedAt: Date.now(),
        photos: mergedPhotos,
        rejectionReason: undefined,
      }
      await saveVisitLocally(syncedVisit)
      await markVisitSynced(visit.id)

      return { success: true, visitId: visit.id, retries, syncedAt: Date.now() }
    } catch (err) {
      lastError = err instanceof Error ? err : null
      retries++
      if (import.meta.env.DEV) console.error(`Sync attempt ${retries} failed for visit ${visit.id}:`, err)
      if (retries < MAX_RETRIES) {
        await delay(RETRY_DELAY_MS * retries)
      }
    }
  }

  const errorMessage = lastError?.message ?? "Max retries exceeded"
  await markVisitError(visit.id, errorMessage)
  return { success: false, visitId: visit.id, retries, error: errorMessage }
}

export async function runSyncEngine(
  onProgress?: (uploaded: number, total: number) => void,
  onVisitStart?: (visitId: string) => void
): Promise<SyncResult[]> {
  const pending = await getPendingVisits()
  if (pending.length === 0) return []

  const currentUid = auth.currentUser?.uid
  const ownVisits = pending.filter((visit) => {
    if (visit.promoterId !== currentUid) {
      if (import.meta.env.DEV) console.warn(`Skipping visit ${visit.id}: promoterId mismatch`)
      return false
    }
    return true
  })

  // Count total photos across all visits upfront so the progress bar has a total.
  let total = 0
  for (const visit of ownVisits) {
    const photos = await getPhotosForVisit(visit.id)
    total += photos.length
  }
  let uploaded = 0
  onProgress?.(0, total)

  const results: SyncResult[] = []
  for (const visit of ownVisits) {
    onVisitStart?.(visit.id)
    const result = await syncVisitWithRetry(visit, () => {
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
    await (registration as ServiceWorkerRegistration & { sync: { register: (tag: string) => Promise<void> } }).sync.register("sync-visits")
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
