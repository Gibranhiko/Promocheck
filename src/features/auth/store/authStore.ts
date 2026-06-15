import { create } from "zustand"
import type { UserRole } from "@/types"

export interface AuthUser {
  uid: string
  email: string | null
  name: string | null
  role: UserRole | null
}

interface AuthState {
  user: AuthUser | null
  isLoading: boolean
  setUser: (user: AuthUser | null) => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user }),
  setLoading: (isLoading) => set({ isLoading }),
}))
