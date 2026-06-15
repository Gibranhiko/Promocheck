import { describe, it, expect } from "vitest"
import { createUserSchema } from "../createUserSchema"

describe("createUserSchema", () => {
  const valid = {
    email: "op@example.com",
    password: "Password1",
    confirmPassword: "Password1",
    role: "operator" as const,
  }

  it("accepts valid operator registration", () => {
    expect(createUserSchema.safeParse(valid).success).toBe(true)
  })

  it("accepts admin role", () => {
    expect(createUserSchema.safeParse({ ...valid, role: "admin" }).success).toBe(true)
  })

  it("rejects password shorter than 8 characters", () => {
    const r = createUserSchema.safeParse({ ...valid, password: "Abc1", confirmPassword: "Abc1" })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toMatch(/8 characters/)
  })

  it("rejects password without uppercase letter", () => {
    const r = createUserSchema.safeParse({
      ...valid,
      password: "password1",
      confirmPassword: "password1",
    })
    expect(r.success).toBe(false)
    expect(r.error?.issues.some((i) => i.message.includes("uppercase"))).toBe(true)
  })

  it("rejects password without a number", () => {
    const r = createUserSchema.safeParse({
      ...valid,
      password: "Password",
      confirmPassword: "Password",
    })
    expect(r.success).toBe(false)
    expect(r.error?.issues.some((i) => i.message.includes("number"))).toBe(true)
  })

  it("rejects when passwords do not match", () => {
    const r = createUserSchema.safeParse({ ...valid, confirmPassword: "WrongPass1" })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toMatch(/do not match/)
  })

  it("rejects invalid role", () => {
    const r = createUserSchema.safeParse({ ...valid, role: "superuser" as any })
    expect(r.success).toBe(false)
  })
})
