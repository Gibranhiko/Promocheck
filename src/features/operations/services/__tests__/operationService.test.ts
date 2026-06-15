import { describe, it, expect, vi } from "vitest"
import { getDocs, getDoc, addDoc, doc } from "firebase/firestore"
import {
  fetchOperationsPaginated,
  fetchOperationsByOperator,
  fetchOperation,
  syncOperationToFirestore,
} from "../operationService"
import { makeOperation } from "@/test/factories"

// Firebase modules are already mocked globally in setup.ts

function makeQuerySnapshot(docs: object[]) {
  return {
    docs: docs.map((data) => ({
      id: "firestore_id_001",
      data: () => data,
    })),
    empty: docs.length === 0,
  }
}

describe("fetchOperationsPaginated()", () => {
  it("returns mapped operations from Firestore", async () => {
    vi.mocked(getDocs).mockResolvedValueOnce(
      makeQuerySnapshot([makeOperation()]) as any
    )
    const { operations } = await fetchOperationsPaginated()
    expect(operations).toHaveLength(1)
    expect(operations[0].orderNumber).toBe("ORD001")
  })

  it("returns empty array when no documents found", async () => {
    vi.mocked(getDocs).mockResolvedValueOnce(makeQuerySnapshot([]) as any)
    const { operations } = await fetchOperationsPaginated()
    expect(operations).toHaveLength(0)
  })
})

describe("fetchOperationsByOperator()", () => {
  it("returns operations filtered by operatorId", async () => {
    vi.mocked(getDocs).mockResolvedValueOnce(
      makeQuerySnapshot([makeOperation({ operatorId: "user_001" })]) as any
    )
    const ops = await fetchOperationsByOperator("user_001")
    expect(ops[0].operatorId).toBe("user_001")
  })
})

describe("fetchOperation()", () => {
  it("returns a single operation by id", async () => {
    vi.mocked(doc).mockReturnValueOnce({} as any)
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      id: "op_001",
      data: () => makeOperation({ id: "op_001" }),
    } as any)
    const op = await fetchOperation("op_001")
    expect(op?.id).toBe("op_001")
  })

  it("returns null when document does not exist", async () => {
    vi.mocked(doc).mockReturnValueOnce({} as any)
    vi.mocked(getDoc).mockResolvedValueOnce({ exists: () => false } as any)
    const op = await fetchOperation("missing")
    expect(op).toBeNull()
  })
})

describe("syncOperationToFirestore()", () => {
  it("calls addDoc and returns the new document id", async () => {
    vi.mocked(addDoc).mockResolvedValueOnce({ id: "new_firestore_id" } as any)
    const id = await syncOperationToFirestore(makeOperation({ photos: {} }))
    expect(id).toBe("new_firestore_id")
    expect(addDoc).toHaveBeenCalledOnce()
  })
})
