import { openDB, type IDBPDatabase } from "idb"
import type { Visit } from "@/types/Visit"
import type { VisitStatus } from "@/types/VisitType"
import type { LocalPhoto } from "@/types/PhotoCategory"

const DB_NAME = "promocheck"
const DB_VERSION = 1

export interface PromoCheckDB {
  visits: {
    key: string
    value: Visit
    indexes: { "by-status": VisitStatus }
  }
  photos: {
    key: string
    value: LocalPhoto
  }
}

let dbPromise: Promise<IDBPDatabase<PromoCheckDB>> | null = null

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<PromoCheckDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const visitStore = db.createObjectStore("visits", { keyPath: "id" })
        visitStore.createIndex("by-status", "status")

        db.createObjectStore("photos", { keyPath: "id" })
      },
    })
  }
  return dbPromise
}

export async function saveVisitLocally(visit: Visit): Promise<void> {
  const db = await getDB()
  await db.put("visits", visit)
}

export async function getLocalVisits(): Promise<Visit[]> {
  const db = await getDB()
  return db.getAll("visits")
}

export async function getPendingVisits(): Promise<Visit[]> {
  const db = await getDB()
  return db.getAllFromIndex("visits", "by-status", "pending_sync")
}

export async function getErrorVisits(): Promise<Visit[]> {
  const db = await getDB()
  return db.getAllFromIndex("visits", "by-status", "error")
}

export async function markVisitSynced(id: string): Promise<void> {
  const db = await getDB()
  const visit = await db.get("visits", id)
  if (visit) {
    await db.put("visits", { ...visit, status: "synced", syncedAt: Date.now() })
  }
}

export async function markVisitError(id: string, errorMessage: string): Promise<void> {
  const db = await getDB()
  const visit = await db.get("visits", id)
  if (visit) {
    await db.put("visits", { ...visit, status: "error", errorMessage })
  }
}

export async function getVisit(id: string): Promise<Visit | undefined> {
  const db = await getDB()
  return db.get("visits", id)
}

export async function deleteVisit(id: string): Promise<void> {
  const db = await getDB()
  await db.delete("visits", id)
}

export async function savePhotoLocally(photo: LocalPhoto): Promise<void> {
  const db = await getDB()
  await db.put("photos", photo)
}

export async function getPhotosForVisit(visitId: string): Promise<LocalPhoto[]> {
  const db = await getDB()
  const all = await db.getAll("photos")
  return all.filter((p) => p.visitId === visitId)
}

export async function getPhoto(id: string): Promise<LocalPhoto | undefined> {
  const db = await getDB()
  return db.get("photos", id)
}

export async function deletePhoto(id: string): Promise<void> {
  const db = await getDB()
  await db.delete("photos", id)
}

export async function clearAllData(): Promise<void> {
  const db = await getDB()
  await db.clear("visits")
  await db.clear("photos")
}

export class StorageQuotaExceededError extends Error {
  constructor() {
    super("Cuota de almacenamiento excedida. Sincroniza o elimina algunas visitas.")
    this.name = "StorageQuotaExceededError"
  }
}

export async function estimateStorageUsage(): Promise<{ used: number; quota: number }> {
  if (navigator.storage && navigator.storage.estimate) {
    const estimate = await navigator.storage.estimate()
    return { used: estimate.usage ?? 0, quota: estimate.quota ?? 0 }
  }
  return { used: 0, quota: 0 }
}

export async function checkQuotaBeforeSave(): Promise<void> {
  const { used, quota } = await estimateStorageUsage()
  if (quota > 0 && used / quota > 0.9) {
    throw new StorageQuotaExceededError()
  }
}

export async function cleanupSyncedPhotos(): Promise<number> {
  const db = await getDB()
  const tx = db.transaction("photos", "readwrite")
  const store = tx.objectStore("photos")
  const all = await store.getAll()

  let deleted = 0
  for (const photo of all) {
    const visit = await db.get("visits", photo.visitId)
    if (visit?.status === "synced" || visit?.status === "approved") {
      await store.delete(photo.id)
      deleted++
    }
  }
  await tx.done
  return deleted
}
