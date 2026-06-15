import { describe, it, expect, beforeEach } from "vitest"
import { useAuthStore } from "../authStore"

describe("authStore", () => {
  beforeEach(() => {
    useAuthStore.setState({ user: null, isLoading: true })
  })

  it("starts with null user and isLoading true", () => {
    const { user, isLoading } = useAuthStore.getState()
    expect(user).toBeNull()
    expect(isLoading).toBe(true)
  })

  it("setUser stores the user object", () => {
    useAuthStore.getState().setUser({ uid: "u1", email: "a@b.com", role: "operator" })
    expect(useAuthStore.getState().user?.uid).toBe("u1")
    expect(useAuthStore.getState().user?.role).toBe("operator")
  })

  it("setUser(null) clears the user", () => {
    useAuthStore.getState().setUser({ uid: "u1", email: "a@b.com", role: "admin" })
    useAuthStore.getState().setUser(null)
    expect(useAuthStore.getState().user).toBeNull()
  })

  it("setLoading updates isLoading", () => {
    useAuthStore.getState().setLoading(false)
    expect(useAuthStore.getState().isLoading).toBe(false)
  })

  it("preserves other fields when updating user", () => {
    useAuthStore.getState().setUser({ uid: "u1", email: "x@y.com", role: "admin" })
    useAuthStore.getState().setLoading(false)
    expect(useAuthStore.getState().user?.email).toBe("x@y.com")
    expect(useAuthStore.getState().isLoading).toBe(false)
  })
})
