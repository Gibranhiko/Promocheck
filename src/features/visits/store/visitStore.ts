import { create } from "zustand"
import type { Visit } from "@/types/Visit"

interface VisitState {
  visits: Visit[]
  isLoading: boolean
  error: string | null
  pendingSyncCount: number
  lastSyncedAt: number | null

  setVisits: (visits: Visit[]) => void
  addVisit: (visit: Visit) => void
  updateVisit: (id: string, updates: Partial<Visit>) => void
  removeVisit: (id: string) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  setPendingSyncCount: (count: number) => void
  setLastSyncedAt: (timestamp: number | null) => void
  incrementPendingCount: () => void
  decrementPendingCount: () => void
}

export const useVisitStore = create<VisitState>((set) => ({
  visits: [],
  isLoading: false,
  error: null,
  pendingSyncCount: 0,
  lastSyncedAt: null,

  setVisits: (visits) => set({ visits }),

  addVisit: (visit) =>
    set((state) => ({
      visits: [visit, ...state.visits],
    })),

  updateVisit: (id, updates) =>
    set((state) => ({
      visits: state.visits.map((v) => (v.id === id ? { ...v, ...updates } : v)),
    })),

  removeVisit: (id) =>
    set((state) => ({
      visits: state.visits.filter((v) => v.id !== id),
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
