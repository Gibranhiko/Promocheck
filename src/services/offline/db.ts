import { openDB, type IDBPDatabase } from "idb"
import type { Operation, LocalPhoto, OperationStatus } from "@/types/Operation"

const DB_NAME = "cargo-control"
const DB_VERSION = 1

export interface CargoControlDB {
  operations: {
    key: string
    value: Operation
    indexes: { "by-status": OperationStatus }
  }
  photos: {
    key: string
    value: LocalPhoto
  }
}

let dbPromise: Promise<IDBPDatabase<CargoControlDB>> | null = null

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<CargoControlDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const opStore = db.createObjectStore("operations", { keyPath: "id" })
        opStore.createIndex("by-status", "status")

        db.createObjectStore("photos", { keyPath: "id" })
      },
    })
  }
  return dbPromise
}

export async function saveOperationLocally(op: Operation): Promise<void> {
  const db = await getDB()
  await db.put("operations", op)
}

export async function getLocalOperations(): Promise<Operation[]> {
  const db = await getDB()
  return db.getAll("operations")
}

export async function getPendingOperations(): Promise<Operation[]> {
  const db = await getDB()
  return db.getAllFromIndex("operations", "by-status", "pending_sync")
}

export async function getErrorOperations(): Promise<Operation[]> {
  const db = await getDB()
  return db.getAllFromIndex("operations", "by-status", "error")
}

export async function markOperationSynced(id: string): Promise<void> {
  const db = await getDB()
  const op = await db.get("operations", id)
  if (op) {
    await db.put("operations", { ...op, status: "synced", syncedAt: Date.now() })
  }
}

export async function markOperationError(id: string, errorMessage: string): Promise<void> {
  const db = await getDB()
  const op = await db.get("operations", id)
  if (op) {
    await db.put("operations", { ...op, status: "error", errorMessage })
  }
}

export async function getOperation(id: string): Promise<Operation | undefined> {
  const db = await getDB()
  return db.get("operations", id)
}

export async function deleteOperation(id: string): Promise<void> {
  const db = await getDB()
  await db.delete("operations", id)
}

export async function savePhotoLocally(photo: LocalPhoto): Promise<void> {
  const db = await getDB()
  await db.put("photos", photo)
}

export async function getPhotosForOperation(operationId: string): Promise<LocalPhoto[]> {
  const db = await getDB()
  const all = await db.getAll("photos")
  return all.filter((p) => p.operationId === operationId)
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
  await db.clear("operations")
  await db.clear("photos")
}

export class StorageQuotaExceededError extends Error {
  constructor() {
    super("Storage quota exceeded. Please sync or delete some operations.")
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
    const op = await db.get("operations", photo.operationId)
    if (op?.status === "synced" || op?.status === "approved") {
      await store.delete(photo.id)
      deleted++
    }
  }
  await tx.done
  return deleted
}
