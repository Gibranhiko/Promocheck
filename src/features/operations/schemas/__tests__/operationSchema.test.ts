import { describe, it, expect } from "vitest"
import { operationSchema } from "../operationSchema"

describe("operationSchema", () => {
  const valid = { orderNumber: "ORD001", doorNumber: "D01", operationType: "load" as const }

  it("accepts a valid load operation", () => {
    expect(operationSchema.safeParse(valid).success).toBe(true)
  })

  it("accepts a valid unload operation", () => {
    expect(operationSchema.safeParse({ ...valid, operationType: "unload" }).success).toBe(true)
  })

  it("rejects orderNumber shorter than 3 characters", () => {
    const r = operationSchema.safeParse({ ...valid, orderNumber: "AB" })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toMatch(/at least 3/)
  })

  it("rejects orderNumber longer than 20 characters", () => {
    const r = operationSchema.safeParse({ ...valid, orderNumber: "A".repeat(21) })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toMatch(/at most 20/)
  })

  it("rejects orderNumber with special characters", () => {
    const r = operationSchema.safeParse({ ...valid, orderNumber: "ORD-001" })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toMatch(/alphanumeric/)
  })

  it("rejects empty doorNumber", () => {
    const r = operationSchema.safeParse({ ...valid, doorNumber: "" })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toMatch(/required/)
  })

  it("rejects doorNumber longer than 10 characters", () => {
    const r = operationSchema.safeParse({ ...valid, doorNumber: "D".repeat(11) })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toMatch(/at most 10/)
  })

  it("rejects doorNumber with special characters", () => {
    const r = operationSchema.safeParse({ ...valid, doorNumber: "D-01" })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0].message).toMatch(/alphanumeric/)
  })

  it("rejects an invalid operationType", () => {
    const r = operationSchema.safeParse({ ...valid, operationType: "ship" })
    expect(r.success).toBe(false)
  })

  it("rejects missing operationType", () => {
    const r = operationSchema.safeParse({ orderNumber: "ORD001", doorNumber: "D01" })
    expect(r.success).toBe(false)
  })
})
