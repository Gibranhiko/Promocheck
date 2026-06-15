import { describe, it, expect, beforeEach } from "vitest"
import { useOperationStore } from "../operationStore"
import { makeOperation } from "@/test/factories"

describe("operationStore", () => {
  beforeEach(() => {
    useOperationStore.setState({
      operations: [],
      isLoading: false,
      error: null,
      pendingSyncCount: 0,
      lastSyncedAt: null,
    })
  })

  it("starts with an empty operations list", () => {
    expect(useOperationStore.getState().operations).toHaveLength(0)
  })

  it("addOperation prepends to the list", () => {
    const op = makeOperation()
    useOperationStore.getState().addOperation(op)
    expect(useOperationStore.getState().operations[0].id).toBe("op_test_001")
  })

  it("addOperation keeps newest first when adding multiple", () => {
    useOperationStore.getState().addOperation(makeOperation({ id: "first" }))
    useOperationStore.getState().addOperation(makeOperation({ id: "second" }))
    expect(useOperationStore.getState().operations[0].id).toBe("second")
  })

  it("setOperations replaces the entire list", () => {
    useOperationStore.getState().addOperation(makeOperation())
    const newOps = [makeOperation({ id: "a" }), makeOperation({ id: "b" })]
    useOperationStore.getState().setOperations(newOps)
    expect(useOperationStore.getState().operations).toHaveLength(2)
    expect(useOperationStore.getState().operations[0].id).toBe("a")
  })

  it("updateOperation patches only the matching record", () => {
    useOperationStore.getState().setOperations([
      makeOperation({ id: "op1", status: "pending_sync" }),
      makeOperation({ id: "op2", status: "pending_sync" }),
    ])
    useOperationStore.getState().updateOperation("op1", { status: "synced" })
    const ops = useOperationStore.getState().operations
    expect(ops.find((o) => o.id === "op1")?.status).toBe("synced")
    expect(ops.find((o) => o.id === "op2")?.status).toBe("pending_sync")
  })

  it("removeOperation removes only the matching record", () => {
    useOperationStore.getState().setOperations([
      makeOperation({ id: "op1" }),
      makeOperation({ id: "op2" }),
    ])
    useOperationStore.getState().removeOperation("op1")
    const ops = useOperationStore.getState().operations
    expect(ops).toHaveLength(1)
    expect(ops[0].id).toBe("op2")
  })

  it("incrementPendingCount increases by 1 each call", () => {
    useOperationStore.getState().incrementPendingCount()
    useOperationStore.getState().incrementPendingCount()
    expect(useOperationStore.getState().pendingSyncCount).toBe(2)
  })

  it("decrementPendingCount never goes below 0", () => {
    useOperationStore.getState().decrementPendingCount()
    expect(useOperationStore.getState().pendingSyncCount).toBe(0)
  })

  it("decrementPendingCount subtracts correctly from a positive count", () => {
    useOperationStore.getState().setPendingSyncCount(3)
    useOperationStore.getState().decrementPendingCount()
    expect(useOperationStore.getState().pendingSyncCount).toBe(2)
  })

  it("setError stores the error message", () => {
    useOperationStore.getState().setError("Connection failed")
    expect(useOperationStore.getState().error).toBe("Connection failed")
  })

  it("setError(null) clears the error", () => {
    useOperationStore.getState().setError("oops")
    useOperationStore.getState().setError(null)
    expect(useOperationStore.getState().error).toBeNull()
  })

  it("setLastSyncedAt stores the timestamp", () => {
    useOperationStore.getState().setLastSyncedAt(1711756800000)
    expect(useOperationStore.getState().lastSyncedAt).toBe(1711756800000)
  })
})
