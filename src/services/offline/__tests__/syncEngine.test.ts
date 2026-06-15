import { describe, it, expect, vi, beforeEach } from "vitest"
import { runSyncEngine, supportsBackgroundSync } from "../syncEngine"
import * as db from "../db"
import * as operationService from "@/features/operations/services/operationService"
import { makeOperation } from "@/test/factories"

vi.mock("../db")
vi.mock("@/features/operations/services/operationService")

describe("runSyncEngine()", () => {
  beforeEach(() => {
    vi.mocked(db.getPendingOperations).mockResolvedValue([])
    vi.mocked(db.getPhotosForOperation).mockResolvedValue([])
    vi.mocked(db.markOperationSynced).mockResolvedValue(undefined)
    vi.mocked(db.markOperationError).mockResolvedValue(undefined)
    vi.mocked(db.saveOperationLocally).mockResolvedValue(undefined)
    vi.mocked(operationService.checkOperationExists).mockResolvedValue(false)
    vi.mocked(operationService.syncOperationToFirestore).mockResolvedValue("firestore_id")
    vi.mocked(operationService.uploadPhotoToStorage).mockResolvedValue("https://storage.example/photo.jpg")
  })

  it("returns empty array when no pending operations", async () => {
    const results = await runSyncEngine()
    expect(results).toHaveLength(0)
  })

  it("syncs a pending operation successfully", async () => {
    vi.mocked(db.getPendingOperations).mockResolvedValueOnce([makeOperation()])
    const results = await runSyncEngine()
    expect(results).toHaveLength(1)
    expect(results[0].success).toBe(true)
    expect(db.markOperationSynced).toHaveBeenCalledOnce()
  })

  it("skips upload if operation already exists in Firestore", async () => {
    vi.mocked(db.getPendingOperations).mockResolvedValueOnce([makeOperation()])
    vi.mocked(operationService.checkOperationExists).mockResolvedValueOnce(true)
    const results = await runSyncEngine()
    expect(results[0].success).toBe(true)
    expect(operationService.syncOperationToFirestore).not.toHaveBeenCalled()
  })

  it("marks operation as error after max retries", async () => {
    vi.useFakeTimers()
    vi.mocked(db.getPendingOperations).mockResolvedValueOnce([makeOperation()])
    vi.mocked(operationService.syncOperationToFirestore).mockRejectedValue(
      new Error("Firestore unavailable")
    )

    const resultPromise = runSyncEngine()
    await vi.runAllTimersAsync()
    const results = await resultPromise

    expect(results[0].success).toBe(false)
    expect(db.markOperationError).toHaveBeenCalledOnce()
    vi.useRealTimers()
  })

  it("syncs photos and includes URLs in Firestore doc", async () => {
    const fakePhoto = {
      photoType: "reefer_temp" as const,
      blob: new Blob(["img"]),
      id: "p1",
      operationId: "op_test_001",
    }
    vi.mocked(db.getPendingOperations).mockResolvedValueOnce([makeOperation()])
    vi.mocked(db.getPhotosForOperation).mockResolvedValueOnce([fakePhoto])
    await runSyncEngine()
    expect(operationService.uploadPhotoToStorage).toHaveBeenCalledOnce()
    expect(operationService.syncOperationToFirestore).toHaveBeenCalledWith(
      expect.objectContaining({
        photos: { reefer_temp: "https://storage.example/photo.jpg" },
      })
    )
  })
})

describe("supportsBackgroundSync()", () => {
  it("returns false when SyncManager is not available", () => {
    expect(supportsBackgroundSync()).toBe(false)
  })
})
