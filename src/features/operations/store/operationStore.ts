import { create } from "zustand"
import type { Operation } from "@/types/Operation"

interface OperationState {
  operations: Operation[]
  isLoading: boolean
  error: string | null
  pendingSyncCount: number
  lastSyncedAt: number | null

  setOperations: (operations: Operation[]) => void
  addOperation: (operation: Operation) => void
  updateOperation: (id: string, updates: Partial<Operation>) => void
  removeOperation: (id: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setPendingSyncCount: (count: number) => void
  setLastSyncedAt: (timestamp: number | null) => void
  incrementPendingCount: () => void
  decrementPendingCount: () => void
}

export const useOperationStore = create<OperationState>((set) => ({
  operations: [],
  isLoading: false,
  error: null,
  pendingSyncCount: 0,
  lastSyncedAt: null,

  setOperations: (operations) => set({ operations }),

  addOperation: (operation) =>
    set((state) => ({
      operations: [operation, ...state.operations],
    })),

  updateOperation: (id, updates) =>
    set((state) => ({
      operations: state.operations.map((op) =>
        op.id === id ? { ...op, ...updates } : op
      ),
    })),

  removeOperation: (id) =>
    set((state) => ({
      operations: state.operations.filter((op) => op.id !== id),
    })),

  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setPendingSyncCount: (pendingSyncCount) => set({ pendingSyncCount }),
  setLastSyncedAt: (lastSyncedAt) => set({ lastSyncedAt }),

  incrementPendingCount: () =>
    set((state) => ({ pendingSyncCount: state.pendingSyncCount + 1 })),

  decrementPendingCount: () =>
    set((state) => ({
      pendingSyncCount: Math.max(0, state.pendingSyncCount - 1),
    })),
}))
