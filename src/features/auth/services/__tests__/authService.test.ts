import { describe, it, expect, vi } from "vitest"
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from "firebase/auth"
import { getDoc, doc } from "firebase/firestore"
import { login, logout, getUserRole } from "../authService"

describe("login()", () => {
  it("calls signInWithEmailAndPassword with the correct arguments", async () => {
    vi.mocked(signInWithEmailAndPassword).mockResolvedValueOnce({} as any)
    await login("user@example.com", "password123")
    expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
      expect.anything(),
      "user@example.com",
      "password123"
    )
  })

  it("propagates Firebase errors to the caller", async () => {
    vi.mocked(signInWithEmailAndPassword).mockRejectedValueOnce(
      new Error("auth/user-not-found")
    )
    await expect(login("bad@example.com", "pass")).rejects.toThrow("auth/user-not-found")
  })
})

describe("logout()", () => {
  it("calls Firebase signOut once", async () => {
    vi.mocked(firebaseSignOut).mockResolvedValueOnce(undefined)
    await logout()
    expect(firebaseSignOut).toHaveBeenCalledOnce()
  })

  it("propagates errors from signOut", async () => {
    vi.mocked(firebaseSignOut).mockRejectedValueOnce(new Error("network-error"))
    await expect(logout()).rejects.toThrow("network-error")
  })
})

describe("getUserRole()", () => {
  it("returns the role from the Firestore user document", async () => {
    vi.mocked(doc).mockReturnValueOnce({} as any)
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ role: "operator" }),
    } as any)
    const role = await getUserRole("user_001")
    expect(role).toBe("operator")
  })

  it("returns 'admin' role correctly", async () => {
    vi.mocked(doc).mockReturnValueOnce({} as any)
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ role: "admin" }),
    } as any)
    const role = await getUserRole("admin_001")
    expect(role).toBe("admin")
  })

  it("returns null when the user document does not exist", async () => {
    vi.mocked(doc).mockReturnValueOnce({} as any)
    vi.mocked(getDoc).mockResolvedValueOnce({
      exists: () => false,
      data: () => null,
    } as any)
    const role = await getUserRole("unknown_uid")
    expect(role).toBeNull()
  })

  it("returns null when Firestore throws (e.g. permission denied)", async () => {
    vi.mocked(doc).mockReturnValueOnce({} as any)
    vi.mocked(getDoc).mockRejectedValueOnce(new Error("permission-denied"))
    const role = await getUserRole("user_001")
    expect(role).toBeNull()
  })
})
