import { describe, it, expect, vi } from "vitest"
import { createUserWithEmailAndPassword, signOut } from "firebase/auth"
import { setDoc, getDocs, updateDoc, doc, collection, query, orderBy } from "firebase/firestore"
import { createOperatorAccount, fetchAllUsers, updateUserRole } from "../adminService"

// Firebase modules are already mocked globally in setup.ts

function makeUserSnap(data: object) {
  return {
    docs: [{ id: "uid_001", data: () => data }],
  }
}

describe("createOperatorAccount()", () => {
  it("creates auth user and writes Firestore doc", async () => {
    vi.mocked(createUserWithEmailAndPassword).mockResolvedValueOnce({
      user: { uid: "new_uid", email: "op@example.com" },
    } as any)
    vi.mocked(signOut).mockResolvedValueOnce(undefined)
    vi.mocked(doc).mockReturnValueOnce({} as any)
    vi.mocked(setDoc).mockResolvedValueOnce(undefined)

    await createOperatorAccount("op@example.com", "Password1")

    expect(createUserWithEmailAndPassword).toHaveBeenCalledOnce()
    expect(signOut).toHaveBeenCalledOnce() // must sign out of secondary app
    expect(setDoc).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ email: "op@example.com", role: "operator" })
    )
  })

  it("propagates Firebase errors to the caller", async () => {
    vi.mocked(createUserWithEmailAndPassword).mockRejectedValueOnce(
      new Error("auth/email-already-in-use")
    )
    await expect(
      createOperatorAccount("dup@example.com", "Password1")
    ).rejects.toThrow("auth/email-already-in-use")
    expect(setDoc).not.toHaveBeenCalled()
  })
})

describe("fetchAllUsers()", () => {
  it("returns mapped user list from Firestore", async () => {
    vi.mocked(collection).mockReturnValueOnce({} as any)
    vi.mocked(query).mockReturnValueOnce({} as any)
    vi.mocked(orderBy).mockReturnValueOnce({} as any)
    vi.mocked(getDocs).mockResolvedValueOnce(
      makeUserSnap({ email: "op@example.com", role: "operator", createdAt: 0 }) as any
    )
    const users = await fetchAllUsers()
    expect(users).toHaveLength(1)
    expect(users[0].uid).toBe("uid_001")
    expect(users[0].role).toBe("operator")
  })
})

describe("updateUserRole()", () => {
  it("calls updateDoc with the new role", async () => {
    vi.mocked(doc).mockReturnValueOnce({} as any)
    vi.mocked(updateDoc).mockResolvedValueOnce(undefined)
    await updateUserRole("uid_001", "admin")
    expect(updateDoc).toHaveBeenCalledWith(expect.anything(), { role: "admin" })
  })
})
