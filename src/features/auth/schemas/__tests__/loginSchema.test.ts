import { describe, it, expect } from "vitest"
import { loginSchema } from "../loginSchema"

describe("loginSchema", () => {
  it("accepts valid email and password", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "secret123" })
    expect(result.success).toBe(true)
  })

  it("rejects invalid email format", () => {
    const result = loginSchema.safeParse({ email: "not-an-email", password: "secret123" })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe("Invalid email address")
  })

  it("rejects empty email", () => {
    const result = loginSchema.safeParse({ email: "", password: "secret123" })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe("Email is required")
  })

  it("rejects password shorter than 6 characters", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "abc" })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toBe("Password must be at least 6 characters")
  })

  it("rejects missing password", () => {
    const result = loginSchema.safeParse({ email: "user@example.com" })
    expect(result.success).toBe(false)
  })
})
